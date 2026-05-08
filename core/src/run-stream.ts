import EventEmitter from "node:events";

export interface AgentActivityEvent {
    key: string;
    kind: "reasoning" | "tool" | "status";
    status: "running" | "completed";
    title: string;
    detail?: string;
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
}

const MAX_DETAIL_LENGTH = 240;

const truncate = (value: string) =>
    value.length <= MAX_DETAIL_LENGTH ? value : `${value.slice(0, MAX_DETAIL_LENGTH)}...`;

const safeStringify = (value: unknown) => {
    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const parseJsonString = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        return undefined;
    }

    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return undefined;
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

class ActivityTextFormatter {
    private readonly isChinese: boolean;

    constructor(locale: string) {
        this.isChinese = locale.trim().toLowerCase().startsWith("zh");
    }

    private tabSummary(tab: Record<string, unknown>) {
        const title =
            typeof tab.title === "string" && tab.title.trim() ? tab.title.trim() : undefined;
        const url = typeof tab.url === "string" && tab.url.trim() ? tab.url.trim() : undefined;
        const isLoading = tab.isLoading === true;

        if (this.isChinese) {
            if (title && url) {
                return `${title} (${url})${isLoading ? "，加载中" : ""}`;
            }

            if (title) {
                return `${title}${isLoading ? "，加载中" : ""}`;
            }

            if (url) {
                return `${url}${isLoading ? "，加载中" : ""}`;
            }

            return isLoading ? "标签页正在加载" : undefined;
        }

        if (title && url) {
            return `${title} (${url})${isLoading ? ", loading" : ""}`;
        }

        if (title) {
            return `${title}${isLoading ? ", loading" : ""}`;
        }

        if (url) {
            return `${url}${isLoading ? ", loading" : ""}`;
        }

        return isLoading ? "Tab is loading" : undefined;
    }

    private summarizeToolArguments(args: unknown) {
        const normalized = typeof args === "string" ? (parseJsonString(args) ?? args) : args;

        if (typeof normalized === "string") {
            const compact = normalized.trim();
            return compact ? truncate(compact) : undefined;
        }

        if (!isRecord(normalized)) {
            return undefined;
        }

        if (typeof normalized.url === "string" && normalized.url.trim()) {
            return truncate(normalized.url.trim());
        }

        if (typeof normalized.description === "string" && normalized.description.trim()) {
            return this.isChinese
                ? `目标：${truncate(normalized.description.trim())}`
                : `Target: ${truncate(normalized.description.trim())}`;
        }

        if (typeof normalized.prompt === "string" && normalized.prompt.trim()) {
            return this.isChinese
                ? `检查：${truncate(normalized.prompt.trim())}`
                : `Inspect: ${truncate(normalized.prompt.trim())}`;
        }

        if (typeof normalized.selector === "string" && normalized.selector.trim()) {
            return this.isChinese
                ? `目标元素：${truncate(normalized.selector.trim())}`
                : `Element: ${truncate(normalized.selector.trim())}`;
        }

        if (typeof normalized.x === "number" && typeof normalized.y === "number") {
            return this.isChinese
                ? `位置：(${Math.round(normalized.x)}, ${Math.round(normalized.y)})`
                : `Position: (${Math.round(normalized.x)}, ${Math.round(normalized.y)})`;
        }

        if (typeof normalized.tabId === "number") {
            return this.isChinese ? `标签页 ${normalized.tabId}` : `Tab ${normalized.tabId}`;
        }

        if (typeof normalized.action === "string") {
            return this.isChinese ? `动作：${normalized.action}` : `Action: ${normalized.action}`;
        }

        return undefined;
    }

