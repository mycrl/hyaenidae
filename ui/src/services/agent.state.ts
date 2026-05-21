import type { AgentSession } from "@hyaenidae/bridge";
import { create } from "zustand";
import {
    AGENT_ERROR_CODE,
    applyChatResponse,
    askAgent,
    buildAskMessage,
    buildBrowserContextPayload,
    createAddToChatDedupeKey,
    createAgentSession,
    emptyConversation,
    filterConfiguredProviders,
    formatAddToChatLabel,
    getAgentSession,
    getMessageTimestamp,
    getProviderModels,
    listAgentSessions,
    mapChatsToMessages,
    onAddToChat,
    onAgentChatResponse,
    patchConversation,
    stopAgentResponse,
    toAgentError,
    upsertAssistantMessage,
    type AgentConversation,
    type AgentErrorState,
    type AgentInputContext,
    type AgentProviderItem,
} from "./agent";
import { useShellStore } from "./shell.state";
import { getSettings } from "./settings";
import { useSettingsStore } from "./settings.state";

export type { AgentSession } from "@hyaenidae/bridge";
export type {
    AgentActivity,
    AgentConversation,
    AgentErrorCode,
    AgentErrorState,
    AgentInputContext,
    AgentMessage,
    AgentProviderItem,
} from "./agent";
export { AGENT_ERROR_CODE } from "./agent";

export interface ComposerInsertionItem {
    id: number;
    label: string;
    context: AgentInputContext;
    dedupeKey: string;
}

interface AgentState {
    sessions: AgentSession[];
    providers: AgentProviderItem[];
    selectedProviderId?: string;
    selectedModel?: string;
    models: string[];
    conversations: Record<string, AgentConversation>;
    activeSessionId: string | null;
    composerInsertion: ComposerInsertionItem | null;
    error: AgentErrorState | null;
    initialized: boolean;
    isLoadingSessions: boolean;
    isLoadingConversation: boolean;
    initializeRpc: () => Promise<void>;
    loadSessionConversation: (sessionId: string) => Promise<void>;
    refreshProviders: () => Promise<void>;
    selectProvider: (
        id: string,
        options?: { persist?: boolean; preferredModelId?: string },
    ) => Promise<void>;
    setSelectedModel: (model: string) => void;
    createSession: (name?: string) => Promise<string | null>;
    selectSession: (id: string) => Promise<void>;
    queueComposerInsertion: (input: {
        label: string;
        context: AgentInputContext;
        dedupeKey: string;
    }) => void;
    clearComposerInsertion: () => void;
    clearError: () => void;
    ensureActiveSession: () => Promise<string | null>;
    sendMessage: (input: {
        message: string;
        provider: string;
        model: string;
        language: string;
        contexts?: AgentInputContext[];
    }) => Promise<void>;
    stopActiveResponse: () => Promise<void>;
}

const persistAgentDefaults = async (
    providerId: string | undefined,
    modelId: string | undefined,
) => {
    await useSettingsStore.getState().save({
        defaultProviderId: providerId,
        defaultModelId: modelId,
    });
};

