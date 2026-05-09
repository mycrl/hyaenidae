import type { AgentActivityItem, AgentResult, AgentStreamItem } from "@hyaenidae/bridge";
import { create } from "zustand";
import i18n from "../i18n";
import { normalizeSettings, type ApiProviderSettings } from "./settings";

export interface AgentProviderItem {
    id: number;
    name: string;
    settingId?: string;
    apiKey: string;
    baseURL: string;
}

export interface AgentSessionItem {
    id: number;
    name: string;
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
    title: string;
    messages: AgentMessage[];
    activeResponseId: number | null;
    isResponding: boolean;
}

interface AgentStoreState {
    sessions: AgentSessionItem[];
    providers: AgentProviderItem[];
    selectedProviderId: number | null;
    selectedModel: string;
    models: string[];
    conversations: Record<number, AgentConversation>;
    activeSessionId: number | null;
    initialized: boolean;
    isLoadingSessions: boolean;
    error: string | null;
    initializeRpc: () => Promise<void>;
    refreshProviders: () => Promise<void>;
    selectProvider: (id: number) => Promise<void>;
    setSelectedModel: (model: string) => void;
    createSession: (name?: string) => Promise<number | null>;
    selectSession: (id: number) => void;
    sendMessage: (input: { message: string; provider: number; model: string }) => Promise<void>;
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
    fallbackTitle: string,
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

const hasRuntimeConfig = (provider: { baseURL?: string; apiKey?: string }) =>
    Boolean(provider.baseURL?.trim() || provider.apiKey?.trim());

const normalizeProviderBaseUrl = (baseURL?: string) => baseURL?.trim() ?? "";

const consumeMatchingSetting = (
    settingsProviders: ApiProviderSettings[],
    runtimeProvider: { baseURL: string },
) => {
    const matchingIndex = settingsProviders.findIndex(
        (provider) =>
            normalizeProviderBaseUrl(provider.baseURL) ===
            normalizeProviderBaseUrl(runtimeProvider.baseURL),
    );

    if (matchingIndex < 0) {
        return null;
    }

    const [matchingProvider] = settingsProviders.splice(matchingIndex, 1);
    return matchingProvider;
};

const buildAgentProviders = (
    runtimeProviders: { id: number; baseURL: string; apiKey: string }[],
    settingsProviders: ApiProviderSettings[],
): AgentProviderItem[] => {
    const remainingSettingsProviders = settingsProviders
        .filter(hasRuntimeConfig)
        .map((provider) => ({
            ...provider,
        }));

    return runtimeProviders.map((provider, index) => {
        const matchingSetting = consumeMatchingSetting(remainingSettingsProviders, provider);

        return {
            id: provider.id,
            settingId: matchingSetting?.id,
            name:
                matchingSetting?.name ||
                matchingSetting?.id ||
                provider.baseURL ||
                `Provider ${index + 1}`,
            baseURL: provider.baseURL,
            apiKey: provider.apiKey,
        };
    });
};

export const useAgentStore = create<AgentStoreState>((set, get) => ({
    sessions: [],
    providers: [],
    selectedProviderId: null,
    selectedModel: "gpt-4.1-mini",
    models: [],
    conversations: {},
    activeSessionId: null,
    initialized: false,
    isLoadingSessions: false,
    error: null,
    initializeRpc: async () => {
        if (get().initialized) {
            return;
        }

        set({ initialized: true, isLoadingSessions: true, error: null });

        hyaenidae.bridge.on("shell:settings-changed", () => {
            void get().refreshProviders();
        });

        hyaenidae.bridge.on("agent:chat-response", ({ session, id, message }: AgentStreamItem) => {
            set((state) => {
                const sessionName =
                    state.sessions.find((item) => item.id === session)?.name ??
                    i18n.t("chat.newConversation");
                const conversation = ensureConversation(state.conversations, session, sessionName);
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
                    error: null,
                    conversations: {
                        ...state.conversations,
                        [session]: {
                            ...conversation,
                            messages,
                            activeResponseId: id,
                            isResponding: true,
                        },
                    },
                };
            });
        });

        hyaenidae.bridge.on(
            "agent:chat-activity",
            ({ session, id, ...activity }: AgentActivityItem) => {
                set((state) => {
                    const sessionName =
                        state.sessions.find((item) => item.id === session)?.name ??
                        i18n.t("chat.newConversation");
                    const conversation = ensureConversation(
                        state.conversations,
                        session,
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
                        error: null,
                        conversations: {
                            ...state.conversations,
                            [session]: {
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

        hyaenidae.bridge.on("agent:chat-response-done", ({ session, id, error }: AgentResult) => {
            set((state) => {
                const sessionName =
                    state.sessions.find((item) => item.id === session)?.name ??
                    i18n.t("chat.newConversation");

                const conversation = ensureConversation(state.conversations, session, sessionName);
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
                    error: error ?? state.error,
                    conversations: {
                        ...state.conversations,
                        [session]: {
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
            const result = await hyaenidae.bridge.request("agent:session-list");
            const sessions = result.sessions ?? [];

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
                error: null,
            }));

            if (sessions.length === 0) {
                await get().createSession(i18n.t("chat.newConversation"));
            }
        } catch (error) {
            set({
                isLoadingSessions: false,
                error: error instanceof Error ? error.message : i18n.t("chat.failedToLoadSessions"),
            });
        }
    },
    refreshProviders: async () => {
        try {
            const [result, settingsResult] = await Promise.all([
                hyaenidae.bridge.request("agent:provider-list"),
                hyaenidae.bridge.request("shell:settings-get"),
            ]);
            const providers = buildAgentProviders(
                result.providers ?? [],
                normalizeSettings(settingsResult.settings).providers,
            );
            const selectedProviderId = providers.some(
                (provider) => provider.id === get().selectedProviderId,
            )
                ? get().selectedProviderId
                : (providers[0]?.id ?? null);

            set({
                providers,
                selectedProviderId,
                error: providers.length === 0 ? i18n.t("chat.noProvidersConfigured") : null,
            });

            if (selectedProviderId !== null) {
                await get().selectProvider(selectedProviderId);
            } else {
                set({ models: [] });
            }
        } catch (error) {
            set({
                providers: [],
                selectedProviderId: null,
                models: [],
                error: error instanceof Error ? error.message : i18n.t("chat.failedToLoadModels"),
            });
        }
    },
    selectProvider: async (id) => {
        set({ selectedProviderId: id, error: null });

        try {
            const result = await hyaenidae.bridge.request("agent:provider-get-models", { id });
            const models = result.models ?? [];
            const selectedModel = models.includes(get().selectedModel)
                ? get().selectedModel
                : (models[0] ?? get().selectedModel);

            set({ models, selectedModel });
        } catch (error) {
            set({
                models: [],
                error: error instanceof Error ? error.message : i18n.t("chat.failedToLoadModels"),
            });
        }
    },
    setSelectedModel: (model) => {
        set({ selectedModel: model });
    },
    createSession: async (name) => {
        try {
            const sessionName = name?.trim() || i18n.t("chat.newConversation");
            const result = await hyaenidae.bridge.request("agent:session-create", {
                name: sessionName,
            });

            set((state) => ({
                sessions: [...state.sessions, { id: result.id, name: sessionName }],
                conversations: {
                    ...state.conversations,
                    [result.id]: ensureConversation(state.conversations, result.id, sessionName),
                },
                activeSessionId: result.id,
                error: null,
            }));

            return result.id;
        } catch (error) {
            set({
                error:
                    error instanceof Error ? error.message : i18n.t("chat.failedToCreateSession"),
            });

            return null;
        }
    },
    selectSession: (id) => {
        set({ activeSessionId: id, error: null });
    },
    sendMessage: async ({ message, provider, model }) => {
        const trimmed = message.trim();
        if (!trimmed) {
            return;
        }

        let sessionId = get().activeSessionId;

        if (sessionId === null) {
            sessionId = await get().createSession(i18n.t("chat.newConversation"));
        }

        if (sessionId === null) {
            return;
        }

        const session = get().sessions.find((item) => item.id === sessionId);
        const conversation = ensureConversation(
            get().conversations,
            sessionId,
            session?.name ?? i18n.t("chat.newConversation"),
        );

        const hasUserMessage = conversation.messages.some((item) => item.role === "user");
        const nextTitle = hasUserMessage ? conversation.title : buildChatTitle(trimmed);
        const userMessageId = Date.now();

        set((state) => ({
            error: null,
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
                provider,
                model,
                message: trimmed,
                locale: i18n.language,
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
            const messageText =
                error instanceof Error ? error.message : i18n.t("chat.failedToSend");

            set((state) => {
                const updatedConversation = ensureConversation(
                    state.conversations,
                    sessionId,
                    nextTitle,
                );

                return {
                    error: messageText,
                    conversations: {
                        ...state.conversations,
                        [sessionId]: {
                            ...updatedConversation,
                            activeResponseId: null,
                            isResponding: false,
                            messages: [
                                ...updatedConversation.messages,
                                {
                                    id: Date.now() + 1,
                                    role: "assistant",
                                    content: messageText,
                                    timestamp: getTimestamp(),
                                    status: "error",
                                    error: messageText,
                                },
                            ],
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
                session: sessionId,
                id: conversation.activeResponseId,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : i18n.t("chat.failedToStop"),
            });
        }
    },
}));
