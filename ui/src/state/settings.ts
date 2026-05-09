import { create } from "zustand";

export interface ApiProviderSettings {
    id: string;
    name: string;
    baseURL: string;
    apiKey: string;
}

export interface AppSettings {
    schemaVersion: 1;
    providers: ApiProviderSettings[];
    agent: {
        defaultProviderId?: string;
        defaultModel: string;
    };
    extra?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toString = (value: unknown, fallback = "") =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;

export const DEFAULT_SETTINGS: AppSettings = {
    schemaVersion: 1,
    providers: [],
    agent: {
        defaultModel: "gpt-4.1-mini",
    },
    extra: {},
};

export const createProviderSettings = (): ApiProviderSettings => ({
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    baseURL: "",
    apiKey: "",
});

export const normalizeSettings = (value: unknown): AppSettings => {
    const record = isRecord(value) ? value : {};
    const providers = Array.isArray(record.providers)
        ? record.providers.filter(isRecord).map((provider, index) => ({
              id: toString(provider.id, `provider-${index + 1}`),
              name: toString(provider.name, `Provider ${index + 1}`),
              baseURL: toString(provider.baseURL),
              apiKey: toString(provider.apiKey),
          }))
        : [];
    const agent = isRecord(record.agent) ? record.agent : {};
    const extra = isRecord(record.extra) ? record.extra : {};

    return {
        schemaVersion: 1,
        providers,
        agent: {
            ...(typeof agent.defaultProviderId === "string" && agent.defaultProviderId.trim()
                ? { defaultProviderId: agent.defaultProviderId.trim() }
                : {}),
            defaultModel: toString(agent.defaultModel, DEFAULT_SETTINGS.agent.defaultModel),
        },
        extra,
    };
};

const hasRuntimeConfig = (provider: { baseURL?: string; apiKey?: string }) =>
    Boolean(provider.baseURL?.trim() || provider.apiKey?.trim());

const normalizeProviderBaseUrl = (baseURL?: string) => baseURL?.trim() ?? "";

const findMatchingRuntimeProviderIndex = (
    runtimeProviders: { id: number; baseURL: string; apiKey: string }[],
    provider: { baseURL: string },
) =>
    runtimeProviders.findIndex(
        (runtimeProvider) =>
            normalizeProviderBaseUrl(runtimeProvider.baseURL) ===
            normalizeProviderBaseUrl(provider.baseURL),
    );

const dedupeSettingsProviders = (settings: AppSettings): AppSettings => {
    const keptProviderIdsByBaseUrl = new Map<string, string>();
    const providers = settings.providers.filter((provider) => {
        const baseURL = normalizeProviderBaseUrl(provider.baseURL);

        if (!baseURL) {
            return true;
        }

        if (keptProviderIdsByBaseUrl.has(baseURL)) {
            return false;
        }

        keptProviderIdsByBaseUrl.set(baseURL, provider.id);
        return true;
    });

    const defaultProvider = providers.find(
        (provider) => provider.id === settings.agent.defaultProviderId,
    );

    return {
        ...settings,
        providers,
        agent: {
            ...settings.agent,
            ...(defaultProvider ? {} : { defaultProviderId: undefined }),
        },
    };
};

interface SettingsStoreState {
    settings: AppSettings;
    initialized: boolean;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    initializeRpc: () => Promise<void>;
    reload: () => Promise<void>;
    save: (settings: AppSettings) => Promise<AppSettings | null>;
}

const syncRuntimeProviders = async (settings: AppSettings) => {
    const providerResult = await hyaenidae.bridge.request("agent:provider-list");
    const remainingRuntimeProviders = [...(providerResult.providers ?? [])];
    const configuredProviders = settings.providers.filter(hasRuntimeConfig);

    for (const provider of configuredProviders) {
        const matchingIndex = findMatchingRuntimeProviderIndex(remainingRuntimeProviders, provider);

        if (matchingIndex >= 0) {
            remainingRuntimeProviders.splice(matchingIndex, 1);
            continue;
        }

        await hyaenidae.bridge.request("agent:provider-create", {
            baseURL: provider.baseURL,
            apiKey: provider.apiKey,
        });
    }

    for (const provider of remainingRuntimeProviders) {
        await hyaenidae.bridge.request("agent:provider-remove", { id: provider.id });
    }
};

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
    settings: DEFAULT_SETTINGS,
    initialized: false,
    isLoading: false,
    isSaving: false,
    error: null,
    initializeRpc: async () => {
        if (get().initialized) {
            return;
        }

        hyaenidae.bridge.on("shell:settings-changed", async () => {
            await get().reload();
        });

        set({ initialized: true });
        await get().reload();
    },
    reload: async () => {
        set({ isLoading: true, error: null });

        try {
            const result = await hyaenidae.bridge.request("shell:settings-get");
            const normalized = normalizeSettings(result.settings);
            await syncRuntimeProviders(normalized);
            set({
                settings: normalized,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to load settings.",
            });
        }
    },
    save: async (settings) => {
        set({ isSaving: true, error: null });

        try {
            const dedupedSettings = dedupeSettingsProviders(settings);
            await hyaenidae.bridge.request("shell:settings-set", { settings: dedupedSettings });

            const result = await hyaenidae.bridge.request("shell:settings-get");
            const normalized = normalizeSettings(result.settings);
            await syncRuntimeProviders(normalized);

            set({ settings: normalized, isSaving: false, error: null });
            return normalized;
        } catch (error) {
            set({
                isSaving: false,
                error: error instanceof Error ? error.message : "Failed to save settings.",
            });
            return null;
        }
    },
}));
