import { safeStorage } from "electron";
import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { CONFIG } from "./config";
import { AppSettings } from "@hyaenidae/bridge";

/**
 * SettingsManager is responsible for reading and writing application settings
 * to a JSON file in the user's data directory. It provides methods to read the
 * current settings and to write new settings, merging them with existing ones.
 *
 * The settings are stored in a file named "settings.json" within a "hyaenidae"
 * subdirectory of the user's data path.
 */
export class SettingsManager {
    private settings: AppSettings | null = null;

    constructor() {
        console.info("SettingsManager initialized with path:", CONFIG.settingsFilePath);
    }

    load() {
        if (this.settings) {
            return this.settings;
        }

        try {
            this.settings = JSON.parse(
                safeStorage.decryptString(readFileSync(CONFIG.settingsFilePath)),
            );

            console.info("Loaded settings:", this.settings);
        } catch {
            this.settings = {
                schemaVersion: 1,
                providers: [],
                localRunner: {},
                defaultFontFamily: {},
            } as unknown as AppSettings;

            console.warn("No existing settings found, starting with empty settings.");
        }

        return this.settings!!;
    }

    async restore(settings: Partial<AppSettings>) {
        console.info("Restoring settings:", settings);

        this.settings = Object.assign(this.settings as any, settings);

        await writeFile(
            CONFIG.settingsFilePath,
            safeStorage.encryptString(JSON.stringify(this.settings)),
        );
    }
}
