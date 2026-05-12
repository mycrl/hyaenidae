import { AgentConversationTurn } from "./response";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
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
 * Resolves the language model instance consumed directly by AI SDK calls such
 * as `streamText` and `generateText`.
 */
export function createModelWithModelProvider(modelProvider: ModelProvider) {
    switch (modelProvider.type) {
        case "google":
            return createGoogleGenerativeAI(
                modelProvider.apiKey === undefined
                    ? {}
                    : {
                          apiKey: modelProvider.apiKey,
                      },
            )(modelProvider.model);
        case "openai":
        case "custom":
            return createOpenAI({
                ...(modelProvider.apiKey === undefined
                    ? {}
                    : {
                          apiKey: modelProvider.apiKey,
                      }),
                ...(modelProvider.type === "custom"
                    ? {
                          baseURL: modelProvider.baseUrl,
                      }
                    : {}),
            }).chat(modelProvider.model);
    }
}

/**
 * Lists models through each provider's OpenAI-compatible `/models` endpoint.
 *
 * Google is queried through Gemini's OpenAI compatibility API. OpenAI and
 * custom providers use their own OpenAI-compatible base URLs.
 */
export async function getModelsWithModelProvider(modelProvider: ModelProvider) {
    const baseUrl =
        modelProvider.type === "google"
            ? "https://generativelanguage.googleapis.com/v1beta/openai"
            : modelProvider.type === "custom"
              ? modelProvider.baseUrl.replace(/\/+$/, "")
              : "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
            Accept: "application/json",
            ...(modelProvider.apiKey === undefined || modelProvider.apiKey.trim().length === 0
                ? {}
                : {
                      Authorization: `Bearer ${modelProvider.apiKey.trim()}`,
                  }),
        },
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
            [
                `Failed to load models from ${modelProvider.type} provider.`,
                `${response.status} ${response.statusText}`,
                errorText.trim(),
            ]
                .filter((part) => part.length > 0)
                .join(" "),
        );
    }

    const payload = await response.json();
    if (typeof payload !== "object" || payload === null) {
        return [];
    }

    const data = (payload as { data?: Array<{ id?: unknown }> }).data;
    if (!Array.isArray(data)) {
        return [];
    }

    return data
        .map((item) => item.id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}