export const useAgentStore = create<AgentState>((set, get) => ({
    sessions: [],
    providers: [],
    selectedProviderId: undefined,
    selectedModel: undefined,
    models: [],
    conversations: {},
    activeSessionId: null,
    composerInsertion: null,
    error: null,
    initialized: false,
    isLoadingSessions: false,
    isLoadingConversation: false,

    loadSessionConversation: async (sessionId) => {
        if (get().conversations[sessionId]?.isResponding) {
            return;
        }

        set({ isLoadingConversation: true });

        try {
            const session = await getAgentSession(sessionId);
            if (!session) {
                return;
            }

            set((state) => ({
                sessions: state.sessions.map((item) =>
                    item.id === sessionId
                        ? { id: session.id, name: session.name }
                        : item,
                ),
                conversations: {
                    ...state.conversations,
                    [sessionId]: {
                        title: session.name,
                        messages: mapChatsToMessages(
                            session.id,
                            session.chats,
                        ),
                        activeResponseId: null,
                        isResponding: false,
                    },
                },
                error: null,
            }));
        } catch (error) {
            set({
                error: toAgentError(
                    error,
                    AGENT_ERROR_CODE.FAILED_TO_LOAD_SESSION,
                ),
            });
        } finally {
            set({ isLoadingConversation: false });
        }
    },

    initializeRpc: async () => {
        if (get().initialized) {
            return;
        }

        set({ initialized: true, isLoadingSessions: true });

        onAgentChatResponse((payload) => {
            set((state) => ({
                ...applyChatResponse(state, payload),
            }));
        });

        onAddToChat(async (input) => {
            const shellState = useShellStore.getState();
            const tab = shellState.tabs.find((item) => item.id === input.tabId);
            const contextPayload = buildBrowserContextPayload(
                input,
                tab?.title,
                tab?.url,
            );

            shellState.openAgentPanel();
            get().queueComposerInsertion({
                label: formatAddToChatLabel(input.selected, contextPayload),
                context: { type: "browser", payload: contextPayload },
                dedupeKey: createAddToChatDedupeKey(input),
            });
        });

        try {
            await get().refreshProviders();
            let sessions = await listAgentSessions();

            if (sessions.length === 0) {
                sessions = [await createAgentSession()];
            }

            const activeSessionId =
                get().activeSessionId ?? sessions[0]?.id ?? null;

            set({ sessions, activeSessionId, error: null });

            if (activeSessionId) {
                await get().loadSessionConversation(activeSessionId);
            }
        } catch (error) {
            set({
                error: toAgentError(
                    error,
                    AGENT_ERROR_CODE.FAILED_TO_LOAD_SESSIONS,
                ),
            });
        } finally {
            set({ isLoadingSessions: false });
        }
    },

    refreshProviders: async () => {
        try {
            const settings = await getSettings();
            const providers = filterConfiguredProviders(
                settings.providers ?? [],
            );
            const selectedProviderId = providers.some(
                (provider) => provider.id === settings.defaultProviderId,
            )
                ? settings.defaultProviderId
                : providers.some(
                        (provider) => provider.id === get().selectedProviderId,
                    )
                  ? get().selectedProviderId
                  : providers[0]?.id;

            set({ providers, selectedProviderId });

            if (selectedProviderId) {
                await get().selectProvider(selectedProviderId, {
                    persist: false,
                    preferredModelId:
                        settings.defaultProviderId === selectedProviderId
                            ? settings.defaultModelId
                            : undefined,
                });
            } else {
                set({ models: [], selectedModel: undefined });
            }
        } catch (error) {
            set({
                error: toAgentError(
                    error,
                    AGENT_ERROR_CODE.FAILED_TO_LOAD_MODELS,
                ),
                providers: [],
                selectedProviderId: undefined,
                models: [],
                selectedModel: undefined,
            });
        }
    },

    selectProvider: async (id, options) => {
        const persist = options?.persist ?? true;
        const provider = get().providers.find((item) => item.id === id);

        if (!provider) {
            set({
                selectedProviderId: undefined,
                models: [],
                selectedModel: undefined,
            });
            if (persist) {
                await persistAgentDefaults(undefined, undefined);
            }
            return;
        }

        set({ selectedProviderId: id });

        try {
            const models = await getProviderModels(provider);
            const preferredModelId = options?.preferredModelId;
            const currentSelectedModel = get().selectedModel;
            const nextSelectedModel = preferredModelId
                ? models.includes(preferredModelId)
                    ? preferredModelId
                    : undefined
                : currentSelectedModel &&
                    models.includes(currentSelectedModel)
                  ? currentSelectedModel
                  : undefined;

            set({ models, selectedModel: nextSelectedModel, error: null });

            if (persist) {
                await persistAgentDefaults(id, nextSelectedModel);
            }
        } catch (error) {
            set({
                error: toAgentError(
                    error,
                    AGENT_ERROR_CODE.FAILED_TO_LOAD_MODELS,
                ),
                models: [],
                selectedModel: undefined,
            });
            if (persist) {
                await persistAgentDefaults(id, undefined);
            }
        }
    },

    setSelectedModel: (model) => {
        const nextModel = model.trim() ? model : undefined;
        set({ selectedModel: nextModel });

        const selectedProviderId = get().selectedProviderId;
        if (selectedProviderId) {
            void persistAgentDefaults(selectedProviderId, nextModel);
        }
    },

    createSession: async (name) => {
        try {
            const session = await createAgentSession(name);

            set((state) => ({
                sessions: [...state.sessions, session],
                conversations: {
                    ...state.conversations,
                    [session.id]: emptyConversation(session.name),
                },
                activeSessionId: session.id,
                error: null,
            }));

            return session.id;
        } catch (error) {
            set({
                error: toAgentError(
                    error,
                    AGENT_ERROR_CODE.FAILED_TO_CREATE_SESSION,
                ),
            });
            return null;
        }
    },

    selectSession: async (id) => {
        set({ activeSessionId: id });
        await get().loadSessionConversation(id);
    },

    queueComposerInsertion: ({ label, context, dedupeKey }) => {
        const nextLabel = label.trim();
        const nextDedupeKey = dedupeKey.trim();
        if (!nextLabel || !nextDedupeKey) {
            return;
        }

        set({
            composerInsertion: {
                id: Date.now(),
                label: nextLabel,
                context,
                dedupeKey: nextDedupeKey,
            },
        });
    },

    clearComposerInsertion: () => set({ composerInsertion: null }),
    clearError: () => set({ error: null }),

    ensureActiveSession: async () => {
        const { activeSessionId, sessions } = get();
        if (activeSessionId) {
            return activeSessionId;
        }

        const firstSessionId = sessions[0]?.id;
        if (firstSessionId) {
            set({ activeSessionId: firstSessionId });
            return firstSessionId;
        }

        return get().createSession();
    },

    sendMessage: async ({ message, provider, model, language, contexts }) => {
        const trimmed = message.trim();
        const nextMessage = buildAskMessage(trimmed, contexts);

        if (!nextMessage || !model.trim()) {
            return;
        }

        const providerConfig = get().providers.find(
            (item) => item.id === provider,
        );
        if (!providerConfig) {
            return;
        }

        const sessionId = await get().ensureActiveSession();
        if (!sessionId) {
            return;
        }

        const sessionName = get().sessions.find(
            (item) => item.id === sessionId,
        )?.name;

        set((state) => ({
            conversations: patchConversation(
                state,
                sessionId,
                (conversation) => ({
                    ...conversation,
                    isResponding: true,
                    messages: [
                        ...conversation.messages,
                        {
                            id: crypto.randomUUID(),
                            role: "user",
                            content: trimmed,
                            timestamp: getMessageTimestamp(),
                            status: "done",
                        },
                    ],
                }),
                sessionName,
            ),
        }));

        try {
            const askId = await askAgent({
                session: sessionId,
                provider: providerConfig,
                model,
                message: nextMessage,
                language,
            });

            set((state) => ({
                conversations: patchConversation(
                    state,
                    sessionId,
                    (conversation) => ({
                        ...conversation,
                        activeResponseId: askId,
                        isResponding: true,
                        messages: upsertAssistantMessage(
                            conversation.messages,
                            askId,
                            (item) => item,
                            () => ({
                                id: askId,
                                role: "assistant",
                                content: "",
                                timestamp: getMessageTimestamp(),
                                status: "streaming",
                                activities: [],
                            }),
                        ),
                    }),
                    sessionName,
                ),
                error: null,
            }));
        } catch (error) {
            set((state) => ({
                conversations: patchConversation(
                    state,
                    sessionId,
                    (conversation) => ({
                        ...conversation,
                        activeResponseId: null,
                        isResponding: false,
                        messages: [
                            ...conversation.messages,
                            {
                                id: crypto.randomUUID(),
                                role: "assistant",
                                content: "",
                                timestamp: getMessageTimestamp(),
                                status: "error",
                                errorCode: AGENT_ERROR_CODE.FAILED_TO_SEND,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : undefined,
                            },
                        ],
                    }),
                    sessionName,
                ),
                error: null,
            }));
        }
    },

    stopActiveResponse: async () => {
        const sessionId = get().activeSessionId;
        if (!sessionId) {
            return;
        }

        const askId = get().conversations[sessionId]?.activeResponseId;
        if (!askId) {
            return;
        }

        try {
            await stopAgentResponse(askId);
        } catch (error) {
            set((state) => ({
                conversations: patchConversation(
                    state,
                    sessionId,
                    (conversation) => ({
                        ...conversation,
                        messages: [
                            ...conversation.messages,
                            {
                                id: crypto.randomUUID(),
                                role: "assistant",
                                content: "",
                                timestamp: getMessageTimestamp(),
                                status: "error",
                                errorCode: AGENT_ERROR_CODE.FAILED_TO_STOP,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : undefined,
                            },
                        ],
                    }),
                ),
                error: null,
            }));
        }
    },
}));
