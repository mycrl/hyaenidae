/**
 * Stream adapters and shared event types for agent output.
 */

/**
 * UI-facing activity item emitted while an agent run is progressing.
 */
export interface AgentActivityEvent {
    key: string;
    kind: "reasoning" | "tool" | "status";
    status: "running" | "completed";
    name: string;
    data?: unknown;
}

/**
 * Minimal turn shape for conversation history carried across agent runs.
 */
export interface AgentConversationTurn {
    role: "user" | "assistant";
    content: string;
}

/**
 * Minimal `streamText` surface consumed by {@link ResponseStream}.
 */
interface StreamTextResultLike {
    fullStream: AsyncIterable<unknown>;
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
 * Normalized subset of AI SDK stream events handled by {@link ResponseStream}.
 */
type AgentStreamEvent =
    | {
          type:
              | "start-step"
              | "reasoning-start"
              | "reasoning-delta"
              | "text-delta"
              | "finish-step";
          text?: string;
          textDelta?: string;
          delta?: string;
      }
    | {
          type: "tool-call";
          toolCallId?: string;
          toolName?: string;
          input?: unknown;
      }
    | {
          type: "tool-result";
          toolCallId?: string;
          toolName?: string;
          output?: unknown;
      }
    | {
          type: "error";
          error?: unknown;
      };

/**
 * Callback invoked as assistant text and coarse activity events arrive.
 */
export type ResponseEventListener = (
    event:
        | { type: "activity"; activity: AgentActivityEvent }
        | { type: "text"; message: string },
) => void;

/**
 * Adapts the AI SDK stream into plain text chunks and coarse-grained activity
 * events that the application can render incrementally.
 */
export class ResponseStream {
    private outputText = "";
    private currentStep = 0;

    constructor(
        private readonly runResult: StreamTextResultLike,
        private readonly listener: ResponseEventListener,
    ) {}

    /**
     * Drains the AI SDK stream and forwards text deltas and activity events.
     *
     * Throws when the stream emits an error event. Ignores unrecognized chunks.
     */
    async pumpStream() {
        for await (const event of this.runResult
            .fullStream as AsyncIterable<AgentStreamEvent>) {
            if (
                typeof event !== "object" ||
                event === null ||
                !("type" in event)
            ) {
                continue;
            }

            switch (event.type) {
                case "start-step":
                case "reasoning-start":
                case "reasoning-delta":
                    const text = event.text ?? event.textDelta ?? event.delta;

                    if (event.type === "start-step") {
                        this.currentStep += 1;
                    }

                    this.listener({
                        type: "activity",
                        activity: {
                            key: `reasoning:step:${this.currentStep}`,
                            kind: "reasoning",
                            status: "running",
                            name: "reasoning_started",
                            ...(text === undefined ? {} : { data: { text } }),
                        },
                    });

                    break;
                case "text-delta": {
                    const message =
                        event.text ?? event.textDelta ?? event.delta;

                    if (typeof message === "string" && message.length > 0) {
                        this.outputText += message;

                        this.listener({
                            type: "text",
                            message,
                        });
                    }

                    break;
                }
                case "tool-call":
                    this.listener({
                        type: "activity",
                        activity: {
                            key: `tool:${String(event.toolCallId ?? event.toolName ?? "tool")}`,
                            kind: "tool",
                            status: "running",
                            name: event.toolName ?? "tool",
                            data: {
                                phase: "called",
                                arguments: event.input,
                            },
                        },
                    });

                    break;
                case "tool-result":
                    this.listener({
                        type: "activity",
                        activity: {
                            key: `tool:${String(event.toolCallId ?? event.toolName ?? "tool")}`,
                            kind: "tool",
                            status: "completed",
                            name: event.toolName ?? "tool",
                            data: {
                                phase: "output",
                                output: event.output,
                                isError: false,
                            },
                        },
                    });

                    break;

                case "finish-step":
                    this.listener({
                        type: "activity",
                        activity: {
                            key: `message:step:${this.currentStep}`,
                            kind: "status",
                            status: "completed",
                            name: "message_composing",
                        },
                    });

                    break;
                case "error":
                    throw new Error(String(event.error));
            }
        }
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
                kind: "status",
                name: "session_compression",
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
                kind: "status",
                status: "completed",
                name: "session_renamed",
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
