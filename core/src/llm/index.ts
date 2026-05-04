import OpenAI from "openai";

/**
 * LLM Provider interface. Defines the contract for any LLM provider
 * implementation, such as a local llama-server or a remote API-based provider.
 *
 * The provider is responsible for managing the lifecycle of the LLM server
 * (e.g. starting, stopping) and providing the base URL for API requests.
 */
export declare class LlmProvider {
    getModelName(): string;
    /**
     * Returns the base URL for API requests to the LLM server
     * (e.g. "http://127.0.0.1:8000/v1").
     */
    getBaseUrl(): string;

    /**
     * Shuts down the LLM server and cleans up any resources. Should be called
     * when the provider is no longer needed to ensure proper cleanup.
     */
    shutdown(): Promise<void>;

    on(event: "error", listener: (err: Error) => void): void;
    on(event: "exit", listener: () => void): void;
}

/**
 * OpenAI API options for LLM providers that use OpenAI-compatible APIs.
 */
export interface OpenAiOptions {
    apiKey: string;
}

/**
 * Options for creating an LLM instance, including the provider creation options
 * and a factory function for creating the provider.
 */
export interface LlmOptions<T extends OpenAiOptions> {
    createProviderOptions: T;
    createProvider: (options: T) => Promise<LlmProvider>;
}

/**
 * Llm class that provides a unified interface for interacting with different
 * LLM providers.
 *
 * It abstracts away the details of provider management and allows users to
 * interact with the LLM through a consistent API.
 */
export class Llm {
    private client: OpenAI;

    constructor(
        private readonly provider: LlmProvider,
        apiKey: string,
    ) {
        this.client = new OpenAI({
            baseURL: this.provider.getBaseUrl(),
            apiKey,
        });
    }

    async chat(
        messages: { role: "user" | "assistant" | "system"; content: string }[],
    ) {
        const stream = await this.client.chat.completions.create({
            model: this.provider.getModelName(),
            messages,
            stream: true,
        });
    }

    /**
     * Shuts down the LLM provider and cleans up resources.
     */
    async shutdown() {
        await this.provider.shutdown();
    }
}

/**
 * Factory for creating Llm instances. Encapsulates the asynchronous process of
 * creating the provider and ensures that the Llm instance is only created once
 * the provider is ready.
 */
export class LlmFactory {
    /**
     * Creates an Llm instance using the provided options.
     */
    static async create<T extends OpenAiOptions>(options: LlmOptions<T>) {
        return new Llm(
            await options.createProvider(options.createProviderOptions),
            options.createProviderOptions.apiKey,
        );
    }
}
