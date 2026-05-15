import { generateText } from "ai";
import { AskOptions } from ".";
import { createModelWithModelProvider, trimTurns } from "./helper";
import {
    AgentConversationContext,
    AgentConversationTurn,
    AskResponse,
    AskResponseResultEvent,
    createAskReponseResult,
} from "./response";

const MAX_COMPRESSION_SOURCE_TURNS = 10;
const MAX_SESSION_TITLE_LENGTH = 20;

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
Title:
Goal:
Constraints:
Progress:
Current state:
Next step:
`;

/**
 * Input used to condense recent conversation history into a portable summary.
 *
 * This extends a normal ask request with the turn material that should be
 * compressed, letting summarization reuse the same provider and locale choices
 * as the foreground run.
 */
export interface SessionCompressionOptions extends AskOptions {
    previousSummary?: string;
    turns: AgentConversationTurn[];
}

interface SessionCompressionResult {
    title: string | null;
    summary: string;
}

/**
 * Produces compact resumable context for long-running sessions.
 *
 * The summary is intentionally lossy: it keeps task-critical state, decisions,
 * and blockers while discarding execution noise that would only bloat later
 * prompts.
 */
export class SessionCompressor {
    private static normalizeTitle(value: string) {
        return value
            .replace(/\s+/g, " ")
            .replace(
                /^["'“”‘’【】\[\](){}<>\-:：;,，。.!！？]+|["'“”‘’【】\[\](){}<>\-:：;,，。.!！？]+$/g,
                "",
            )
            .trim()
            .slice(0, MAX_SESSION_TITLE_LENGTH);
    }

    private static parseCompressionResult(text: string): SessionCompressionResult {
        const normalized = text.trim();
        const titleMatch = normalized.match(/(^|\n)Title:\s*([^\n]*)/i);
        const title = titleMatch?.[2] ? this.normalizeTitle(titleMatch[2]) : null;
        const summary = normalized.replace(/(^|\n)Title:\s*([^\n]*)\n?/i, "$1").trim();

        return {
            title: title && title.length > 0 ? title : null,
            summary,
        };
    }

    /**
     * Compresses the latest useful slice of the conversation.
     *
     * This method uses the provider chosen for the active session, so the
     * compression quality and language generally track the user's current model
     * configuration instead of relying on a hidden secondary model.
     */
    static async compress(options: SessionCompressionOptions) {
        const turns = options.turns.slice(-MAX_COMPRESSION_SOURCE_TURNS);

        const response = await generateText({
            model: createModelWithModelProvider(options.modelProvider),
            system: CONTEXT_COMPRESSION_PROMPT,
            prompt: [
                `Write the compressed context in ${options.locale} unless the user explicitly asked for another language.`,
                `Also generate a short session title no longer than ${MAX_SESSION_TITLE_LENGTH} characters.`,
                options.previousSummary
                    ? `Previous compressed context:\n${options.previousSummary}`
                    : "Previous compressed context: none",
                "Recent conversation turns:",
                ...turns.map(
                    (turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`,
                ),
            ].join("\n\n"),
        });

        return this.parseCompressionResult(response.text);
    }
}

/**
 * Lightweight session record surfaced to callers and the UI.
 */
export interface Session {
    id: number;
    name?: string;
}

/**
 * Internal session state that also carries resumable conversation metadata.
 */
interface SessionState extends Session {
    conversation: AgentConversationContext;
}

/**
 * Owns in-memory chat sessions and their resumable conversation state.
 *
 * This manager is intentionally ephemeral. Persistence, if needed, should live
 * above core so the runtime can decide when and how sessions are stored.
 */
export class SessionManager {
    private counter = 0;
    private sessions: { [key: number]: SessionState } = {};

    /**
     * Returns the lightweight session list used by callers and UI state.
     */
    list(): Session[] {
        return Object.values(this.sessions).map(({ id, name }) => ({ id, name }) as Session);
    }

