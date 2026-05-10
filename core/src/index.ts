import OpenAI from "openai";
import { BrowserRuntime } from "./browser";
import { AgentConversationContext } from "./response";

export * from "./browser";
export * from "./sessions";
export * from "./response";
export * from "./agents";
export * from "./model";

/**
 * Baseline options required to execute a single agent request.
 */
export interface BaseAskOptions {
    model: string;
    message: string;
    locale: string;
    conversation?: AgentConversationContext;
    browserRuntime: BrowserRuntime;
}

/**
 * Expanded runtime session payload shared across internal agent helpers.
 */
export interface AgentAskSession {
    model: string;
    locale: string;
    client: OpenAI;
    browserRuntime: BrowserRuntime;
}
