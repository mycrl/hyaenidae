import type {
    ApiProviderSettings,
    AppSettings,
    LocalRunnerSettings,
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

export const cloneSettings = (settings: AppSettings): AppSettings => {
    return JSON.parse(JSON.stringify(settings));
};

export const mergeSettings = (
    current: AppSettings,
    patch: Partial<AppSettings>,
): AppSettings => {
    return {
        ...current,
        ...patch,
        providers: patch.providers ?? current.providers,
        localRunner: patch.localRunner
            ? {
                  ...current.localRunner,
                  ...patch.localRunner,
              }
            : current.localRunner,
    };
};

export const getSettings = async (): Promise<AppSettings> => {
    return await hyaenidae.bridge.request("settings:get");
};

export const setSettings = async (settings: AppSettings) => {
    await hyaenidae.bridge.request("settings:set", settings);
};

export const onSettingsChanged = (handler: () => Promise<void> | void) => {
    hyaenidae.bridge.on("settings:changed", async () => {
        await handler();
    });
};
