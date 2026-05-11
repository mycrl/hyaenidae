import { AskOptions } from ".";
import { trimTurns, createOpenAIClient, extractResponseText } from "./helper";
import { AgentConversationContext, AgentConversationTurn, AskResponse } from "./response";

const MAX_COMPRESSION_SOURCE_TURNS = 10;

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

/**
 * Produces compact resumable context for long-running sessions.
 *
 * The summary is intentionally lossy: it keeps task-critical state, decisions,
 * and blockers while discarding execution noise that would only bloat later
 * prompts.
 */
export class SessionCompressor {
    /**
     * Compresses the latest useful slice of the conversation.
     *
     * This method uses the provider chosen for the active session, so the
     * compression quality and language generally track the user's current model
     * configuration instead of relying on a hidden secondary model.
     */
    static async compress(options: SessionCompressionOptions) {
        const turns = options.turns.slice(-MAX_COMPRESSION_SOURCE_TURNS);

        const response = await createOpenAIClient(options.modelProvider).responses.create({
            model: options.modelProvider.model,
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: CONTEXT_COMPRESSION_PROMPT,
                        },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: [
                                `Write the compressed context in ${options.locale} unless the user explicitly asked for another language.`,
                                options.previousSummary
                                    ? `Previous compressed context:\n${options.previousSummary}`
                                    : "Previous compressed context: none",
                                "Recent conversation turns:",
                                ...turns.map(
                                    (turn) =>
                                        `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`,
                                ),
                            ].join("\n\n"),
                        },
                    ],
                },
            ],
        });

        return extractResponseText(response);
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
    hookupStreamEnd(options: AskOptions, nextTurns: AgentConversationTurn[], stream: AskResponse) {
        stream.on("end", () => {
            const latestConversation = stream.getConversationContext();
            const activeSession = this.get(options.session);
            if (!activeSession) {
                return;
            }

            const assistantOutput = stream.getOutputText();
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

            SessionCompressor.compress({
                ...options,
                ...(activeSession.conversation.summary === undefined
                    ? {}
                    : { previousSummary: activeSession.conversation.summary }),
                turns: completedTurns,
            })
                .then((summary) => {
                    if (summary.trim().length === 0) {
                        return;
                    }

                    activeSession.conversation = {
                        ...activeSession.conversation,
                        summary,
                        turns: trimTurns(completedTurns),
                    };
                })
                .catch((error: any) => {
                    console.error("Error during conversation compression:", error);
                });
        });
    }
}
