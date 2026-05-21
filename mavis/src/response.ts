/**
 * Stream adapters and shared event types for agent output.
 */

import type { AgentRunStream } from "langchain";

/**
 * UI-facing activity item emitted while an agent run is progressing.
 */
export type AgentActivityEvent =
    | {
          key: string;
          type: "reasoning";
          data?: { text: string };
      }
    | {
          key: string;
          type: "tool";
          status: "running";
          tool: string;
          data: { arguments: Record<string, unknown> };
      }
    | {
          key: string;
          type: "tool";
          status: "completed";
          tool: string;
          data: { output: unknown; isError: boolean };
      }
    | {
          key: string;
          type: "compression";
          status: "running";
      }
    | {
          key: string;
          type: "compression";
          status: "completed";
          data?: { error?: string };
      }
    | {
          key: string;
          type: "renamed";
          data: { title: string };
      }
    | {
          key: string;
          type: "agentSwitched";
          data: { agentName: string };
      };

/**
 * Minimal turn shape for conversation history carried across agent runs.
 */
export interface AgentConversationTurn {
    role: "user" | "assistant";
    content: string;
}

/**
 * Optional cross-turn metadata for provider-specific conversation resumption.
 *
 * Not used by the in-memory {@link SessionManager}; kept for callers that bridge
 * provider conversation APIs alongside local session state.
 */
export interface AgentConversationContext {
    conversationId?: string;
    previousResponseId?: string;
    summary?: string;
    turns?: AgentConversationTurn[];
}

/**
 * Callback invoked as assistant text and coarse activity events arrive.
 */
export type ResponseEventListener = (
    event:
        | { type: "activity"; activity: AgentActivityEvent }
        | { type: "text"; message: string },
) => void;

/**
 * Async version of the forEach method.
 *
 * @param iterator - The async iterable to iterate over.
 * @param callback - The callback to invoke for each item.
 * @returns A promise that resolves when the iteration is complete.
 */
const asyncForEach = async <T>(
    iterator: AsyncIterable<T>,
    callback: (item: T) => Promise<void> | void,
) => {
    for await (const item of iterator) {
        await callback(item);
    }
};

/**
 * Adapts the LangChain v3 agent run stream into plain text chunks and
 * coarse-grained activity events that the application can render incrementally.
 */
export class ResponseStream {
    private outputText = "";
    private currentStep = 0;

    constructor(
        private readonly runResult: AgentRunStream,
        private readonly listener: ResponseEventListener,
    ) {}

    /**
     * Extracts plain text from a LangChain model response message.
     */
    static extractText(content: unknown) {
        if (typeof content === "string") {
            return content.trim();
        }

        if (!Array.isArray(content)) {
            return "";
        }

        return content
            .map((item) => {
                if (typeof item === "string") {
                    return item;
                }

                if (
                    item !== null &&
                    typeof item === "object" &&
                    "type" in item &&
                    "text" in item &&
                    item.type === "text" &&
                    typeof item.text === "string"
                ) {
                    return item.text;
                }

                return "";
            })
            .join("\n")
            .trim();
    }

    /**
     * Drains the LangChain agent run stream and forwards text deltas and activity events.
     *
     * Throws when either projection fails or the run rejects. Ignores unrecognized chunks.
     */
    async pumpStream() {
        await Promise.all([
            /**
             * Iterate over the messages in the run result.
             */
            asyncForEach(this.runResult.messages, async (message) => {
                this.currentStep += 1;

                this.listener({
                    type: "activity",
                    activity: {
                        key: `reasoning:step:${this.currentStep}`,
                        type: "reasoning",
                    },
                });

                if (message.reasoning) {
                    await asyncForEach(
                        message.reasoning,
                        async (reasoningChunk) => {
                            if (
                                typeof reasoningChunk === "string" &&
                                reasoningChunk.length > 0
                            ) {
                                this.listener({
                                    type: "activity",
                                    activity: {
                                        key: `reasoning:step:${this.currentStep}`,
                                        type: "reasoning",
                                        data: { text: reasoningChunk },
                                    },
                                });
                            }
                        },
                    );
                }

                await asyncForEach(message.text, async (token) => {
                    if (typeof token === "string" && token.length > 0) {
                        this.outputText += token;

                        this.listener({
                            type: "text",
                            message: token,
                        });
                    }
                });
            }),
            /**
             * Iterate over the tool calls in the run result.
             */
            asyncForEach(this.runResult.toolCalls, async (call) => {
                const id = call.callId ?? call.name;
                this.listener({
                    type: "activity",
                    activity: {
                        key: `tool:${id}`,
                        type: "tool",
                        status: "running",
                        tool: call.name,
                        data: {
                            arguments: call.input as Record<string, unknown>,
                        },
                    },
                });

                let output: unknown;
                let isError = false;

                try {
                    output = await call.output;
                } catch (error: unknown) {
                    output =
                        error instanceof Error ? error.message : String(error);
                    isError = true;
                }

                this.listener({
                    type: "activity",
                    activity: {
                        key: `tool:${id}`,
                        type: "tool",
                        status: "completed",
                        tool: call.name,
                        data: {
                            output,
                            isError,
                        },
                    },
                });
            }),
        ]);
    }

    /**
     * Sends an event to the listener to indicate that the session compression is running or completed.
     *
     * @param status The status of the session compression.
     */
    sendSessionCompressionEvent(status: "running" | "completed") {
        this.listener({
            type: "activity",
            activity: {
                key: "session:compression",
                type: "compression",
                status,
            },
        });
    }

    /**
     * Sends an event to the listener to indicate that the session has been renamed.
     *
     * @param title The new title of the session.
     */
    sendSessionRenamedEvent(title: string) {
        this.listener({
            type: "activity",
            activity: {
                key: "session:rename",
                type: "renamed",
                data: { title },
            },
        });
    }

    /**
     * Returns the accumulated assistant text emitted so far.
     *
     * Trimmed because the value is stored in session history and passed to
     * {@link SessionCompressor} after each turn.
     */
    getOutputText() {
        return this.outputText.trim();
    }
}
