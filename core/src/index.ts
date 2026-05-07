import { Agent, OpenAIProvider, run } from "@openai/agents";

export interface ModelServiceOptions {
    apiKey: string;
    baseURL: string;
}

export class ModelService {
    private readonly provider: OpenAIProvider;

    constructor(options: ModelServiceOptions) {
        this.provider = new OpenAIProvider({
            apiKey: options.apiKey,
            baseURL: options.baseURL,
        });
    }

    async ask(model: string, message: string) {
        return (
            await run(
                new Agent({
                    name: "Hyaenidae Assistant",
                    instructions:
                        "You are a browser AI assistant. Think step-by-step and use tools when needed.",
                    model: await this.provider.getModel(model),
                    tools: [],
                }),
                message,
                {
                    stream: true,
                },
            )
        ).toTextStream({
            compatibleWithNodeStreams: true,
        });
    }
}
