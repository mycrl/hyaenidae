import { tool } from "@openai/agents";
import { z as zod } from "zod";
import { AgentAskSession } from "../ask";

/**
 * Creates tab lifecycle and navigation tools.
 */
export const createTabTools = (agentAskSession: AgentAskSession) => [
    tool({
        name: "list_tabs",
        description: "List all open browser tabs with focus and loading state.",
        parameters: zod.object({}),
        execute: async () => ({
            tabs: await agentAskSession.browserRuntime.listTabs(),
        }),
    }),
    tool({
        name: "open_tab",
        description: "Open a new browser tab and optionally load a URL.",
        parameters: zod.object({
            url: zod
                .string()
                .nullable()
                .describe("Optional URL to load in the new tab. Use null for a blank tab."),
        }),
        execute: async ({ url }) => ({
            tab: await agentAskSession.browserRuntime.openTab(url ?? undefined),
        }),
    }),
    tool({
        name: "focus_tab",
        description: "Focus an existing tab so subsequent actions target it.",
        parameters: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => ({
            tab: await agentAskSession.browserRuntime.focusTab(tabId),
        }),
    }),
    tool({
        name: "close_tab",
        description: "Close a browser tab that is no longer needed.",
        parameters: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await agentAskSession.browserRuntime.closeTab(tabId);

            return { ok: true, tabId };
        },
    }),
    tool({
        name: "load_url",
        description: "Navigate a tab to a URL.",
        parameters: zod
            .object({
                tabId: zod.number().describe("The target tab id."),
            })
            .extend({
                url: zod.string().describe("The URL to load."),
            }),
        execute: async ({ tabId, url }) => ({
            tab: await agentAskSession.browserRuntime.load(tabId, url),
        }),
    }),
    tool({
        name: "reload_tab",
        description: "Reload a tab.",
        parameters: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await agentAskSession.browserRuntime.reload(tabId);

            return { ok: true, tabId };
        },
    }),
    tool({
        name: "go_back",
        description: "Navigate backward in tab history.",
        parameters: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await agentAskSession.browserRuntime.goBack(tabId);

            return { ok: true, tabId };
        },
    }),
    tool({
        name: "go_forward",
        description: "Navigate forward in tab history.",
        parameters: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await agentAskSession.browserRuntime.goForward(tabId);

            return { ok: true, tabId };
        },
    }),
];
