/**
 * Provider configuration and model resolution for the AI SDK.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

/**
 * AI SDK language model handle passed into `streamText` and `generateText`.
 */
export type Model = LanguageModel;

/**
 * Resolves provider-specific models and OpenAI-compatible model listing.
 *
 * Agent execution uses the native adapter per provider (`google` vs `openai` /
 * `custom`). Model discovery always goes through each vendor's OpenAI-compatible
 * `/models` endpoint, including Gemini via its compatibility base URL.
 */
export class ModelProvider {
    /**
     * @param provider - Provider kind, target model id, and optional API key.
     * Custom providers also supply an OpenAI-compatible `baseUrl`.
     */
    constructor(
        private readonly provider: (
            | { type: "google" }
            | { type: "openai" }
            | { type: "custom"; baseUrl: string }
        ) & { model: string; apiKey?: string },
    ) {}

    /**
     * Resolves the language model instance consumed directly by AI SDK calls such
     * as `streamText` and `generateText`.
     */
    createModel() {
        switch (this.provider.type) {
            case "google":
                return createGoogleGenerativeAI(
                    this.provider.apiKey === undefined
                        ? {}
                        : {
                              apiKey: this.provider.apiKey,
                          },
                )(this.provider.model);
            case "openai":
            case "custom":
                return createOpenAI({
                    ...(this.provider.apiKey
                        ? { apiKey: this.provider.apiKey }
                        : {}),
                    ...(this.provider.type === "custom"
                        ? {
                              baseURL: this.provider.baseUrl,
                          }
                        : {}),
                }).chat(this.provider.model);
        }
    }

    /**
     * Lists models through each provider's OpenAI-compatible `/models` endpoint.
     *
     * Google is queried through Gemini's OpenAI compatibility API. OpenAI and
     * custom providers use their own OpenAI-compatible base URLs.
     */
    async listModels() {
        const baseUrl =
            this.provider.type === "google"
                ? "https://generativelanguage.googleapis.com/v1beta/openai"
                : this.provider.type === "custom"
                  ? this.provider.baseUrl.replace(/\/+$/, "")
                  : "https://api.openai.com/v1";
        const response = await fetch(`${baseUrl}/models`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                ...(this.provider.apiKey === undefined ||
                this.provider.apiKey.trim().length === 0
                    ? {}
                    : {
                          Authorization: `Bearer ${this.provider.apiKey.trim()}`,
                      }),
            },
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(
                [
                    `Failed to load models from ${this.provider.type} provider.`,
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
            .filter(
                (id): id is string =>
                    typeof id === "string" && id.trim().length > 0,
            );
    }
}
