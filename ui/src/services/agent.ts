import type {
    AgentActivityItem,
    AgentResult,
    AgentStreamItem,
    ModelProvider,
} from "@hyaenidae/bridge";
import { create } from "zustand";
import { GLOBAL_ERROR_CODE, showGlobalAgentError } from "./notify";
import { type ApiProviderSettings, type AppSettings } from "./settings";

export interface AgentProviderItem {
    id: string;
    name: string;
    type: ApiProviderSettings["type"];
    apiKey: string;
    baseUrl: string;
}

export interface AgentSessionItem {
    id: number;
    name?: string;
}

export interface AgentMessage {
    id: number;
    role: "assistant" | "user";
    content: string;
    timestamp: string;
    status: "done" | "streaming" | "error";
    error?: string;
    activities?: AgentActivity[];
}

export interface AgentActivity {
    key: string;
    kind: "reasoning" | "tool" | "status";
    status: "running" | "completed";
    name: string;
    data?: unknown;
}

interface AgentConversation {
    title?: string;
    messages: AgentMessage[];
    activeResponseId: number | null;
    isResponding: boolean;
}

interface AgentStoreState {
    sessions: AgentSessionItem[];
    providers: AgentProviderItem[];
    selectedProviderId: string | null;
    selectedModel: string | null;
    models: string[];
    conversations: Record<number, AgentConversation>;
    activeSessionId: number | null;
    initialized: boolean;
    isLoadingSessions: boolean;
    initializeRpc: () => Promise<void>;
    refreshProviders: () => Promise<void>;
    selectProvider: (id: string) => Promise<void>;
    setSelectedModel: (model: string) => void;
    createSession: (name?: string) => Promise<number | null>;
    selectSession: (id: number) => void;
    sendMessage: (input: {
        message: string;
        provider: string;
        model: string;
        locale: string;
    }) => Promise<void>;
    stopActiveResponse: () => Promise<void>;
}

const getTimestamp = () =>
    new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date());

const buildChatTitle = (text: string) => {
    const compact = text.replace(/\s+/g, " ").trim();

    if (compact.length <= 20) {
        return compact;
    }

    return `${compact.slice(0, 20)}...`;
};

const ensureConversation = (
    conversations: Record<number, AgentConversation>,
    sessionId: number,
    fallbackTitle?: string,
) => {
    if (conversations[sessionId]) {
        return conversations[sessionId];
    }

    return {
        title: fallbackTitle,
        messages: [],
        activeResponseId: null,
        isResponding: false,
    };
};

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
                apiKey: provider.apiKey || undefined,
            };
        case "custom":
        case "local-runner":
            return {
                type: "custom",
                baseUrl: provider.baseUrl.trim(),
                model,
                apiKey: provider.apiKey || undefined,
            };
        case "openai":
        default:
            return {
                type: "openai",
                model,
                apiKey: provider.apiKey || undefined,
            };
    }
};

