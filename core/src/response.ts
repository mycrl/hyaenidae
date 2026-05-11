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
 * Internal subset of the SDK run object consumed by AskResponse.
 *
 * The wrapper only depends on async iteration, completion, and the resumable
 * conversation identifiers, which keeps this contract small and easy to adapt.
 */
interface AskResponseLike extends AsyncIterable<unknown> {
    completed: Promise<void>;
    state: {
        _conversationId: string | undefined;
        _previousResponseId: string | undefined;
    };
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

/**
 * Adapts the OpenAI Agents run stream into plain text chunks and coarse-grained
 * activity events that the application can render incrementally.
 */
export class AskResponse extends EventEmitter {
    private outputText = "";

    constructor(private readonly runResult: AskResponseLike) {
        super();
    }

    /**
     * Routes a raw SDK event to the narrow local handler that understands it.
     *
     * Unknown event shapes are ignored on purpose so SDK additions do not break
     * the UI stream adapter.
     */
    private handleEvent(event: unknown) {
        if (typeof event !== "object" || event === null || !("type" in event)) {
            return;
        }

        const eventType = (event as { type: string }).type;

        if (eventType === "raw_model_stream_event") {
            this.handleRawModelEvent(event as { data?: { type?: string; delta?: string } });
        } else if (eventType === "run_item_stream_event") {
            this.handleRunItemEvent(
                event as {
                    name?: string;
                    item?: { toJSON?: () => { rawItem?: Record<string, unknown> } };
                },
            );
        } else if (eventType === "agent_updated_stream_event") {
            const agentName = (event as { agent?: { name?: string } }).agent?.name;

            if (agentName) {
                this.emit("activity", {
                    key: `agent:${agentName}:${Date.now()}`,
                    kind: "status",
                    status: "completed",
                    name: "agent_switched",
                    data: { agentName },
                });
            }
        }
    }

    /**
     * Handles incremental text deltas from the model stream.
     */
    private handleRawModelEvent(event: { data?: { type?: string; delta?: string } }) {
        if (event.data?.type === "output_text_delta" && typeof event.data.delta === "string") {
            this.outputText += event.data.delta;

            this.emit("text", event.data.delta);
        }
    }

    /**
     * Translates structured run items such as reasoning and tool activity into
     * UI-facing activity notifications.
     */
    private handleRunItemEvent(event: {
        name?: string;
        item?: { toJSON?: () => { rawItem?: Record<string, unknown> } };
    }) {
        const name = event.name;
        const rawItem = event.item?.toJSON?.().rawItem;
        if (!name || !rawItem) {
            return;
        }

        if (name === "reasoning_item_created") {
            this.emit("activity", {
                key: `reasoning:${Date.now()}`,
                kind: "reasoning",
                status: "running",
                name: "reasoning_started",
            });
        } else if (name === "message_output_created") {
            this.emit("activity", {
                key: `message:${Date.now()}`,
                kind: "status",
                status: "running",
                name: "message_composing",
            });
        } else if (name === "tool_called") {
            const toolName = typeof rawItem.name === "string" ? rawItem.name : "tool";

            this.emit("activity", {
                key: `tool:${String(rawItem.callId ?? rawItem.call_id ?? toolName)}`,
                kind: "tool",
                status: "running",
                name: toolName,
                data: {
                    phase: "called",
                    arguments: rawItem.arguments,
                },
            });
        } else if (name === "tool_output") {
            const toolName = typeof rawItem.name === "string" ? rawItem.name : "tool";

            this.emit("activity", {
                key: `tool:${String(rawItem.callId ?? rawItem.call_id ?? toolName)}`,
                kind: "tool",
                status: "completed",
                name: toolName,
                data: {
                    phase: "output",
                    output: rawItem.output,
                },
            });
        }
    }

    /**
     * Starts draining the underlying SDK stream.
     *
     * This method is fire-and-forget from the caller's perspective. Consumers
     * should listen to emitted events instead of awaiting intermediate progress.
     */
    async start() {
        try {
            for await (const event of this.runResult) {
                this.handleEvent(event);
            }

            await this.runResult.completed;
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
        return {
            ...(this.runResult.state._conversationId === undefined
                ? {}
                : { conversationId: this.runResult.state._conversationId }),
            ...(this.runResult.state._previousResponseId === undefined
                ? {}
                : { previousResponseId: this.runResult.state._previousResponseId }),
        };
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
