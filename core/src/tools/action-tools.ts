import { tool } from "@openai/agents";
import { z as zod } from "zod";
import { AgentAskSession } from "../ask";
import { optionalTabIdSchema, withOptional } from "./shared";

/**
 * Creates browser mutation tools for page interaction.
 */
export const createActionTools = (agentAskSession: AgentAskSession) => [
    tool({
        name: "act_on_page",
        description:
            "Perform a concrete DOM-grounded page action such as click, type, or scroll. Prefer this over point-based actions.",
        parameters: withOptional(
            optionalTabIdSchema,
            zod.object({
                action: zod.enum(["click", "type", "scroll"]).describe("The action to perform."),
                selector: zod
                    .string()
                    .nullable()
                    .describe(
                        "A CSS selector for click or type actions. Use null when not applicable.",
                    ),
                text: zod
                    .string()
                    .nullable()
                    .describe("Text to type when action is type. Use null otherwise."),
                direction: zod
                    .enum(["up", "down"])
                    .nullable()
                    .describe("Scroll direction when action is scroll. Use null otherwise."),
                amount: zod
                    .number()
                    .nullable()
                    .describe("Optional scroll amount in pixels. Use null for the default amount."),
            }),
        ),
        execute: async ({ tabId, action, selector, text, direction, amount }) =>
            agentAskSession.browserRuntime.act({
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
            zod.object({
                action: zod.enum(["click", "type"]).describe("The fallback action to perform."),
                x: zod.number().describe("Viewport x coordinate in CSS pixels."),
                y: zod.number().describe("Viewport y coordinate in CSS pixels."),
                text: zod
                    .string()
                    .nullable()
                    .describe(
                        "Text to type after focusing the point target. Use null when action is click.",
                    ),
            }),
        ),
        execute: async ({ tabId, action, x, y, text }) =>
            agentAskSession.browserRuntime.actAtPoint({
                action,
                x,
                y,
                ...(tabId == null ? {} : { tabId }),
                ...(text == null ? {} : { text }),
            }),
    }),
];