export const useAgentStore = create<AgentStoreState>((set, get) => ({
    sessions: [],
    providers: [],
    selectedProviderId: null,
    selectedModel: null,
    models: [],
    conversations: {},
    activeSessionId: null,
    initialized: false,
    isLoadingSessions: false,
    initializeRpc: async () => {
        if (get().initialized) {
            return;
        }

        set({ initialized: true, isLoadingSessions: true });

        hyaenidae.bridge.on("shell:settings-changed", async () => {
            await get().refreshProviders();
        });

        hyaenidae.bridge.on(
            "agent:chat-response",
            ({ sessionId, id, message }: AgentStreamItem) => {
                set((state) => {
                    const sessionName = state.sessions.find((item) => item.id === sessionId)?.name;
                    const conversation = ensureConversation(
                        state.conversations,
                        sessionId,
                        sessionName,
                    );
                    const existingMessage = conversation.messages.find(
                        (item) => item.id === id && item.role === "assistant",
                    );

                    const messages = existingMessage
                        ? conversation.messages.map((item) =>
                              item.id === id && item.role === "assistant"
                                  ? {
                                        ...item,
                                        content: `${item.content}${message}`,
                                        status: "streaming" as const,
                                    }
                                  : item,
                          )
                        : [
                              ...conversation.messages,
                              {
                                  id,
                                  role: "assistant" as const,
                                  content: message,
                                  timestamp: getTimestamp(),
                                  status: "streaming" as const,
                              },
                          ];

                    return {
                        conversations: {
                            ...state.conversations,
                            [sessionId]: {
                                ...conversation,
                                messages,
                                activeResponseId: id,
                                isResponding: true,
                            },
                        },
                    };
                });
            },
        );

        hyaenidae.bridge.on(
            "agent:chat-activity",
            ({ sessionId, id, ...activity }: AgentActivityItem) => {
                set((state) => {
                    const sessionName = state.sessions.find((item) => item.id === sessionId)?.name;
                    const conversation = ensureConversation(
                        state.conversations,
                        sessionId,
                        sessionName,
                    );
                    const existingMessage = conversation.messages.find(
                        (item) => item.id === id && item.role === "assistant",
                    );

                    const upsertActivities = (activities: AgentActivity[] = []) => {
                        const existingIndex = activities.findIndex(
                            (item) => item.key === activity.key,
                        );
                        if (existingIndex === -1) {
                            return [...activities, activity];
                        }

                        return activities.map((item, index) =>
                            index === existingIndex ? { ...item, ...activity } : item,
                        );
                    };

                    const messages = existingMessage
                        ? conversation.messages.map((item) =>
                              item.id === id && item.role === "assistant"
                                  ? {
                                        ...item,
                                        status: "streaming" as const,
                                        activities: upsertActivities(item.activities),
                                    }
                                  : item,
                          )
                        : [
                              ...conversation.messages,
                              {
                                  id,
                                  role: "assistant" as const,
                                  content: "",
                                  timestamp: getTimestamp(),
                                  status: "streaming" as const,
                                  activities: [activity],
                              },
                          ];

                    return {
                        conversations: {
                            ...state.conversations,
                            [sessionId]: {
                                ...conversation,
                                messages,
                                activeResponseId: id,
                                isResponding: true,
                            },
                        },
                    };
                });
            },
        );

        hyaenidae.bridge.on("agent:chat-response-done", ({ sessionId, id, error }: AgentResult) => {
            set((state) => {
                const sessionName = state.sessions.find((item) => item.id === sessionId)?.name;

                const conversation = ensureConversation(
                    state.conversations,
                    sessionId,
                    sessionName,
                );

                const hasAssistantMessage = conversation.messages.some(
                    (item) => item.id === id && item.role === "assistant",
                );

                const messages = hasAssistantMessage
                    ? conversation.messages.map((item) =>
                          item.id === id && item.role === "assistant"
                              ? {
                                    ...item,
                                    status: error ? ("error" as const) : ("done" as const),
                                    error,
                                    content: error && !item.content ? error : item.content,
                                }
                              : item,
                      )
                    : [
                          ...conversation.messages,
                          {
                              id,
                              role: "assistant" as const,
                              content: error ?? "",
                              timestamp: getTimestamp(),
                              status: error ? ("error" as const) : ("done" as const),
                              error,
                          },
                      ];

                return {
                    conversations: {
                        ...state.conversations,
                        [sessionId]: {
                            ...conversation,
                            messages,
                            activeResponseId:
                                conversation.activeResponseId === id
                                    ? null
                                    : conversation.activeResponseId,
                            isResponding: false,
                        },
                    },
                };
            });
        });

        try {
            await get().refreshProviders();

            const { sessions } = await hyaenidae.bridge.request("agent:session-list");

            set((state) => ({
                sessions,
                conversations: sessions.reduce<Record<number, AgentConversation>>(
                    (
                        accumulator: Record<number, AgentConversation>,
                        session: AgentSessionItem,
                    ) => ({
                        ...accumulator,
                        [session.id]: ensureConversation(
                            state.conversations,
                            session.id,
                            session.name,
                        ),
                    }),
                    state.conversations,
                ),
                activeSessionId: state.activeSessionId ?? sessions[0]?.id ?? null,
                isLoadingSessions: false,
            }));

            if (sessions.length === 0) {
                await get().createSession();
            }
        } catch (error) {
            showGlobalAgentError(
                error instanceof Error
                    ? {
                          code: GLOBAL_ERROR_CODE.LOAD_SESSIONS_FAILED,
                          message: error.message,
                      }
                    : {
                          code: GLOBAL_ERROR_CODE.LOAD_SESSIONS_FAILED,
                          message: null,
                      },
            );

            set({
                isLoadingSessions: false,
            });
        }
    },
    refreshProviders: async () => {
        try {
            const { settings } = (await hyaenidae.bridge.request("shell:settings-get")) as {
                settings: AppSettings;
            };

            const selectedProviderId = settings.providers.some(
                (provider) => provider.id === get().selectedProviderId,
            )
                ? get().selectedProviderId
                : (settings.providers[0]?.id ?? null);

            set({
                providers: settings.providers,
                selectedProviderId,
            });

            if (settings.providers.length === 0) {
                showGlobalAgentError({
                    code: GLOBAL_ERROR_CODE.NO_PROVIDERS_CONFIGURED,
                    message: null,
                });
            }

            if (selectedProviderId !== null) {
                await get().selectProvider(selectedProviderId);
            } else {
                set({ models: [], selectedModel: null });
            }
        } catch (error) {
            showGlobalAgentError(
                error instanceof Error
                    ? {
                          code: GLOBAL_ERROR_CODE.LOAD_MODELS_FAILED,
                          message: error.message,
                      }
                    : {
                          code: GLOBAL_ERROR_CODE.LOAD_MODELS_FAILED,
                          message: null,
                      },
            );

            set({
                providers: [],
                selectedProviderId: null,
                models: [],
                selectedModel: null,
            });
        }
    },
    selectProvider: async (id) => {
        const provider = get().providers.find((item) => item.id === id);

        if (!provider) {
            showGlobalAgentError({
                code: GLOBAL_ERROR_CODE.NO_PROVIDERS_CONFIGURED,
                message: null,
            });

            set({
                selectedProviderId: null,
                models: [],
                selectedModel: null,
            });

            return;
        }

        set({ selectedProviderId: id });

        try {
            const models = filterAgentModels(
                (
                    await hyaenidae.bridge.request(
                        "agent:provider-get-models",
                        toModelProvider(provider, ""),
                    )
                ).models ?? [],
            );

            const selectedModel = get().selectedModel;

            set({
                models,
                selectedModel: selectedModel
                    ? models.includes(selectedModel)
                        ? selectedModel
                        : null
                    : null,
            });
        } catch (error) {
            showGlobalAgentError(
                error instanceof Error
                    ? {
                          code: GLOBAL_ERROR_CODE.LOAD_MODELS_FAILED,
                          message: error.message,
                      }
                    : {
                          code: GLOBAL_ERROR_CODE.LOAD_MODELS_FAILED,
                          message: null,
                      },
            );
            set({
                models: [],
                selectedModel: null,
            });
        }
    },
    setSelectedModel: (model) => {
        set({ selectedModel: model });
    },
    createSession: async (name) => {
        try {
            const { id } = await hyaenidae.bridge.request("agent:session-create", {
                name,
            });

            set((state) => ({
                sessions: [...state.sessions, { id, name }],
                conversations: {
                    ...state.conversations,
                    [id]: ensureConversation(state.conversations, id, name),
                },
                activeSessionId: id,
            }));

            return id;
        } catch (error) {
            showGlobalAgentError(
                error instanceof Error
                    ? {
                          code: GLOBAL_ERROR_CODE.CREATE_SESSION_FAILED,
                          message: error.message,
                      }
                    : {
                          code: GLOBAL_ERROR_CODE.CREATE_SESSION_FAILED,
                          message: null,
                      },
            );

            return null;
        }
    },
    selectSession: (id) => {
        set({ activeSessionId: id });
    },
    sendMessage: async ({ message, provider, model, locale }) => {
        const trimmed = message.trim();
        if (!trimmed) {
            return;
        }

        if (!model.trim()) {
            showGlobalAgentError({
                code: GLOBAL_ERROR_CODE.MODEL_REQUIRED,
                message: null,
            });
            return;
        }

        const providerConfig = get().providers.find((item) => item.id === provider);
        if (!providerConfig) {
            showGlobalAgentError({
                code: GLOBAL_ERROR_CODE.NO_PROVIDERS_CONFIGURED,
                message: null,
            });
            return;
        }

        let sessionId = get().activeSessionId;

        if (sessionId === null) {
            sessionId = await get().createSession();
        }

        if (sessionId === null) {
            return;
        }

        const session = get().sessions.find((item) => item.id === sessionId);
        const conversation = ensureConversation(get().conversations, sessionId, session?.name);

        const hasUserMessage = conversation.messages.some((item) => item.role === "user");
        const nextTitle = hasUserMessage ? conversation.title : buildChatTitle(trimmed);
        const userMessageId = Date.now();

        set((state) => ({
            sessions: state.sessions.map((item) =>
                item.id === sessionId ? { ...item, name: nextTitle } : item,
            ),
            conversations: {
                ...state.conversations,
                [sessionId]: {
                    ...conversation,
                    title: nextTitle,
                    messages: [
                        ...conversation.messages,
                        {
                            id: userMessageId,
                            role: "user",
                            content: trimmed,
                            timestamp: getTimestamp(),
                            status: "done",
                        },
                    ],
                    isResponding: true,
                },
            },
        }));

        try {
            const result = await hyaenidae.bridge.request("agent:chat-ask", {
                session: sessionId,
                modelProvider: toModelProvider(providerConfig, model),
                message: trimmed,
                locale,
            });

            set((state) => {
                const updatedConversation = ensureConversation(
                    state.conversations,
                    sessionId,
                    nextTitle,
                );

                const hasAssistantMessage = updatedConversation.messages.some(
                    (item) => item.id === result.id && item.role === "assistant",
                );

                return {
                    conversations: {
                        ...state.conversations,
                        [sessionId]: {
                            ...updatedConversation,
                            activeResponseId: result.id,
                            isResponding: true,
                            messages: hasAssistantMessage
                                ? updatedConversation.messages
                                : [
                                      ...updatedConversation.messages,
                                      {
                                          id: result.id,
                                          role: "assistant",
                                          content: "",
                                          timestamp: getTimestamp(),
                                          status: "streaming",
                                          activities: [],
                                      },
                                  ],
                        },
                    },
                };
            });
        } catch (error) {
            const errorState =
                error instanceof Error
                    ? {
                          code: GLOBAL_ERROR_CODE.SEND_MESSAGE_FAILED,
                          message: error.message,
                      }
                    : {
                          code: GLOBAL_ERROR_CODE.SEND_MESSAGE_FAILED,
                          message: null,
                      };

            showGlobalAgentError(errorState);

            set((state) => {
                const updatedConversation = ensureConversation(
                    state.conversations,
                    sessionId,
                    nextTitle,
                );

                return {
                    conversations: {
                        ...state.conversations,
                        [sessionId]: {
                            ...updatedConversation,
                            activeResponseId: null,
                            isResponding: false,
                            messages: updatedConversation.messages,
                        },
                    },
                };
            });
        }
    },
    stopActiveResponse: async () => {
        const sessionId = get().activeSessionId;
        if (sessionId === null) {
            return;
        }

        const conversation = get().conversations[sessionId];
        if (!conversation?.activeResponseId) {
            return;
        }

        try {
            await hyaenidae.bridge.request("agent:chat-stop", {
                id: conversation.activeResponseId,
            });
        } catch (error) {
            showGlobalAgentError(
                error instanceof Error
                    ? {
                          code: GLOBAL_ERROR_CODE.STOP_RESPONSE_FAILED,
                          message: error.message,
                      }
                    : {
                          code: GLOBAL_ERROR_CODE.STOP_RESPONSE_FAILED,
                          message: null,
                      },
            );
        }
    },
}));
