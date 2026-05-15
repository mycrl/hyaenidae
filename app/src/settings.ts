import { safeStorage } from "electron";
import { writeFile, readFile } from "node:fs/promises";
import { CONFIG } from "./config";

/**
 * SettingsManager is responsible for reading and writing application settings
 * to a JSON file in the user's data directory. It provides methods to read the
 * current settings and to write new settings, merging them with existing ones.
 *
 * The settings are stored in a file named "settings.json" within a "hyaenidae"
 * subdirectory of the user's data path.
 */
export class SettingsManager {
    private settings: any = null;

    constructor() {
        console.info("SettingsManager initialized with path:", CONFIG.settingsFilePath);
    }

    async load() {
        if (this.settings) {
            return this.settings;
        }

        try {
            this.settings = JSON.parse(
                safeStorage.decryptString(await readFile(CONFIG.settingsFilePath)),
            );

            console.info("Loaded settings:", this.settings);
        } catch {
            console.warn("No existing settings found, starting with empty settings.");
        }

        return this.settings;
    }

    async restore(settings: any) {
        console.info("Restoring settings:", settings);

        this.settings = settings;

        await writeFile(
            CONFIG.settingsFilePath,
            safeStorage.encryptString(JSON.stringify(this.settings)),
        );
    }
}
