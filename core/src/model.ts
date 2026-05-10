import OpenAI from "openai";
import { AgentRunStream } from "./response";
import { HyaenidaeAgent } from "./agents";
import { BaseAskOptions } from ".";

/**
 * Connection details for a single OpenAI-compatible model endpoint.
 */
export interface ModelProviderOptions {
    baseURL: string;
    apiKey: string;
}

/**
 * Thin wrapper around an OpenAI client plus the agent adapter used by core.
 */
export class ModelProvider {
    private readonly client: OpenAI;

    constructor(public readonly options: ModelProviderOptions) {
        this.client = new OpenAI(options);
    }

    /**
     * Returns the underlying OpenAI client for lower-level operations.
     */
    getClient() {
        return this.client;
    }

    /**
     * Fetches the list of model identifiers advertised by the endpoint.
     */
    async getModels() {
        return this.client.models.list().then((response) => response.data.map((model) => model.id));
    }

    /**
     * Runs a user request through the browser-capable agent implementation.
     */
    async ask(options: BaseAskOptions): Promise<AgentRunStream> {
        const agent = new HyaenidaeAgent(this.client);
        return await agent.ask(options);
    }
}

/**
 * In-memory registry for model providers created by the host application.
 */
export class ModelProviderController {
    private counter = 0;
    private providers: { [key: number]: ModelProvider } = {};

    constructor() {}

    /**
     * Creates a provider, stores it under a numeric id, and returns that id.
     */
    create(options: ModelProviderOptions) {
        const id = this.counter++;
        this.providers[id] = new ModelProvider(options);
        return id;
    }

    /**
     * Returns the full provider registry keyed by internal id.
     */
    getProviders() {
        return this.providers;
    }

    /**
     * Looks up a provider by its internal id.
     */
    getProvider(id: number) {
        return this.providers[id];
    }

    /**
     * Removes a provider from the registry.
     */
    remove(id: number) {
        delete this.providers[id];
    }
}
