import { BaseAskOptions } from "./ask";
import { ModelProvider } from "./model-provider";
import {
    AgentConversationContext,
    AgentConversationTurn,
    AgentRunStream,
} from "./agent-run-stream";

const MAX_STORED_TURNS = 4;

/**
 * Keeps only the most recent turns that should be persisted on the session.
 */
const trimTurns = (turns: AgentConversationTurn[]) => turns.slice(-MAX_STORED_TURNS);

/**
 * Lightweight session entry shown in the UI session list.
 */
export interface AgentSessionSummary {
    id: number;
    name: string;
}

/**
 * Full in-memory session record including resumable conversation state.
 */
interface AgentSessionState extends AgentSessionSummary {
    conversation: AgentConversationContext;
}

/**
 * Ask payload augmented with session and provider ownership details.
 */
export interface AgentRunRequest extends BaseAskOptions {
    session: number;
    modelProvider: ModelProvider;
}

/**
 * Handle returned immediately after starting a streamed agent run.
 */
export interface AgentRunResult {
    id: number;
    streamPromise: Promise<AgentRunStream>;
}

/**
 * Resolved form of an agent run handle once the stream has been created.
 */
export interface AgentRunStreamResult {
    id: number;
    stream: AgentRunStream;
}

/**
 * Owns the lifecycle of chat sessions and keeps short resumable context per
 * session between agent runs.
 */
export class AgentSessionController {
    private askCounter = 0;
    private readonly sessions: AgentSessionState[] = [];

    constructor() {}

    /**
     * Returns the list of known sessions for navigation and selection.
     */
    listSessions() {
        return this.sessions.map(({ id, name }) => ({ id, name }));
    }

    /**
     * Creates a new session with an optional display name.
     */
    createSession(name?: string) {
        const id = this.sessions.length;
        const session = {
            id,
            name: name?.trim() || `Session ${id + 1}`,
            conversation: {},
        };

        this.sessions.push(session);

        return session;
    }

    /**
     * Removes a session and its stored conversation state.
     */
    removeSession(id: number) {
        const index = this.sessions.findIndex((item) => item.id === id);
        if (index !== -1) {
            this.sessions.splice(index, 1);
        }
    }

    /**
     * Starts a streamed agent run for a session and updates session state when
     * the run completes.
     */
    ask(request: AgentRunRequest): AgentRunResult {
        const session = this.assertSession(request.session);
        const id = this.askCounter++;
        const historicalTurns = trimTurns(session.conversation.turns ?? []);
        const nextTurns = [
            ...historicalTurns,
            {
                role: "user" as const,
                content: request.message,
            },
        ];

        const streamPromise = request.modelProvider
            .ask({
                ...request,
                conversation: {
                    ...session.conversation,
                    turns: historicalTurns,
                },
            })
            .then((stream) => {
                stream.on("end", () => {
                    const latestConversation = stream.getConversationContext();
                    const activeSession = this.sessions.find((item) => item.id === request.session);
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

                    request.modelProvider
                        .compressConversation({
                            model: request.model,
                            locale: request.locale,
                            ...(activeSession.conversation.summary === undefined
                                ? {}
                                : { previousSummary: activeSession.conversation.summary }),
                            turns: completedTurns,
                        })
                        .then((summary) => {
                            const currentSession = this.sessions.find(
                                (item) => item.id === request.session,
                            );
                            if (!currentSession || summary.trim().length === 0) {
                                return;
                            }

                            currentSession.conversation = {
                                ...currentSession.conversation,
                                summary,
                                turns: trimTurns(completedTurns),
                            };
                        })
                        .catch(() => {
                            // Keep the uncompressed recent-turn fallback when summary generation fails.
                        });
                });

                return stream;
            });

        return {
            id,
            streamPromise,
        };
    }

    /**
     * Resolves a session id or throws when the caller refers to an unknown session.
     */
    private assertSession(id: number) {
        const session = this.sessions.find((item) => item.id === id);
        if (!session) {
            throw new Error(`Unknown agent session: ${id}`);
        }

        return session;
    }
}
