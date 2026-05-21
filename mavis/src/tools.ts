/**
 * LangChain tool definitions that wrap {@link BrowserRuntime}.
 */

import { tool } from "langchain";
import { z as zod, ZodObject, ZodRawShape } from "zod";
import { BrowserRuntime } from "./browser";
import { Model } from "./provider";
import { ResponseStream } from "./response";

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
 * Creates the browser tool set exposed to the LangChain agent runtime.
 *
 * `inspect_vision` performs a follow-up vision pass on the same model to
 * interpret screenshots; other tools delegate directly to {@link BrowserRuntime}.
 */
export const createBrowserUseTools = ({
    model,
    language,
    browserRuntime,
}: {
    /**
     * Model used by vision inspection tools.
     */
    model: Model;
    /**
     * Language for vision analysis prompts.
     */
    language: string;
    /**
     * Browser implementation supplied by the host application.
     */
    browserRuntime: BrowserRuntime;
}) => [
    tool(
        async () => ({
            tabs: await browserRuntime.listTabs(),
        }),
        {
            name: "list_tabs",
            description:
                "List all open browser tabs with focus and loading state.",
            schema: zod.object({}),
        },
    ),
    tool(
        async ({ url }) => ({
            tab: await browserRuntime.openTab(url ?? undefined),
        }),
        {
            name: "open_tab",
            description: "Open a new browser tab and optionally load a URL.",
            schema: zod.object({
                url: zod
                    .string()
                    .nullable()
                    .describe(
                        "Optional URL to load in the new tab. Use null for a blank tab.",
                    ),
            }),
        },
    ),
    tool(
        async ({ tabId }) => ({
            tab: await browserRuntime.focusTab(tabId),
        }),
        {
            name: "focus_tab",
            description:
                "Focus an existing tab so subsequent actions target it.",
            schema: zod.object({
                tabId: zod.number().describe("The target tab id."),
            }),
        },
    ),
    tool(
        async ({ tabId }) => {
            await browserRuntime.closeTab(tabId);

            return { ok: true, tabId };
        },
        {
            name: "close_tab",
            description: "Close a browser tab that is no longer needed.",
            schema: zod.object({
                tabId: zod.number().describe("The target tab id."),
            }),
        },
    ),
    tool(
        async ({ tabId, url }) => ({
            tab: await browserRuntime.load(tabId, url),
        }),
        {
            name: "load_url",
            description: "Navigate a tab to a URL.",
            schema: zod
                .object({
                    tabId: zod.number().describe("The target tab id."),
                })
                .extend({
                    url: zod.string().describe("The URL to load."),
                }),
        },
    ),
    tool(
        async ({ tabId }) => {
            await browserRuntime.reload(tabId);

            return { ok: true, tabId };
        },
        {
            name: "reload_tab",
            description: "Reload a tab.",
            schema: zod.object({
                tabId: zod.number().describe("The target tab id."),
            }),
        },
    ),
    tool(
        async ({ tabId }) => {
            await browserRuntime.goBack(tabId);

            return { ok: true, tabId };
        },
        {
            name: "go_back",
            description: "Navigate backward in tab history.",
            schema: zod.object({
                tabId: zod.number().describe("The target tab id."),
            }),
        },
    ),
    tool(
        async ({ tabId }) => {
            await browserRuntime.goForward(tabId);

            return { ok: true, tabId };
        },
        {
            name: "go_forward",
            description: "Navigate forward in tab history.",
            schema: zod.object({
                tabId: zod.number().describe("The target tab id."),
            }),
        },
    ),
    tool(
        async ({ tabId, action, selector, text, direction, amount }) =>
            browserRuntime.act({
                action,
                ...(tabId == null ? {} : { tabId }),
                ...(selector == null ? {} : { selector }),
                ...(text == null ? {} : { text }),
                ...(direction == null ? {} : { direction }),
                ...(amount == null ? {} : { amount }),
            }),
        {
            name: "act_on_page",
            description:
                "Perform a concrete DOM-grounded page action such as click, type, or scroll. Prefer this over point-based actions.",
            schema: withOptional(
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
        },
    ),
    tool(
        async ({ tabId, action, x, y, text }) =>
            browserRuntime.actAtPoint({
                action,
                x,
                y,
                ...(tabId == null ? {} : { tabId }),
                ...(text == null ? {} : { text }),
            }),
        {
            name: "act_at_point",
            description:
                "Fallback action for approximate viewport coordinates. Only use this after DOM selectors, AX clues, and grounded DOM targets fail.",
            schema: withOptional(
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
        },
    ),
    tool(async ({ tabId }) => browserRuntime.snapshotDom(tabId ?? undefined), {
        name: "snapshot_dom",
        description:
            "Read the current page using a compact DOM snapshot plus accessibility data. Good for selectors and semantic structure, but it may miss visually obvious answer cards or rich widgets. If the snapshot does not answer the question and the missing information may be visible on screen but underrepresented in DOM mode, use inspect_vision.",
        schema: optionalTabIdSchema,
    }),
    tool(
        async ({ tabId, prompt }) => {
            const snapshot = await browserRuntime.captureScreenshot(
                tabId ?? undefined,
            );

            const response = await model.invoke([
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: [
                                "You are inspecting a browser screenshot for a browser automation agent.",
                                `Write the analysis in ${language} unless the user explicitly asked for another language.`,
                                "Answer concisely with actionable observations.",
                                prompt,
                            ].join("\n"),
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${snapshot.mimeType};base64,${snapshot.base64}`,
                            },
                        },
                    ],
                },
            ]);

            return {
                tabId: snapshot.tabId,
                width: snapshot.width,
                height: snapshot.height,
                analysis: ResponseStream.extractText(response.content),
            };
        },
        {
            name: "inspect_vision",
            description:
                "Capture a screenshot and inspect what is visibly rendered on the page. Use this for search result answer cards, weather widgets, charts, maps, popovers, canvas content, or when compact DOM data is insufficient or ambiguous.",
            schema: withOptional(
                optionalTabIdSchema,
                zod.object({
                    prompt: zod
                        .string()
                        .describe(
                            "What to inspect in the screenshot, such as 'read the visible weather card for New York and summarize the current conditions' or 'find the primary login button and describe nearby text'.",
                        ),
                }),
            ),
        },
    ),
    tool(
        async ({ tabId }) =>
            browserRuntime.captureScreenshot(tabId ?? undefined),
        {
            name: "capture_vision",
            description:
                "Capture a raw screenshot for debugging or external inspection.",
            schema: optionalTabIdSchema,
        },
    ),
    tool(
        async ({ tabId, script, args }) =>
            browserRuntime.runScript(
                tabId == null
                    ? args == null
                        ? { script }
                        : { script, args }
                    : args == null
                      ? { tabId, script }
                      : { tabId, script, args },
            ),
        {
            name: "run_tab_script",
            description:
                "Run a short script inside the tab to inspect or automate page state. Prefer read-only scripts unless an explicit mutation is needed.",
            schema: withOptional(
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
        },
    ),
];
