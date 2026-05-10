import { z as zod, ZodObject, ZodRawShape } from "zod";

/**
 * Shared tab-target schema used by browser tools.
 */
export const optionalTabIdSchema = zod.object({
    tabId: zod.number().nullable().describe("Optional tab id. Use null to target the focused tab."),
});

/**
 * Helper that merges a base tool schema with extra fields while preserving the
 * object shape expected by the tool factory.
 */
export const withOptional = <T extends ZodRawShape, U extends ZodRawShape>(
    base: ZodObject<T>,
    extra: ZodObject<U>,
) => base.extend(extra.shape);
