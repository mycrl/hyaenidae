/**
 * In-memory session storage and LLM-backed title/summary compression.
 */

import { Model } from "./provider";
import { ResponseStream } from "./response";
import { randomUUID } from "node:crypto";

/**
 * Maximum characters kept for a generated session display name.
 */
const MAX_SESSION_TITLE_LENGTH = 20;

/**
 * System prompt for rolling task-context compression between turns.
 */
const CONTEXT_COMPRESSION_PROMPT = `
You compress browser-agent session context for the next turn.
Preserve only the information needed to continue the task reliably.
Prioritize:
- the user's current goal
- confirmed preferences and constraints
- important decisions already made
- key observations that changed the plan
- the key path completed so far
- the current state in that path, including blockers or waiting-for-user steps
- the most likely next step

Do not include:
- screenshots or image payload details
- raw tool logs, tool call arguments, or execution-by-execution narration
- repetitive wording, filler, or chain-of-thought
- details that no longer affect the task

Do not drop critical facts such as product requirements, quantities, URLs that matter, selected items, login state, explicit user approvals, or blockers.

Return plain text using exactly these sections:
Goal:
Constraints:
Progress:
Current state:
Next step:
`;

/**
 * System prompt for deriving a short session title from the latest turn.
 */
const SESSION_TITLE_PROMPT = `
You generate a short session title for a browser-agent conversation.
The title should capture the user's current goal or main topic.
Return only the title text, with no quotes, punctuation wrapping, or extra explanation.
`;

/**
 * One completed user/assistant exchange passed into summarization.
 */
export type SingleChat = {
    user: string;
    assistant: string;
};

/**
 * LLM-backed helpers that shrink session history for the next agent turn.
 *
 * Title generation and context compression are separate calls so each prompt
 * can stay focused. Summaries are intentionally lossy: they keep task-critical
 * state, decisions, and blockers while discarding execution noise.
 */
export class SessionCompressor {
    /**
     * Generates a short session title from the latest conversation turn.
     *
     * The model response is normalized (collapsed whitespace, trimmed wrapping
     * punctuation) and truncated to {@link MAX_SESSION_TITLE_LENGTH}. Returns
     * an empty string when nothing usable remains.
     */
    static async generateTitle({
        model,
        language,
        chat,
    }: {
        model: Model;
        language: string;
        chat: SingleChat;
    }) {
        const response = await model.invoke([
            {
                role: "system",
                content: SESSION_TITLE_PROMPT,
            },
            {
                role: "user",
                content: [
                    `Write the title in ${language} unless the user explicitly asked for another language.`,
                    `Keep the title no longer than ${MAX_SESSION_TITLE_LENGTH} characters.`,
                    "Current conversation turns:",
                    `"User": ${chat.user}`,
                    `"Assistant": ${chat.assistant}`,
                ].join("\n\n"),
            },
        ]);

        const title = ResponseStream.extractText(response.content)
            .replace(/\s+/g, " ")
            .replace(
                /^["'“”‘’【】\[\](){}<>\-:：;,，。.!！？]+|["'“”‘’【】\[\](){}<>\-:：;,，。.!！？]+$/g,
                "",
            )
            .trim()
            .slice(0, MAX_SESSION_TITLE_LENGTH);

        return title;
    }

    /**
     * Compresses the latest useful slice of the conversation into structured
     * sections (Goal, Constraints, Progress, Current state, Next step).
     *
     * Uses the active session's model so compression quality and language track
     * the user's current provider configuration. When a prior summary exists, it
     * is folded into the new compression rather than replaying full history.
     */
    static async compress({
        model,
        language,
        previousSummary,
        chat,
    }: {
        model: Model;
        language: string;
        previousSummary?: string;
        chat: SingleChat;
    }) {
        const response = await model.invoke([
            {
                role: "system",
                content: CONTEXT_COMPRESSION_PROMPT,
            },
            {
                role: "user",
                content: [
                    `Write the compressed context in ${language} unless the user explicitly asked for another language.`,
                    previousSummary
                        ? `Previous compressed context:\n${previousSummary}`
                        : "Previous compressed context: none",
                    "Current conversation turns:",
                    `"User": ${chat.user}`,
                    `"Assistant": ${chat.assistant}`,
                ].join("\n\n"),
            },
        ]);

        return ResponseStream.extractText(response.content);
    }
}

/**
 * Owns in-memory chat sessions and their resumable conversation state.
 *
 * This manager is intentionally ephemeral. Persistence, if needed, should live
 * above core so the runtime can decide when and how sessions are stored.
 */
export class SessionManager {
    private sessions: Map<
        string,
        {
            name?: string;
            summary?: string;
            chats: Array<{
                role: "user" | "assistant";
                content: string;
            }>;
        }
    > = new Map();

