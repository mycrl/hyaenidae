import type { TFunction } from "i18next";
import type { AgentActivity } from "../../services/agent.state";

const MAX_DETAIL_LENGTH = 240;

const truncate = (value: string) =>
    value.length <= MAX_DETAIL_LENGTH
        ? value
        : `${value.slice(0, MAX_DETAIL_LENGTH)}...`;

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

const summarizeTab = (tab: Record<string, unknown>) => {
    const title =
        typeof tab.title === "string" && tab.title.trim()
            ? tab.title.trim()
            : undefined;
    const url =
        typeof tab.url === "string" && tab.url.trim()
            ? tab.url.trim()
            : undefined;
    const isLoading = tab.isLoading === true;

    if (title && url) {
        return `${title} (${url})${isLoading ? " • loading" : ""}`;
    }

    if (title) {
        return `${title}${isLoading ? " • loading" : ""}`;
    }

    if (url) {
        return `${url}${isLoading ? " • loading" : ""}`;
    }

    return isLoading ? "Loading" : undefined;
};

const summarizeToolArguments = (args: unknown) => {
    const normalized =
        typeof args === "string" ? (parseJsonString(args) ?? args) : args;

    if (typeof normalized === "string") {
        return normalized.trim() ? truncate(normalized.trim()) : undefined;
    }

    if (!isRecord(normalized)) {
        return undefined;
    }

    if (typeof normalized.url === "string" && normalized.url.trim()) {
        return truncate(normalized.url.trim());
    }

    if (
        typeof normalized.description === "string" &&
        normalized.description.trim()
    ) {
        return truncate(normalized.description.trim());
    }

    if (typeof normalized.prompt === "string" && normalized.prompt.trim()) {
        return truncate(normalized.prompt.trim());
    }

    if (typeof normalized.selector === "string" && normalized.selector.trim()) {
        return truncate(normalized.selector.trim());
    }

    if (typeof normalized.x === "number" && typeof normalized.y === "number") {
        return `(${Math.round(normalized.x)}, ${Math.round(normalized.y)})`;
    }

    if (typeof normalized.action === "string") {
        return normalized.action;
    }

    if (typeof normalized.tabId === "number") {
        return `Tab ${normalized.tabId}`;
    }

    return undefined;
};

const summarizeToolOutput = (output: unknown) => {
    const normalized =
        typeof output === "string"
            ? (parseJsonString(output) ?? output)
            : output;

    if (typeof normalized === "string") {
        const compact = normalized.trim();
        if (!compact || compact.startsWith("{") || compact.startsWith("[")) {
            return undefined;
        }

        return truncate(compact);
    }

    if (Array.isArray(normalized)) {
        return normalized.length > 0
            ? `${normalized.length} result(s)`
            : undefined;
    }

    if (!isRecord(normalized)) {
        return undefined;
    }

    if (isRecord(normalized.tab)) {
        return summarizeTab(normalized.tab);
    }

    if (Array.isArray(normalized.tabs)) {
        return `${normalized.tabs.length} tab(s)`;
    }

    if (Array.isArray(normalized.matches)) {
        return `${normalized.matches.length} candidate target(s)`;
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

    return undefined;
};

/** Whether the activity row should show the in-progress indicator. */
export const isAgentActivityRunning = (activity: AgentActivity) =>
    (activity.type === "tool" && activity.status === "running") ||
    (activity.type === "compression" && activity.status === "running");

export const formatAgentActivity = (activity: AgentActivity, t: TFunction) => {
    switch (activity.type) {
        case "reasoning":
            return {
                title: t("chat.activityLabels.reasoningRunning"),
            };

        case "tool": {
            if (activity.status === "running") {
                const detail = summarizeToolArguments(activity.data.arguments);

                return {
                    title: t("chat.activityLabels.toolCalling", {
                        name: activity.tool,
                    }),
                    ...(detail === undefined ? {} : { detail }),
                };
            }

            const detail = summarizeToolOutput(activity.data.output);

            return {
                title: t("chat.activityLabels.toolCompleted", {
                    name: activity.tool,
                }),
                ...(detail === undefined ? {} : { detail }),
            };
        }

        case "compression":
            if (activity.status === "running") {
                return {
                    title: t("chat.activityLabels.compressionRunning"),
                };
            }

            return {
                title: t("chat.activityLabels.compressionCompleted"),
                ...(activity.data?.error?.trim()
                    ? { detail: truncate(activity.data.error.trim()) }
                    : {}),
            };

        case "renamed":
            return {
                title: t("chat.activityLabels.renamed"),
                ...(activity.data.title.trim()
                    ? { detail: truncate(activity.data.title.trim()) }
                    : {}),
            };

        case "agentSwitched":
            return {
                title: t("chat.activityLabels.agentSwitched", {
                    name: activity.data.agentName,
                }),
            };
    }
};
