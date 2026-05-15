import type {
    AddToChatOptions,
    AgentResponseEvent,
    AgentSession,
    ApiProviderSettings,
    ModelProvider,
} from "@hyaenidae/bridge";

const TOOL_UNFRIENDLY_MODEL_PATTERN =
    /embed|embedding|rerank|moderation|whisper|tts|stt|transcribe|vision-preview|omni-moderation/i;

const filterAgentModels = (models: string[]) => {
    const filteredModels = models.filter((model) => !TOOL_UNFRIENDLY_MODEL_PATTERN.test(model));

    return filteredModels.length > 0 ? filteredModels : models;
};

const toModelProvider = (provider: AgentProviderItem, model: string): ModelProvider => {
    switch (provider.type) {
        case "google":
            return {
                type: "google",
                model,
                apiKey: provider.apiKey ?? undefined,
            };
        case "custom":
        case "local-runner":
            return {
                type: "custom",
                model,
                baseUrl: provider.baseUrl ?? "",
                apiKey: provider.apiKey ?? undefined,
            };
        case "openai":
        default:
            return {
                type: "openai",
                model,
                apiKey: provider.apiKey ?? undefined,
            };
    }
};

const isConfiguredProvider = (provider: ApiProviderSettings): provider is AgentProviderItem => {
    switch (provider.type) {
        case "custom":
        case "local-runner":
            return provider.baseUrl !== null;
        case "google":
        case "openai":
            return true;
        default:
            return false;
    }
};

export interface AgentProviderItem {
    id: string;
    name: string | null;
    type: ApiProviderSettings["type"];
    apiKey: string | null;
    baseUrl: string | null;
}

interface AgentEventMap {
    "agent:chat-response": AgentResponseEvent;
    "shell:add-to-chat": AddToChatOptions;
}

const onAgentEvent = <TEvent extends keyof AgentEventMap>(
    event: TEvent,
    handler: (payload: AgentEventMap[TEvent]) => Promise<void> | void,
) => {
    hyaenidae.bridge.on(event, async (payload) => {
        await handler(payload as AgentEventMap[TEvent]);
    });
};

export const filterConfiguredProviders = (
    providers: ApiProviderSettings[],
): AgentProviderItem[] => {
    return providers.filter(isConfiguredProvider);
};

export const getProviderModels = async (provider: AgentProviderItem): Promise<string[]> => {
    const result = await hyaenidae.bridge.request(
        "agent:provider-get-models",
        toModelProvider(provider, ""),
    );

    return filterAgentModels(result.models ?? []);
};

export const listAgentSessions = async (): Promise<AgentSession[]> => {
    const result = await hyaenidae.bridge.request("agent:session-list");

    return result.sessions;
};

export const createAgentSession = async (name?: string): Promise<AgentSession> => {
    return await hyaenidae.bridge.request("agent:session-create", { name });
};

export const askAgent = async (input: {
    session: number;
    provider: AgentProviderItem;
    model: string;
    message: string;
    locale: string;
}) => {
    return await hyaenidae.bridge.request("agent:chat-ask", {
        modelProvider: toModelProvider(input.provider, input.model),
        session: input.session,
        message: input.message,
        locale: input.locale,
    });
};

export const stopAgentResponse = async (askId: number) => {
    await hyaenidae.bridge.request("agent:chat-stop", { askId });
};

export const onAgentChatResponse = (
    handler: (payload: AgentResponseEvent) => Promise<void> | void,
) => {
    onAgentEvent("agent:chat-response", handler);
};

export const onAddToChat = (handler: (payload: AddToChatOptions) => Promise<void> | void) => {
    onAgentEvent("shell:add-to-chat", handler);
};