    /**
     * Looks up the live in-memory state for a session.
     */
    get(id: number): SessionState | undefined {
        return this.sessions[id];
    }

    /**
     * Creates a new empty session with no prior conversation state.
     */
    create(name?: string): Session {
        let summary = {
            id: this.counter++,
            name,
        } as Session;

        this.sessions[summary.id] = {
            ...summary,
            conversation: {} as AgentConversationContext,
        };

        return summary;
    }

    /**
     * Deletes a session and its associated conversation state.
     */
    remove(id: number) {
        delete this.sessions[id];
    }

    /**
     * Prepares a single ask call using the session's current stored context.
     *
     * The returned nextTurns include the new user message so stream completion
     * logic can append the assistant response without re-reading session state.
     */
    turnAskOptions(askOptions: AskOptions) {
        const sessionState = this.sessions[askOptions.session];
        if (!sessionState) {
            throw new Error(`Session with id ${askOptions.session} not found`);
        }

        const historicalTurns = trimTurns(sessionState.conversation.turns ?? []);
        const nextTurns = [
            ...historicalTurns,
            {
                role: "user" as const,
                content: askOptions.message,
            },
        ];

        return {
            nextTurns,
            options: {
                ...askOptions,
                conversation: {
                    ...sessionState.conversation,
                    turns: historicalTurns,
                },
            },
        };
    }

    /**
     * Attaches end-of-stream bookkeeping for session history and compression.
     *
     * Compression runs in the background on a best-effort basis. The session is
     * first updated with the fresh resumable identifiers so a failed summary pass
     * does not block continuing the conversation.
     */
    hookAskReponse(
        options: AskOptions,
        nextTurns: AgentConversationTurn[],
        response: AskResponse,
        abortSignal: AbortSignal,
    ) {
        response.start().catch((error) => {
            response.emit("error", error instanceof Error ? error : new Error(String(error)));
        });

        response.once("response-end", async () => {
            if (abortSignal.aborted) {
                response.finish();

                return;
            }

            try {
                const latestConversation = response.getConversationContext();
                const activeSession = this.get(options.session);
                if (!activeSession) {
                    return;
                }

                const assistantOutput = response.getOutputText();
                const completedTurns =
                    assistantOutput.length > 0
                        ? [
                              ...nextTurns,
                              {
                                  role: "assistant" as const,
                                  content: assistantOutput,
                              },
                          ]
                        : nextTurns;

                activeSession.conversation = {
                    ...latestConversation,
                    ...(activeSession.conversation.summary === undefined
                        ? {}
                        : { summary: activeSession.conversation.summary }),
                    turns: trimTurns(completedTurns),
                };

                response.emit(
                    "activity",
                    createAskReponseResult(AskResponseResultEvent.SESSION_COMPRESSION_RUNNING),
                );

                const { summary, title } = await SessionCompressor.compress({
                    ...options,
                    ...(activeSession.conversation.summary === undefined
                        ? {}
                        : { previousSummary: activeSession.conversation.summary }),
                    turns: completedTurns,
                });

                if (summary.trim().length > 0) {
                    activeSession.conversation = {
                        ...activeSession.conversation,
                        summary,
                        turns: trimTurns(completedTurns),
                    };
                }

                response.emit(
                    "activity",
                    createAskReponseResult(AskResponseResultEvent.SESSION_COMPRESSION_COMPLETED),
                );

                if (title && activeSession.name !== title) {
                    activeSession.name = title;

                    response.emit(
                        "activity",
                        createAskReponseResult(AskResponseResultEvent.SESSION_RENAMED_COMPLETED, {
                            title,
                        }),
                    );
                }
            } catch (error: any) {
                response.emit(
                    "activity",
                    createAskReponseResult(AskResponseResultEvent.SESSION_COMPRESSION_COMPLETED, {
                        error: error instanceof Error ? error.message : String(error),
                    }),
                );
            } finally {
                response.finish();
            }
        });
    }
}
