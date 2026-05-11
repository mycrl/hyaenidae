import {
    addTraceProcessor,
    BatchTraceProcessor,
    type TracingExporter,
    getGlobalTraceProvider,
} from "@openai/agents";

export type AgentTraceJson = Record<string, unknown>;

/**
 * Callback used by the host app to receive serialized trace batches.
 */
export type AgentTraceJsonHandler = (items: AgentTraceJson[]) => void | Promise<void>;

let traceJsonHandler: AgentTraceJsonHandler | undefined;
let traceJsonProcessorRegistered = false;

/**
 * Minimal exporter that forwards SDK trace items as plain JSON objects.
 *
 * Serialization happens here so the rest of the app can store or inspect trace
 * payloads without depending on SDK-specific trace classes.
 */
class JsonTraceExporter implements TracingExporter {
    async export(items: { toJSON(): object | null }[]) {
        if (!traceJsonHandler) {
            return;
        }

        const serializedItems = items
            .map((item) => item.toJSON())
            .filter((item): item is AgentTraceJson => item !== null);

        if (serializedItems.length === 0) {
            return;
        }

        await traceJsonHandler(serializedItems);
    }
}

/**
 * Registers the process-wide JSON trace sink used by the host application.
 *
 * The processor is installed only once even if the handler is replaced later,
 * which avoids duplicate exports from repeated initialization.
 */
export function registerTraceJsonHandler(handler: AgentTraceJsonHandler) {
    traceJsonHandler = handler;

    if (traceJsonProcessorRegistered) {
        return;
    }

    addTraceProcessor(new BatchTraceProcessor(new JsonTraceExporter()));
    traceJsonProcessorRegistered = true;
}

/**
 * Forces buffered trace data to flush through the active exporter pipeline.
 */
export function flushTraceExports() {
    return getGlobalTraceProvider().forceFlush();
}
