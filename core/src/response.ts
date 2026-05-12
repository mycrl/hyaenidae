import EventEmitter from "node:events";

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
 * Minimal persisted turn shape used for prompt history and session summaries.
 */
export interface AgentConversationTurn {
    role: "user" | "assistant";
    content: string;
}

/**
 * Internal subset of the AI SDK stream result consumed by AskResponse.
 */
interface AskResponseLike {
    fullStream: AsyncIterable<unknown>;
}

/**
 * Resumable conversation metadata stored between streamed agent invocations.
 */
export interface AgentConversationContext {
    conversationId?: string;
    previousResponseId?: string;
    summary?: string;
    turns?: AgentConversationTurn[];
}

type HandledEvent =
    | {
          type: "start-step" | "reasoning-start" | "reasoning-delta" | "text-delta" | "finish-step";
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
 * Adapts the AI SDK stream into plain text chunks and coarse-grained activity
 * events that the application can render incrementally.
 */
export class AskResponse extends EventEmitter {
    private outputText = "";
    private currentStep = 0;

    constructor(private readonly runResult: AskResponseLike) {
        super();
    }

    /**
     * Starts draining the underlying SDK stream.
     *
     * This method is fire-and-forget from the caller's perspective. Consumers
     * should listen to emitted events instead of awaiting intermediate progress.
     */
    async start() {
        try {
            for await (const event of this.runResult.fullStream as AsyncIterable<HandledEvent>) {
                if (typeof event !== "object" || event === null || !("type" in event)) {
                    continue;
                }

                switch (event.type) {
                    case "start-step":
                        this.currentStep += 1;

                        this.emit("activity", {
                            key: `reasoning:step:${this.currentStep}`,
                            kind: "reasoning",
                            status: "running",
                            name: "reasoning_started",
                        });

                        break;
                    case "reasoning-start":
                        this.emit("activity", {
                            key: `reasoning:step:${this.currentStep}`,
                            kind: "reasoning",
                            status: "running",
                            name: "reasoning_started",
                        });

                        break;
                    case "reasoning-delta":
                        this.emit("activity", {
                            key: `reasoning:step:${this.currentStep}`,
                            kind: "reasoning",
                            status: "running",
                            name: "reasoning_started",
                            data: {
                                text: event.text ?? event.textDelta ?? event.delta,
                            },
                        });

                        break;
                    case "text-delta": {
                        const text = event.text ?? event.textDelta ?? event.delta;

                        if (typeof text === "string" && text.length > 0) {
                            this.outputText += text;

                            this.emit("text", text);
                        }

                        break;
                    }
                    case "tool-call":
                        this.emit("activity", {
                            key: `tool:${String(event.toolCallId ?? event.toolName ?? "tool")}`,
                            kind: "tool",
                            status: "running",
                            name: event.toolName ?? "tool",
                            data: {
                                phase: "called",
                                arguments: event.input,
                            },
                        });

                        break;
                    case "tool-result":
                        this.emit("activity", {
                            key: `tool:${String(event.toolCallId ?? event.toolName ?? "tool")}`,
                            kind: "tool",
                            status: "completed",
                            name: event.toolName ?? "tool",
                            data: {
                                phase: "output",
                                output: event.output,
                                isError: false,
                            },
                        });

                        break;
                    case "error":
                        this.emit("error", event.error);

                        break;
                    case "finish-step":
                        this.emit("activity", {
                            key: `message:step:${this.currentStep}`,
                            kind: "status",
                            status: "completed",
                            name: "message_composing",
                        });

                        break;
                }
            }

            this.emit("end");
        } catch (error) {
            this.emit("error", error);
        }
    }

    /**
     * Returns the resumable conversation identifiers produced by the SDK run.
     *
     * These identifiers are intentionally separated from the streamed text so
     * session persistence can resume future turns even if no assistant text was
     * emitted yet.
     */
    getConversationContext(): AgentConversationContext {
        return {};
    }

    /**
     * Returns the accumulated assistant text emitted so far.
     *
     * The value is trimmed because it is persisted back into session history and
     * later fed into summarization.
     */
    getOutputText() {
        return this.outputText.trim();
    }
}