    private summarizeToolOutput(output: unknown) {
        const normalized =
            typeof output === "string" ? (parseJsonString(output) ?? output) : output;

        if (typeof normalized === "string") {
            const compact = normalized.trim();
            if (!compact) {
                return undefined;
            }

            if (compact.startsWith("{") || compact.startsWith("[")) {
                return undefined;
            }

            return truncate(compact);
        }

        if (Array.isArray(normalized)) {
            if (normalized.length === 0) {
                return undefined;
            }

            return this.isChinese
                ? `返回了 ${normalized.length} 条结果`
                : `Returned ${normalized.length} result(s)`;
        }

        if (!isRecord(normalized)) {
            return undefined;
        }

        if (isRecord(normalized.tab)) {
            return this.tabSummary(normalized.tab);
        }

        if (Array.isArray(normalized.tabs)) {
            const tabs = normalized.tabs.filter(isRecord);
            if (tabs.length === 0) {
                return undefined;
            }

            const focusedTab = tabs.find((tab) => tab.isFocused === true);
            const focusedSummary = focusedTab ? this.tabSummary(focusedTab) : undefined;
            if (this.isChinese) {
                return focusedSummary
                    ? `当前共 ${tabs.length} 个标签页，活动页为 ${focusedSummary}`
                    : `当前共 ${tabs.length} 个标签页`;
            }

            return focusedSummary
                ? `${tabs.length} tab(s), active: ${focusedSummary}`
                : `${tabs.length} tab(s)`;
        }

        if (Array.isArray(normalized.matches)) {
            const count = normalized.matches.length;
            return this.isChinese
                ? `找到 ${count} 个候选目标`
                : `Found ${count} candidate target(s)`;
        }

        if (typeof normalized.analysis === "string" && normalized.analysis.trim()) {
            return truncate(normalized.analysis.trim());
        }

        if (typeof normalized.details === "string" && normalized.details.trim()) {
            return truncate(normalized.details.trim());
        }

        if (typeof normalized.result === "string" && normalized.result.trim()) {
            return truncate(normalized.result.trim());
        }

        if (normalized.ok === true) {
            return this.isChinese ? "已完成" : "Completed";
        }

        return undefined;
    }

    reasoning(status: "running" | "completed") {
        if (this.isChinese) {
            return {
                title: status === "running" ? "正在分析下一步" : "已完成当前分析",
            };
        }

        return {
            title: status === "running" ? "Analyzing next step" : "Finished analysis",
        };
    }

    toolCall(name: string, args: unknown) {
        const detail = this.summarizeToolArguments(args);

        if (this.isChinese) {
            return {
                title: `调用工具 ${name}`,
                ...(detail === undefined ? {} : { detail }),
            };
        }

        return {
            title: `Calling ${name}`,
            ...(detail === undefined ? {} : { detail }),
        };
    }

    toolOutput(name: string, output: unknown) {
        const detail = this.summarizeToolOutput(output);

        if (this.isChinese) {
            return {
                title: `${name} 已完成`,
                ...(detail === undefined ? {} : { detail }),
            };
        }

        return {
            title: `${name} completed`,
            ...(detail === undefined ? {} : { detail }),
        };
    }

    composing() {
        return {
            title: this.isChinese ? "正在整理回复" : "Composing response",
        };
    }

    switchedAgent(name: string) {
        return {
            title: this.isChinese ? `切换到 ${name}` : `Switched to ${name}`,
        };
    }
}

// Bridges the SDK's structured run events into app-friendly text and activity events.
export class AgentRunStream extends EventEmitter {
    private readonly formatter: ActivityTextFormatter;

    constructor(
        private readonly runResult: AgentRunLike,
        locale: string,
    ) {
        super();
        this.formatter = new ActivityTextFormatter(locale);
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
                    ...this.formatter.switchedAgent(agentName),
                });
            }
        }
    }

    private handleRawModelEvent(event: { data?: { type?: string; delta?: string } }) {
        if (event.data?.type === "output_text_delta" && typeof event.data.delta === "string") {
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
                ...this.formatter.reasoning("running"),
            });
            return;
        }

        if (name === "message_output_created") {
            this.emitActivity({
                key: `message:${Date.now()}`,
                kind: "status",
                status: "running",
                ...this.formatter.composing(),
            });
            return;
        }

        if (name === "tool_called") {
            const toolName = typeof rawItem.name === "string" ? rawItem.name : "tool";
            this.emitActivity({
                key: `tool:${String(rawItem.callId ?? rawItem.call_id ?? toolName)}`,
                kind: "tool",
                status: "running",
                ...this.formatter.toolCall(toolName, rawItem.arguments),
            });
            return;
        }

        if (name === "tool_output") {
            const toolName = typeof rawItem.name === "string" ? rawItem.name : "tool";
            this.emitActivity({
                key: `tool:${String(rawItem.callId ?? rawItem.call_id ?? toolName)}`,
                kind: "tool",
                status: "completed",
                ...this.formatter.toolOutput(toolName, rawItem.output),
            });
        }
    }

    private emitActivity(activity: AgentActivityEvent) {
        this.emit("activity", activity);
    }
}
