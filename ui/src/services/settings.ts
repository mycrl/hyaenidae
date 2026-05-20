import type { ApiProviderSettings, AppSettings } from "@hyaenidae/bridge";
import i18n from "../i18n";

export function createLocalRunnerProvider(): ApiProviderSettings {
    return {
        id: "provider-local",
        name: "local-runner",
        type: "local-runner",
    };
}

export const createProviderSettings = (): ApiProviderSettings => ({
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "openai",
});

export const DEFAULT_SETTINGS: AppSettings = {
    schemaVersion: 1,
    providers: [createLocalRunnerProvider()],
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
    let settings = await hyaenidae.bridge.request("settings:get");

    if (!settings.providers || settings.providers.length === 0) {
        settings.providers = DEFAULT_SETTINGS.providers;
    }

    if (!settings.language) {
        settings.language = i18n.language;
    }

    return settings;
};

export const setSettings = async (settings: AppSettings) => {
    await hyaenidae.bridge.request("settings:set", settings);
};

export const onSettingsChanged = (handler: () => Promise<void> | void) => {
    hyaenidae.bridge.on("settings:changed", async () => {
        await handler();
    });
};
