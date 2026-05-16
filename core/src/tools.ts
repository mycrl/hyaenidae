import { generateText, tool } from "ai";
import { z as zod, ZodObject, ZodRawShape } from "zod";
import { AskOptions } from ".";
import { createModelWithModelProvider } from "./helper";

/**
 * Shared tab-target schema used by browser tools.
 */
export const optionalTabIdSchema = zod.object({
    tabId: zod
        .number()
        .nullable()
        .describe("Optional tab id. Use null to target the focused tab."),
});

/**
 * Helper that merges a base tool schema with extra fields while preserving the
 * object shape expected by the tool factory.
 */
export const withOptional = <T extends ZodRawShape, U extends ZodRawShape>(
    base: ZodObject<T>,
    extra: ZodObject<U>,
) => base.extend(extra.shape);

/**
 * Creates the browser tool set exposed to the AI SDK runtime.
 */
export const createTools = (askOptions: AskOptions) => ({
    list_tabs: tool({
        description: "List all open browser tabs with focus and loading state.",
        inputSchema: zod.object({}),
        execute: async () => ({
            tabs: await askOptions.browserRuntime.listTabs(),
        }),
    }),
    open_tab: tool({
        description: "Open a new browser tab and optionally load a URL.",
        inputSchema: zod.object({
            url: zod
                .string()
                .nullable()
                .describe(
                    "Optional URL to load in the new tab. Use null for a blank tab.",
                ),
        }),
        execute: async ({ url }) => ({
            tab: await askOptions.browserRuntime.openTab(url ?? undefined),
        }),
    }),
    focus_tab: tool({
        description: "Focus an existing tab so subsequent actions target it.",
        inputSchema: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => ({
            tab: await askOptions.browserRuntime.focusTab(tabId),
        }),
    }),
    close_tab: tool({
        description: "Close a browser tab that is no longer needed.",
        inputSchema: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await askOptions.browserRuntime.closeTab(tabId);

            return { ok: true, tabId };
        },
    }),
    load_url: tool({
        description: "Navigate a tab to a URL.",
        inputSchema: zod
            .object({
                tabId: zod.number().describe("The target tab id."),
            })
            .extend({
                url: zod.string().describe("The URL to load."),
            }),
        execute: async ({ tabId, url }) => ({
            tab: await askOptions.browserRuntime.load(tabId, url),
        }),
    }),
    reload_tab: tool({
        description: "Reload a tab.",
        inputSchema: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await askOptions.browserRuntime.reload(tabId);

            return { ok: true, tabId };
        },
    }),
    go_back: tool({
        description: "Navigate backward in tab history.",
        inputSchema: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await askOptions.browserRuntime.goBack(tabId);

            return { ok: true, tabId };
        },
    }),
    go_forward: tool({
        description: "Navigate forward in tab history.",
        inputSchema: zod.object({
            tabId: zod.number().describe("The target tab id."),
        }),
        execute: async ({ tabId }) => {
            await askOptions.browserRuntime.goForward(tabId);

            return { ok: true, tabId };
        },
    }),
    act_on_page: tool({
        description:
            "Perform a concrete DOM-grounded page action such as click, type, or scroll. Prefer this over point-based actions.",
        inputSchema: withOptional(
            optionalTabIdSchema,
            zod.object({
                action: zod
                    .enum(["click", "type", "scroll"])
                    .describe("The action to perform."),
                selector: zod
                    .string()
                    .nullable()
                    .describe(
                        "A CSS selector for click or type actions. Use null when not applicable.",
                    ),
                text: zod
                    .string()
                    .nullable()
                    .describe(
                        "Text to type when action is type. Use null otherwise.",
                    ),
                direction: zod
                    .enum(["up", "down"])
                    .nullable()
                    .describe(
                        "Scroll direction when action is scroll. Use null otherwise.",
                    ),
                amount: zod
                    .number()
                    .nullable()
                    .describe(
                        "Optional scroll amount in pixels. Use null for the default amount.",
                    ),
            }),
        ),
        execute: async ({ tabId, action, selector, text, direction, amount }) =>
            askOptions.browserRuntime.act({
                action,
                ...(tabId == null ? {} : { tabId }),
                ...(selector == null ? {} : { selector }),
                ...(text == null ? {} : { text }),
                ...(direction == null ? {} : { direction }),
                ...(amount == null ? {} : { amount }),
            }),
    }),
    act_at_point: tool({
        description:
            "Fallback action for approximate viewport coordinates. Only use this after DOM selectors, AX clues, and grounded DOM targets fail.",
        inputSchema: withOptional(
            optionalTabIdSchema,
            zod.object({
                action: zod
                    .enum(["click", "type"])
                    .describe("The fallback action to perform."),
                x: zod
                    .number()
                    .describe("Viewport x coordinate in CSS pixels."),
                y: zod
                    .number()
                    .describe("Viewport y coordinate in CSS pixels."),
                text: zod
                    .string()
                    .nullable()
                    .describe(
                        "Text to type after focusing the point target. Use null when action is click.",
                    ),
            }),
        ),
        execute: async ({ tabId, action, x, y, text }) =>
            askOptions.browserRuntime.actAtPoint({
                action,
                x,
                y,
                ...(tabId == null ? {} : { tabId }),
                ...(text == null ? {} : { text }),
            }),
    }),
    snapshot_dom: tool({
        description:
            "Read the current page using a compact DOM snapshot plus accessibility data. Good for selectors and semantic structure, but it may miss visually obvious answer cards or rich widgets. If the snapshot does not answer the question and the missing information may be visible on screen but underrepresented in DOM mode, use inspect_vision.",
        inputSchema: optionalTabIdSchema,
        execute: async ({ tabId }) =>
            askOptions.browserRuntime.snapshotDom(tabId ?? undefined),
    }),
    inspect_vision: tool({
        description:
            "Capture a screenshot and inspect what is visibly rendered on the page. Use this for search result answer cards, weather widgets, charts, maps, popovers, canvas content, or when compact DOM data is insufficient or ambiguous.",
        inputSchema: withOptional(
            optionalTabIdSchema,
            zod.object({
                prompt: zod
                    .string()
                    .describe(
                        "What to inspect in the screenshot, such as 'read the visible weather card for New York and summarize the current conditions' or 'find the primary login button and describe nearby text'.",
                    ),
            }),
        ),
        execute: async ({ tabId, prompt }) => {
            const snapshot = await askOptions.browserRuntime.captureScreenshot(
                tabId ?? undefined,
            );

            const response = await generateText({
                model: createModelWithModelProvider(askOptions.modelProvider),
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: [
                                    "You are inspecting a browser screenshot for a browser automation agent.",
                                    `Write the analysis in ${askOptions.locale} unless the user explicitly asked for another language.`,
                                    "Answer concisely with actionable observations.",
                                    prompt,
                                ].join("\n"),
                            },
                            {
                                type: "image",
                                image: `data:${snapshot.mimeType};base64,${snapshot.base64}`,
                            },
                        ],
                    },
                ],
            });

            return {
                tabId: snapshot.tabId,
                width: snapshot.width,
                height: snapshot.height,
                analysis: response.text,
            };
        },
    }),
    capture_vision: tool({
        description:
            "Capture a raw screenshot for debugging or external inspection.",
        inputSchema: optionalTabIdSchema,
        execute: async ({ tabId }) =>
            askOptions.browserRuntime.captureScreenshot(tabId ?? undefined),
    }),
    ground_from_vision: tool({
        description:
            "Resolve a visual description to likely DOM selectors or targets before clicking or typing. The returned point is only a backup when DOM selectors fail.",
        inputSchema: withOptional(
            optionalTabIdSchema,
            zod.object({
                description: zod
                    .string()
                    .describe(
                        "Human description of the visual target, such as 'blue Sign in button in header'.",
                    ),
            }),
        ),
        execute: async ({ tabId, description }) => ({
            matches: await askOptions.browserRuntime.groundFromVision(
                tabId == null ? { description } : { tabId, description },
            ),
        }),
    }),
    run_tab_script: tool({
        description:
            "Run a short script inside the tab to inspect or automate page state. Prefer read-only scripts unless an explicit mutation is needed.",
        inputSchema: withOptional(
            optionalTabIdSchema,
            zod.object({
                script: zod
                    .string()
                    .describe(
                        "JavaScript source evaluated in the page context. Return structured JSON-safe data when possible.",
                    ),
                args: zod
                    .array(zod.unknown())
                    .nullable()
                    .describe(
                        "Optional arguments passed to the script. Use null when no arguments are needed.",
                    ),
            }),
        ),
        execute: async ({ tabId, script, args }) =>
            askOptions.browserRuntime.runScript(
                tabId == null
                    ? args == null
                        ? { script }
                        : { script, args }
                    : args == null
                      ? { tabId, script }
                      : { tabId, script, args },
            ),
    }),
});
