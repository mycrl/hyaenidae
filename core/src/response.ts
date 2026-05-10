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
 * Internal shape required from the SDK run object consumed by AgentRunStream.
 */
interface AgentRunLike extends AsyncIterable<unknown> {
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
export class AgentRunStream extends EventEmitter {
    private outputText = "";

    constructor(private readonly runResult: AgentRunLike) {
        super();
    }

    /**
     * Starts consuming the underlying async run stream.
     */
    start() {
        this.pump();
    }

    /**
     * Returns the conversation identifiers needed to continue this run later.
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
     */
    getOutputText() {
        return this.outputText.trim();
    }

    /**
     * Drains the SDK stream and republishes terminal events for the app layer.
     */
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

    /**
     * Routes a raw SDK event to the appropriate local handler.
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
            this.emitActivity({
                key: `reasoning:${Date.now()}`,
                kind: "reasoning",
                status: "running",
                name: "reasoning_started",
            });
        } else if (name === "message_output_created") {
            this.emitActivity({
                key: `message:${Date.now()}`,
                kind: "status",
                status: "running",
                name: "message_composing",
            });
        } else if (name === "tool_called") {
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
        } else if (name === "tool_output") {
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

    /**
     * Emits a normalized activity event for app consumers.
     */
    private emitActivity(activity: AgentActivityEvent) {
        this.emit("activity", activity);
    }
}

/**
 * Extracts the final human-readable text body from a Responses API payload.
 */
export function extractResponseText(response: unknown) {
    if (typeof response !== "object" || response === null) {
        return "";
    }

    const outputText = (response as { output_text?: string }).output_text;
    if (typeof outputText === "string" && outputText.length > 0) {
        return outputText;
    }

    const output = (response as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
    if (!Array.isArray(output)) {
        return "";
    }

    return output
        .flatMap((item) => item.content ?? [])
        .map((item) => item.text)
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .join("\n")
        .trim();
}
