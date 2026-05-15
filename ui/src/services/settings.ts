import type {
    ApiProviderSettings,
    ApiProviderType,
    AppSettings,
    LocalRunnerSettings,
    Optional,
} from "@hyaenidae/bridge";

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

export const DEFAULT_SETTINGS: AppSettings = {
    schemaVersion: 1,
    providers: [createLocalRunnerProvider()],
    localRunner: createLocalRunnerSettings(),
    defaultProviderId: null,
    defaultModelId: null,
    defaultFontFamily: {
        standard: null,
        serif: null,
        sansSerif: null,
        monospace: null,
    },
    defaultFontSize: null,
    homeUrl: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toNullableString = (value: unknown): Optional<string> => {
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
    const defaultFontFamily = isRecord(record.defaultFontFamily) ? record.defaultFontFamily : {};

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
        defaultFontFamily: {
            standard: toNullableString(defaultFontFamily.standard),
            serif: toNullableString(defaultFontFamily.serif),
            sansSerif: toNullableString(defaultFontFamily.sansSerif),
            monospace: toNullableString(defaultFontFamily.monospace),
        },
        defaultFontSize: typeof record.defaultFontSize === "number" ? record.defaultFontSize : null,
        homeUrl: toNullableString(record.homeUrl),
    };
};

export const cloneSettings = (settings: AppSettings): AppSettings => ({
    schemaVersion: settings.schemaVersion,
    providers: settings.providers.map((provider) => ({ ...provider })),
    localRunner: { ...settings.localRunner },
    defaultProviderId: settings.defaultProviderId,
    defaultModelId: settings.defaultModelId,
    defaultFontFamily: { ...settings.defaultFontFamily },
    defaultFontSize: settings.defaultFontSize,
    homeUrl: settings.homeUrl,
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
