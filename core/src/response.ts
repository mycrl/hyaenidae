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

export enum AskResponseResultEvent {
    REASONING_RUNNING = "reasoning_running",
    TOOL_RUNNING = "tool_running",
    TOOL_COMPLETED = "tool_completed",
    MESSAGE_COMPOSING_COMPLETED = "message_composing_completed",
    SESSION_COMPRESSION_RUNNING = "session_compression_running",
    SESSION_COMPRESSION_COMPLETED = "session_compression_completed",
    SESSION_RENAMED_COMPLETED = "session_renamed_completed",
}

interface CreateAskReponseResultOptions {
    step?: number;
    status?: AgentActivityEvent["status"];
    toolCallId?: string | undefined;
    toolName?: string | undefined;
    text?: string | undefined;
    input?: unknown;
    output?: unknown;
    title?: string | undefined;
    error?: string | undefined;
}

export const createAskReponseResult = (
    event: AskResponseResultEvent,
    options: CreateAskReponseResultOptions = {},
): AgentActivityEvent => {
    switch (event) {
        case AskResponseResultEvent.REASONING_RUNNING:
            return {
                key: `reasoning:step:${options.step ?? 0}`,
                kind: "reasoning",
                status: "running",
                name: "reasoning_started",
                ...(options.text === undefined
                    ? {}
                    : { data: { text: options.text } }),
            };
        case AskResponseResultEvent.TOOL_RUNNING:
            return {
                key: `tool:${String(options.toolCallId ?? options.toolName ?? "tool")}`,
                kind: "tool",
                status: "running",
                name: options.toolName ?? "tool",
                data: {
                    phase: "called",
                    arguments: options.input,
                },
            };
        case AskResponseResultEvent.TOOL_COMPLETED:
            return {
                key: `tool:${String(options.toolCallId ?? options.toolName ?? "tool")}`,
                kind: "tool",
                status: "completed",
                name: options.toolName ?? "tool",
                data: {
                    phase: "output",
                    output: options.output,
                    isError: false,
                },
            };
        case AskResponseResultEvent.MESSAGE_COMPOSING_COMPLETED:
            return {
                key: `message:step:${options.step ?? 0}`,
                kind: "status",
                status: "completed",
                name: "message_composing",
            };
        case AskResponseResultEvent.SESSION_COMPRESSION_RUNNING:
            return {
                key: "session:compression",
                kind: "status",
                status: "running",
                name: "session_compression",
            };
        case AskResponseResultEvent.SESSION_COMPRESSION_COMPLETED:
            return {
                key: "session:compression",
                kind: "status",
                status: "completed",
                name: "session_compression",
                ...(options.error === undefined
                    ? {}
                    : { data: { error: options.error } }),
            };
        case AskResponseResultEvent.SESSION_RENAMED_COMPLETED:
            return {
                key: "session:rename",
                kind: "status",
                status: "completed",
                name: "session_renamed",
                ...(options.title === undefined
                    ? {}
                    : { data: { title: options.title } }),
            };
    }
};

type HandledEvent =
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
 * Adapts the AI SDK stream into plain text chunks and coarse-grained activity
 * events that the application can render incrementally.
 */
export class AskResponse extends EventEmitter {
    private outputText = "";
    private currentStep = 0;
    private ended = false;

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
            for await (const event of this.runResult
                .fullStream as AsyncIterable<HandledEvent>) {
                if (
                    typeof event !== "object" ||
                    event === null ||
                    !("type" in event)
                ) {
                    continue;
                }

                switch (event.type) {
                    case "start-step":
                        this.currentStep += 1;

                        this.emit(
                            "activity",
                            createAskReponseResult(
                                AskResponseResultEvent.REASONING_RUNNING,
                                {
                                    step: this.currentStep,
                                },
                            ),
                        );

                        break;
                    case "reasoning-start":
                        this.emit(
                            "activity",
                            createAskReponseResult(
                                AskResponseResultEvent.REASONING_RUNNING,
                                {
                                    step: this.currentStep,
                                },
                            ),
                        );

                        break;
                    case "reasoning-delta":
                        this.emit(
                            "activity",
                            createAskReponseResult(
                                AskResponseResultEvent.REASONING_RUNNING,
                                {
                                    step: this.currentStep,
                                    text:
                                        event.text ??
                                        event.textDelta ??
                                        event.delta,
                                },
                            ),
                        );

                        break;
                    case "text-delta": {
                        const text =
                            event.text ?? event.textDelta ?? event.delta;

                        if (typeof text === "string" && text.length > 0) {
                            this.outputText += text;

                            this.emit("text", text);
                        }

                        break;
                    }
                    case "tool-call":
                        this.emit(
                            "activity",
                            createAskReponseResult(
                                AskResponseResultEvent.TOOL_RUNNING,
                                {
                                    toolCallId: event.toolCallId,
                                    toolName: event.toolName,
                                    input: event.input,
                                },
                            ),
                        );

                        break;
                    case "tool-result":
                        this.emit(
                            "activity",
                            createAskReponseResult(
                                AskResponseResultEvent.TOOL_COMPLETED,
                                {
                                    toolCallId: event.toolCallId,
                                    toolName: event.toolName,
                                    output: event.output,
                                },
                            ),
                        );

                        break;
                    case "error":
                        this.emit("error", event.error);

                        break;
                    case "finish-step":
                        this.emit(
                            "activity",
                            createAskReponseResult(
                                AskResponseResultEvent.MESSAGE_COMPOSING_COMPLETED,
                                {
                                    step: this.currentStep,
                                },
                            ),
                        );

                        break;
                }
            }

            this.emit("response-end");
        } catch (error) {
            this.emit("error", error);
        }
    }

    finish() {
        if (this.ended) {
            return;
        }

        this.ended = true;
        this.emit("end");
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
