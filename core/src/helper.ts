import OpenAI from "openai";
import { AgentConversationTurn } from "./response";
import { Model, OpenAIProvider } from "@openai/agents";
import { aisdk } from "@openai/agents-extensions/ai-sdk";
import { google as googleModelAdapter } from "@ai-sdk/google";
import { ModelProvider } from ".";

const MAX_STORED_TURNS = 4;

const MAX_PROMPT_HISTORY_TURNS = 12;

/**
 * Keeps only the short rolling turn window stored directly on the session.
 *
 * Older context is expected to move into the compressed summary, so this helper
 * deliberately drops long-tail history instead of trying to preserve everything.
 */
export const trimTurns = (turns: AgentConversationTurn[]) => turns.slice(-MAX_STORED_TURNS);

/**
 * Rebuilds the prompt sent to the agent from the saved conversation state.
 *
 * The summary carries long-lived task context, while the recent turn tail keeps
 * the latest local exchange intact. This avoids replaying the full session on
 * every request.
 */
export function buildConversationInput(
    summary: string | undefined,
    turns: AgentConversationTurn[],
    message: string,
) {
    const recentTurns = turns.slice(-MAX_PROMPT_HISTORY_TURNS);

    if (!summary && recentTurns.length === 0) {
        return message;
    }

    return [
        ...(summary ? ["Compressed task context:", summary, ""] : []),
        ...(recentTurns.length > 0
            ? [
                  "Recent conversation turns:",
                  ...recentTurns.map(
                      (turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`,
                  ),
                  "",
              ]
            : []),
        "",
        "Continue from this context and answer the latest user message.",
        `Latest user message: ${message}`,
    ].join("\n");
}

/**
 * Pulls plain assistant text out of a Responses-style payload.
 *
 * The SDK can surface text in multiple shapes, so this helper is intentionally
 * defensive and falls back to walking structured output content when the fast
 * path is unavailable.
 */
export function extractResponseText(response: unknown) {
    if (typeof response !== "object" || response === null) {
        return "";
    }

    const outputText = (response as { output_text?: string }).output_text;
    if (typeof outputText === "string" && outputText.length > 0) {
        return outputText;
    }

    const output = (response as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
    if (!Array.isArray(output)) {
        return "";
    }

    return output
        .flatMap((item) => item.content ?? [])
        .map((item) => item.text)
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .join("\n")
        .trim();
}

/**
 * Creates the OpenAI client shape used for OpenAI-compatible provider calls.
 *
 * Google providers are routed through Gemini's OpenAI compatibility endpoint,
 * which lets core reuse the same client for model listing and summarization
 * without changing the main agent execution path.
 */
export function createOpenAIClient(modelProvider: ModelProvider) {
    return new OpenAI({
        baseURL:
            modelProvider.type === "google"
                ? "https://generativelanguage.googleapis.com/v1beta/openai/"
                : modelProvider.type === "custom"
                  ? modelProvider.baseUrl
                  : undefined,
        apiKey: modelProvider.apiKey,
    });
}

/**
 * Resolves the model implementation expected by the OpenAI Agents runtime.
 *
 * Google uses the dedicated AI SDK adapter because that path is more direct for
 * agent execution, while OpenAI and custom providers stay on OpenAIProvider.
 */
export async function createModel(modelProvider: ModelProvider): Promise<Model> {
    if (modelProvider.type === "google") {
        return aisdk(googleModelAdapter(modelProvider.model)) as Model;
    } else {
        return await new OpenAIProvider({
            openAIClient: createOpenAIClient(modelProvider) as any,
        }).getModel(modelProvider.model);
    }
}

/**
 * Lists the model identifiers exposed by the selected provider.
 *
 * This goes through an OpenAI-compatible models endpoint for every provider,
 * including Gemini via its compatibility layer, so callers can use one code
 * path when populating model pickers.
 */
export async function getModelsFromModelProvider(modelProvider: ModelProvider) {
    return await createOpenAIClient(modelProvider)
        .models.list()
        .then((response) => response.data.map((model) => model.id));
}