    /**
     * Returns each session's numeric id and optional display name for UI lists.
     */
    list() {
        return Array.from(this.sessions.entries()).map(([id, { name }]) => ({
            id,
            name,
        }));
    }

    /**
     * Looks up the live in-memory state for a session.
     */
    get(id: string, includeSummary = true) {
        const session = this.sessions.get(id);
        if (!session) {
            return null;
        }

        return {
            id,
            name: session.name,
            summary: includeSummary ? session.summary : undefined,
            chats: session.chats,
        };
    }

    /**
     * Creates a new empty session with no prior conversation state.
     */
    create(name?: string) {
        const id = randomUUID();

        this.sessions.set(id, {
            name,
            chats: [],
        });

        return { id, name };
    }

    /**
     * Deletes a session and its associated conversation state.
     */
    remove(id: string) {
        this.sessions.delete(id);
    }

    /**
     * Builds the user prompt for the next agent turn.
     *
     * When the session already has compressed context or recent turns, those are
     * prepended so the model can continue without replaying the full thread.
     * Brand-new sessions return the raw latest user message unchanged.
     */
    createPrompt(id: string, message: string) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error(`Session with id ${id} not found`);
        }

        if (!session.summary && session.chats.length === 0) {
            return message;
        }

        return [
            ...(session.summary
                ? ["Compressed task context:", session.summary, ""]
                : []),
            ...(session.chats.length > 0
                ? [
                      "Recent conversation turns:",
                      ...session.chats.map(
                          (turn) =>
                              `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`,
                      ),
                      "",
                  ]
                : []),
            "",
            "Continue from this context and answer the latest user message.",
            `Latest user message: ${message}`,
        ].join("\n");
    }

    /**
     * Finalizes a completed turn: refreshes title and summary, then appends the
     * user/assistant messages to in-memory history.
     *
     * Title and summary are generated in parallel. An empty generated title keeps
     * any name the session already had.
     */
    async finishing(
        id: string,
        responseStream: ResponseStream,
        {
            model,
            chat,
            language,
        }: {
            model: Model;
            language: string;
            chat: SingleChat;
        },
    ) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error(`Session with id ${id} not found`);
        }

        /**
         * Send an event to the listener to indicate that the session
         * compression is running.
         */
        responseStream.sendSessionCompressionEvent("running");

        const summary = await SessionCompressor.compress({
            model,
            chat,
            language,
            previousSummary: session.summary,
        });

        /**
         * Generate a new title for the session if it doesn't have one.
         */
        if (!session.name) {
            session.name = await SessionCompressor.generateTitle({
                model,
                chat,
                language,
            });

            responseStream.sendSessionRenamedEvent(session.name);
        }

        /**
         * Send an event to the listener to indicate that the session compression
         * is completed.
         */
        responseStream.sendSessionCompressionEvent("completed");

        this.sessions.set(id, {
            name: session.name,
            summary,
            chats: [
                ...session.chats,
                { role: "user", content: chat.user },
                { role: "assistant", content: chat.assistant },
            ],
        });
    }
}
