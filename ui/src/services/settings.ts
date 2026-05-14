import { create } from "zustand";

export type ApiProviderType = "google" | "openai" | "custom" | "local-runner";

export interface ApiProviderSettings {
    id: string;
    name: string;
    type: ApiProviderType;
    baseUrl: string;
    apiKey: string;
}

export interface LocalRunnerSettings {
    runnerId: string;
    modelRepo: string;
    modelFile: string;
    mmprojFile: string;
}

export interface AppSettings {
    schemaVersion: 1;
    providers: ApiProviderSettings[];
    localRunner: LocalRunnerSettings;
}

export const SETTINGS_ERROR_CODE = {
    LOAD_FAILED: "load_failed",
    SAVE_FAILED: "save_failed",
} as const;

export interface SettingsErrorState {
    code: (typeof SETTINGS_ERROR_CODE)[keyof typeof SETTINGS_ERROR_CODE] | null;
    message: string | null;
}

export type SettingsErrorCode = NonNullable<SettingsErrorState["code"]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toString = (value: unknown, fallback = "") =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;

export const DEFAULT_SETTINGS: AppSettings = {
    schemaVersion: 1,
    providers: [createLocalRunnerProvider()],
    localRunner: createLocalRunnerSettings(),
};

export function createLocalRunnerSettings(): LocalRunnerSettings {
    return {
        runnerId: "",
        modelRepo: "",
        modelFile: "",
        mmprojFile: "",
    };
}

export function createLocalRunnerProvider(): ApiProviderSettings {
    return {
        id: "provider-local",
        name: "local-runner",
        type: "local-runner",
        baseUrl: "",
        apiKey: "",
    };
}

export const createProviderSettings = (): ApiProviderSettings => ({
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    type: "openai",
    baseUrl: "",
    apiKey: "",
});

const toProviderType = (value: unknown): ApiProviderType => {
    switch (value) {
        case "google":
        case "openai":
        case "custom":
        case "local-runner":
            return value;
        default:
            return "openai";
    }
};

export const normalizeSettings = (value: unknown): AppSettings => {
    const record = isRecord(value) ? value : {};
    const localRunnerRecord = isRecord(record.localRunner) ? record.localRunner : {};
    const providers = Array.isArray(record.providers)
        ? record.providers.filter(isRecord).map((provider, index) => ({
              id: toString(provider.id, `provider-${index + 1}`),
              name: toString(provider.name),
              type: toProviderType(provider.type),
              baseUrl: toString(provider.baseUrl ?? provider.baseURL),
              apiKey: toString(provider.apiKey),
          }))
        : [];
    const localRunnerProvider = providers.find((provider) => provider.type === "local-runner");
    const normalizedProviders = [
        localRunnerProvider ?? createLocalRunnerProvider(),
        ...providers.filter((provider) => provider.type !== "local-runner"),
    ];

    return {
        schemaVersion: 1,
        providers: normalizedProviders.map((provider) =>
            provider.type === "local-runner"
                ? {
                      ...createLocalRunnerProvider(),
                      id: provider.id || "provider-local",
                      name: provider.name || "local-runner",
                      baseUrl: normalizeProviderBaseUrl(provider.baseUrl),
                      apiKey: toString(provider.apiKey),
                  }
                : provider,
        ),
        localRunner: {
            runnerId: toString(localRunnerRecord.runnerId),
            modelRepo: toString(localRunnerRecord.modelRepo ?? localRunnerRecord.model),
            modelFile: toString(localRunnerRecord.modelFile),
            mmprojFile: toString(localRunnerRecord.mmprojFile),
        },
    };
};

const normalizeProviderBaseUrl = (baseUrl?: string) => baseUrl?.trim() ?? "";

const dedupeSettingsProviders = (settings: AppSettings): AppSettings => {
    const keptProviderIds = new Set<string>();
    const providers = settings.providers.filter((provider) => {
        const id = provider.id.trim();

        if (!id) {
            return false;
        }

        if (keptProviderIds.has(id)) {
            return false;
        }

        keptProviderIds.add(id);
        return true;
    });

    return {
        ...settings,
        providers: providers.map((provider) => ({
            ...provider,
            baseUrl: normalizeProviderBaseUrl(provider.baseUrl),
        })),
        localRunner: {
            runnerId: settings.localRunner.runnerId.trim(),
            modelRepo: settings.localRunner.modelRepo.trim(),
            modelFile: settings.localRunner.modelFile.trim(),
            mmprojFile: settings.localRunner.mmprojFile.trim(),
        },
    };
};

interface SettingsStoreState {
    settings: AppSettings;
    initialized: boolean;
    isLoading: boolean;
    isSaving: boolean;
    error: SettingsErrorState | null;
    initializeRpc: () => Promise<void>;
    reload: () => Promise<void>;
    save: (settings: AppSettings) => Promise<AppSettings | null>;
}

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
            set({
                settings: normalized,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            set({
                isLoading: false,
                error:
                    error instanceof Error
                        ? {
                              code: null,
                              message: error.message,
                          }
                        : {
                              code: SETTINGS_ERROR_CODE.LOAD_FAILED,
                              message: null,
                          },
            });
        }
    },
    save: async (settings) => {
        set({ isSaving: true, error: null });

        try {
            const dedupedSettings = dedupeSettingsProviders(settings);
            await hyaenidae.bridge.request("shell:settings-set", {
                settings: dedupedSettings,
            });

            const result = await hyaenidae.bridge.request("shell:settings-get");
            const normalized = normalizeSettings(result.settings);

            set({ settings: normalized, isSaving: false, error: null });
            return normalized;
        } catch (error) {
            set({
                isSaving: false,
                error:
                    error instanceof Error
                        ? {
                              code: null,
                              message: error.message,
                          }
                        : {
                              code: SETTINGS_ERROR_CODE.SAVE_FAILED,
                              message: null,
                          },
            });
            return null;
        }
    },
}));
