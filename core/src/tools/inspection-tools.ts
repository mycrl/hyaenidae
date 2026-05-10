import { tool } from "@openai/agents";
import { z as zod } from "zod";
import { AgentAskSession } from "../ask";
import { extractResponseText } from "../agent-run-stream";
import { optionalTabIdSchema, withOptional } from "./shared";

/**
 * Creates read-only inspection and grounding tools.
 */
export const createInspectionTools = (agentAskSession: AgentAskSession) => [
    tool({
        name: "snapshot_dom",
        description:
            "Read the current page using a compact DOM snapshot plus accessibility data. Good for selectors and semantic structure, but it may miss visually obvious answer cards or rich widgets. If the snapshot does not answer the question and the missing information may be visible on screen but underrepresented in DOM mode, use inspect_vision.",
        parameters: optionalTabIdSchema,
        execute: async ({ tabId }) =>
            agentAskSession.browserRuntime.snapshotDom(tabId ?? undefined),
    }),
    tool({
        name: "inspect_vision",
        description:
            "Capture a screenshot and inspect what is visibly rendered on the page. Use this for search result answer cards, weather widgets, charts, maps, popovers, canvas content, or when compact DOM data is insufficient or ambiguous.",
        parameters: withOptional(
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
            const snapshot = await agentAskSession.browserRuntime.captureScreenshot(
                tabId ?? undefined,
            );

            const response = await agentAskSession.client.responses.create({
                model: agentAskSession.model,
                input: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_text",
                                text: [
                                    "You are inspecting a browser screenshot for a browser automation agent.",
                                    `Write the analysis in ${agentAskSession.locale} unless the user explicitly asked for another language.`,
                                    "Answer concisely with actionable observations.",
                                    prompt,
                                ].join("\n"),
                            },
                            {
                                type: "input_image",
                                image_url: `data:${snapshot.mimeType};base64,${snapshot.base64}`,
                                detail: "auto",
                            },
                        ],
                    },
                ],
            });

            return {
                tabId: snapshot.tabId,
                width: snapshot.width,
                height: snapshot.height,
                analysis: extractResponseText(response),
            };
        },
    }),
    tool({
        name: "capture_vision",
        description: "Capture a raw screenshot for debugging or external inspection.",
        parameters: optionalTabIdSchema,
        execute: async ({ tabId }) =>
            agentAskSession.browserRuntime.captureScreenshot(tabId ?? undefined),
    }),
    tool({
        name: "ground_from_vision",
        description:
            "Resolve a visual description to likely DOM selectors or targets before clicking or typing. The returned point is only a backup when DOM selectors fail.",
        parameters: withOptional(
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
            matches: await agentAskSession.browserRuntime.groundFromVision(
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
            agentAskSession.browserRuntime.runScript(
                tabId == null
                    ? args == null
                        ? { script }
                        : { script, args }
                    : args == null
                      ? { tabId, script }
                      : { tabId, script, args },
            ),
    }),
];
