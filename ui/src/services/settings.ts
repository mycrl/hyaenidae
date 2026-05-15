export type ApiProviderType = "google" | "openai" | "custom" | "local-runner";

type NullableString = string | null;

export interface ApiProviderSettings {
    id: string;
    name: NullableString;
    type: ApiProviderType;
    baseUrl: NullableString;
    apiKey: NullableString;
}

export interface LocalRunnerSettings {
    runner: NullableString;
    model: NullableString;
    modelFile: NullableString;
    mmprojFile: NullableString;
}

export interface AppSettings {
    schemaVersion: 1;
    providers: ApiProviderSettings[];
    localRunner: LocalRunnerSettings;
    defaultProviderId: NullableString;
    defaultModelId: NullableString;
}

export const DEFAULT_SETTINGS: AppSettings = {
    schemaVersion: 1,
    providers: [createLocalRunnerProvider()],
    localRunner: createLocalRunnerSettings(),
    defaultProviderId: null,
    defaultModelId: null,
};

export function createLocalRunnerSettings(): LocalRunnerSettings {
    return {
        runner: null,
        model: null,
        modelFile: null,
        mmprojFile: null,
    };
}

export function createLocalRunnerProvider(): ApiProviderSettings {
    return {
        id: "provider-local",
        name: "local-runner",
        type: "local-runner",
        baseUrl: null,
        apiKey: null,
    };
}

export const createProviderSettings = (): ApiProviderSettings => ({
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: null,
    type: "openai",
    baseUrl: null,
    apiKey: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toNullableString = (value: unknown): NullableString => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

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

const normalizeProvider = (value: unknown, index: number): ApiProviderSettings => {
    const provider = isRecord(value) ? value : {};

    return {
        id:
            toNullableString(provider.id) ??
            `provider-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
        name: toNullableString(provider.name),
        type: toProviderType(provider.type),
        baseUrl: toNullableString(provider.baseUrl),
        apiKey: toNullableString(provider.apiKey),
    };
};

export const normalizeSettings = (value: unknown): AppSettings => {
    const record = isRecord(value) ? value : {};
    const localRunner = isRecord(record.localRunner) ? record.localRunner : {};
    const providers = Array.isArray(record.providers)
        ? record.providers.map((provider, index) => normalizeProvider(provider, index))
        : DEFAULT_SETTINGS.providers.map((provider) => ({ ...provider }));

    return {
        schemaVersion: 1,
        providers,
        localRunner: {
            runner: toNullableString(localRunner.runner),
            model: toNullableString(localRunner.model),
            modelFile: toNullableString(localRunner.modelFile),
            mmprojFile: toNullableString(localRunner.mmprojFile),
        },
        defaultProviderId: toNullableString(record.defaultProviderId),
        defaultModelId: toNullableString(record.defaultModelId),
    };
};

export const cloneSettings = (settings: AppSettings): AppSettings => ({
    schemaVersion: settings.schemaVersion,
    providers: settings.providers.map((provider) => ({ ...provider })),
    localRunner: { ...settings.localRunner },
    defaultProviderId: settings.defaultProviderId,
    defaultModelId: settings.defaultModelId,
});

export const mergeSettings = (current: AppSettings, patch: Partial<AppSettings>): AppSettings => {
    return normalizeSettings({
        ...current,
        ...patch,
        providers: patch.providers ?? current.providers,
        localRunner: patch.localRunner
            ? {
                  ...current.localRunner,
                  ...patch.localRunner,
              }
            : current.localRunner,
    });
};

export const getSettings = async (): Promise<AppSettings> => {
    const result = await hyaenidae.bridge.request("shell:settings-get");

    return normalizeSettings(result.settings);
};

export const setSettings = async (settings: AppSettings) => {
    await hyaenidae.bridge.request("shell:settings-set", { settings });
};

export const onSettingsChanged = (handler: () => Promise<void> | void) => {
    hyaenidae.bridge.on("shell:settings-changed", async () => {
        await handler();
    });
};
