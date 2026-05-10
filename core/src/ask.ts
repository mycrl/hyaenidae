import OpenAI from "openai";
import { BrowserRuntime } from "./browser-runtime";
import { AgentConversationContext } from "./agent-run-stream";

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
