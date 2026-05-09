import EventEmitter from "node:events";

export interface AgentActivityEvent {
    key: string;
    kind: "reasoning" | "tool" | "status";
    status: "running" | "completed";
    name: string;
    data?: unknown;
}

export interface AgentConversationTurn {
    role: "user" | "assistant";
    content: string;
}

interface AgentRunLike extends AsyncIterable<unknown> {
    completed: Promise<void>;
    state: {
        _conversationId: string | undefined;
        _previousResponseId: string | undefined;
    };
}

export interface AgentConversationContext {
    conversationId?: string;
    previousResponseId?: string;
    summary?: string;
    turns?: AgentConversationTurn[];
}

// Bridges the SDK's structured run events into app-friendly text and activity events.
export class AgentRunStream extends EventEmitter {
    private outputText = "";

    constructor(private readonly runResult: AgentRunLike) {
        super();
    }

    start() {
        void this.pump();
    }

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

    getOutputText() {
        return this.outputText.trim();
    }

    private async pump() {
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

    private handleEvent(event: unknown) {
        if (typeof event !== "object" || event === null || !("type" in event)) {
            return;
        }

        const eventType = (event as { type: string }).type;

        if (eventType === "raw_model_stream_event") {
            this.handleRawModelEvent(event as { data?: { type?: string; delta?: string } });
            return;
        }

        if (eventType === "run_item_stream_event") {
            this.handleRunItemEvent(
                event as {
                    name?: string;
                    item?: { toJSON?: () => { rawItem?: Record<string, unknown> } };
                },
            );
            return;
        }

        if (eventType === "agent_updated_stream_event") {
            const agentName = (event as { agent?: { name?: string } }).agent?.name;
            if (agentName) {
                this.emitActivity({
                    key: `agent:${agentName}:${Date.now()}`,
                    kind: "status",
                    status: "completed",
                    name: "agent_switched",
                    data: { agentName },
                });
            }
        }
    }

    private handleRawModelEvent(event: { data?: { type?: string; delta?: string } }) {
        if (event.data?.type === "output_text_delta" && typeof event.data.delta === "string") {
            this.outputText += event.data.delta;
            this.emit("text", event.data.delta);
        }
    }

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
            this.emitActivity({
                key: `reasoning:${Date.now()}`,
                kind: "reasoning",
                status: "running",
                name: "reasoning_started",
            });
            return;
        }

        if (name === "message_output_created") {
            this.emitActivity({
                key: `message:${Date.now()}`,
                kind: "status",
                status: "running",
                name: "message_composing",
            });
            return;
        }

        if (name === "tool_called") {
            const toolName = typeof rawItem.name === "string" ? rawItem.name : "tool";
            this.emitActivity({
                key: `tool:${String(rawItem.callId ?? rawItem.call_id ?? toolName)}`,
                kind: "tool",
                status: "running",
                name: toolName,
                data: {
                    phase: "called",
                    arguments: rawItem.arguments,
                },
            });
            return;
        }

        if (name === "tool_output") {
            const toolName = typeof rawItem.name === "string" ? rawItem.name : "tool";
            this.emitActivity({
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

    private emitActivity(activity: AgentActivityEvent) {
        this.emit("activity", activity);
    }
}
