import { tool } from "@openai/agents";
import { z } from "zod";
import { BrowserRuntime } from "./browser";

export interface VisionInspector {
    inspect(input: { prompt: string; tabId?: number }): Promise<{
        tabId: number;
        analysis: string;
        width: number;
        height: number;
    }>;
}

const emptySchema = z.object({});
const tabIdSchema = z.object({
    tabId: z.number().describe("The target tab id."),
});

const optionalTabIdSchema = z.object({
    tabId: z.number().nullable().describe("Optional tab id. Use null to target the focused tab."),
});

const withOptional = <T extends z.ZodRawShape, U extends z.ZodRawShape>(
    base: z.ZodObject<T>,
    extra: z.ZodObject<U>,
) => base.extend(extra.shape);

// Keep tool definitions centralized so the agent's browser capability surface stays explicit.
export const createTools = (browser: BrowserRuntime, visionInspector: VisionInspector) => [
    tool({
        name: "list_tabs",
        description: "List all open browser tabs with focus and loading state.",
        parameters: emptySchema,
        execute: async () => {
            return { tabs: await browser.listTabs() };
        },
    }),
    tool({
        name: "open_tab",
        description: "Open a new browser tab and optionally load a URL.",
        parameters: z.object({
            url: z
                .string()
                .nullable()
                .describe("Optional URL to load in the new tab. Use null for a blank tab."),
        }),
        execute: async ({ url }) => {
            return { tab: await browser.openTab(url ?? undefined) };
        },
    }),
    tool({
        name: "focus_tab",
        description: "Focus an existing tab so subsequent actions target it.",
        parameters: tabIdSchema,
        execute: async ({ tabId }) => ({
            tab: await browser.focusTab(tabId),
        }),
    }),
    tool({
        name: "close_tab",
        description: "Close a browser tab that is no longer needed.",
        parameters: tabIdSchema,
        execute: async ({ tabId }) => {
            await browser.closeTab(tabId);
            return { ok: true, tabId };
        },
    }),
    tool({
        name: "load_url",
        description: "Navigate a tab to a URL.",
        parameters: tabIdSchema.extend({
            url: z.string().describe("The URL to load."),
        }),
        execute: async ({ tabId, url }) => ({
            tab: await browser.load(tabId, url),
        }),
    }),
    tool({
        name: "reload_tab",
        description: "Reload a tab.",
        parameters: tabIdSchema,
        execute: async ({ tabId }) => {
            await browser.reload(tabId);
            return { ok: true, tabId };
        },
    }),
    tool({
        name: "go_back",
        description: "Navigate backward in tab history.",
        parameters: tabIdSchema,
        execute: async ({ tabId }) => {
            await browser.goBack(tabId);
            return { ok: true, tabId };
        },
    }),
    tool({
        name: "go_forward",
        description: "Navigate forward in tab history.",
        parameters: tabIdSchema,
        execute: async ({ tabId }) => {
            await browser.goForward(tabId);
            return { ok: true, tabId };
        },
    }),
    tool({
        name: "snapshot_dom",
        description:
            "Read the current page using a compact DOM snapshot plus accessibility data. Good for selectors and semantic structure, but it may miss visually obvious answer cards or rich widgets. If the snapshot does not answer the question and the missing information may be visible on screen but underrepresented in DOM mode, use inspect_vision.",
        parameters: optionalTabIdSchema,
        execute: async ({ tabId }) => browser.snapshotDom(tabId ?? undefined),
    }),
    tool({
        name: "inspect_vision",
        description:
            "Capture a screenshot and inspect what is visibly rendered on the page. Use this for search result answer cards, weather widgets, charts, maps, popovers, canvas content, or when compact DOM data is insufficient or ambiguous.",
        parameters: withOptional(
            optionalTabIdSchema,
            z.object({
                prompt: z
                    .string()
                    .describe(
                        "What to inspect in the screenshot, such as 'read the visible weather card for New York and summarize the current conditions' or 'find the primary login button and describe nearby text'.",
                    ),
            }),
        ),
        execute: async ({ tabId, prompt }) =>
            visionInspector.inspect(tabId == null ? { prompt } : { prompt, tabId }),
    }),
    tool({
        name: "capture_vision",
        description: "Capture a raw screenshot for debugging or external inspection.",
        parameters: optionalTabIdSchema,
        execute: async ({ tabId }) => browser.captureScreenshot(tabId ?? undefined),
    }),
    tool({
        name: "ground_from_vision",
        description:
            "Resolve a visual description to likely DOM selectors or targets before clicking or typing. The returned point is only a backup when DOM selectors fail.",
        parameters: withOptional(
            optionalTabIdSchema,
            z.object({
                description: z
                    .string()
                    .describe(
                        "Human description of the visual target, such as 'blue Sign in button in header'.",
                    ),
            }),
        ),
        execute: async ({ tabId, description }) => ({
            matches: await browser.groundFromVision(
                tabId == null ? { description } : { tabId, description },
            ),
        }),
    }),
    tool({
        name: "run_tab_script",
        description:
            "Run a short script inside the tab to inspect or automate page state. Prefer read-only scripts unless an explicit mutation is needed.",
        parameters: withOptional(
            optionalTabIdSchema,
            z.object({
                script: z
                    .string()
                    .describe(
                        "JavaScript source evaluated in the page context. Return structured JSON-safe data when possible.",
                    ),
                args: z
                    .array(z.unknown())
                    .nullable()
                    .describe(
                        "Optional arguments passed to the script. Use null when no arguments are needed.",
                    ),
            }),
        ),
        execute: async ({ tabId, script, args }) =>
            browser.runScript(
                tabId == null
                    ? args == null
                        ? { script }
                        : { script, args }
                    : args == null
                      ? { tabId, script }
                      : { tabId, script, args },
            ),
    }),
    tool({
        name: "act_on_page",
        description:
            "Perform a concrete DOM-grounded page action such as click, type, or scroll. Prefer this over point-based actions.",
        parameters: withOptional(
            optionalTabIdSchema,
            z.object({
                action: z.enum(["click", "type", "scroll"]).describe("The action to perform."),
                selector: z
                    .string()
                    .nullable()
                    .describe(
                        "A CSS selector for click or type actions. Use null when not applicable.",
                    ),
                text: z
                    .string()
                    .nullable()
                    .describe("Text to type when action is type. Use null otherwise."),
                direction: z
                    .enum(["up", "down"])
                    .nullable()
                    .describe("Scroll direction when action is scroll. Use null otherwise."),
                amount: z
                    .number()
                    .nullable()
                    .describe("Optional scroll amount in pixels. Use null for the default amount."),
            }),
        ),
        execute: async ({ tabId, action, selector, text, direction, amount }) =>
            browser.act({
                action,
                ...(tabId == null ? {} : { tabId }),
                ...(selector == null ? {} : { selector }),
                ...(text == null ? {} : { text }),
                ...(direction == null ? {} : { direction }),
                ...(amount == null ? {} : { amount }),
            }),
    }),
    tool({
        name: "act_at_point",
        description:
            "Fallback action for approximate viewport coordinates. Only use this after DOM selectors, AX clues, and grounded DOM targets fail.",
        parameters: withOptional(
            optionalTabIdSchema,
            z.object({
                action: z.enum(["click", "type"]).describe("The fallback action to perform."),
                x: z.number().describe("Viewport x coordinate in CSS pixels."),
                y: z.number().describe("Viewport y coordinate in CSS pixels."),
                text: z
                    .string()
                    .nullable()
                    .describe(
                        "Text to type after focusing the point target. Use null when action is click.",
                    ),
            }),
        ),
        execute: async ({ tabId, action, x, y, text }) =>
            browser.actAtPoint({
                action,
                x,
                y,
                ...(tabId == null ? {} : { tabId }),
                ...(text == null ? {} : { text }),
            }),
    }),
];
