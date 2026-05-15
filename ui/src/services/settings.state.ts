import { create } from "zustand";
import {
    DEFAULT_SETTINGS,
    getSettings,
    mergeSettings,
    setSettings,
    type AppSettings,
} from "./settings";
import { onSettingsChanged } from "./settings";

interface SettingsState {
    settings: AppSettings;
    initialized: boolean;
    initializeRpc: () => Promise<void>;
    reload: () => Promise<void>;
    save: (settings: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: DEFAULT_SETTINGS,
    initialized: false,
    initializeRpc: async () => {
        if (get().initialized) {
            return;
        }

        set({ initialized: true });
        onSettingsChanged(async () => {
            await get().reload();
        });

        await get().reload();
    },
    reload: async () => {
        set({ settings: await getSettings() });
    },
    save: async (settings) => {
        const nextSettings = mergeSettings(get().settings, settings);
        await setSettings(nextSettings);
        set({ settings: nextSettings });
    },
}));
