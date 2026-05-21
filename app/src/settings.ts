import { safeStorage } from "electron";
import { writeFile } from "node:fs/promises";
import { AppSettings } from "@hyaenidae/bridge";
import { readFileSync } from "node:fs";
import path from "node:path";

const WorkDir = path.dirname(process.execPath);

// prettier-ignore
export const ProgramSettings = {
    webviewDir: process.env.HYAENIDAE_WEBVIEW_DIR ?? path.join(WorkDir, "./webview"),
    defaultTabUrl: process.env.HYAENIDAE_DEFAULT_TAB_URL ?? "https://google.com",
    shellUrl: process.env.HYAENIDAE_SHELL_URL ?? "hyaenidae://shell",
    settingsUrl: process.env.HYAENIDAE_SETTINGS_URL ?? "hyaenidae://settings",
    downloadsUrl: process.env.HYAENIDAE_DOWNLOADS_URL ?? "hyaenidae://downloads",
    defaultWidth: parseInt(process.env.HYAENIDAE_DEFAULT_WIDTH ?? "1280", 10),
    defaultHeight: parseInt(process.env.HYAENIDAE_DEFAULT_HEIGHT ?? "760", 10),
    openDevTools: process.env.HYAENIDAE_OPEN_DEV_TOOLS === "true",
    preloadScriptPath: process.env.HYAENIDAE_PRELOAD_SCRIPT_PATH ?? require.resolve("../dist/preload.js"),
    settingsFilePath: process.env.HYAENIDAE_SETTINGS_FILE_PATH ?? path.join(WorkDir, "./settings.dat"),
};

/**
 * SettingsController is responsible for reading and writing application settings
 * to a JSON file in the user's data directory. It provides methods to read the
 * current settings and to write new settings, merging them with existing ones.
 *
 * The settings are stored in a file named "settings.json" within a "hyaenidae"
 * subdirectory of the user's data path.
 */
export class SettingsController {
    private isReady: boolean = false;
    private settings: AppSettings = {
        schemaVersion: 1,
    };

    constructor() {
        console.info(
            "SettingsController initialized with path:",
            ProgramSettings.settingsFilePath,
        );
    }

    /**
     * Loads the settings from the settings file. If the file does not exist or cannot
     * be read, it initializes the settings with default values. The settings are
     * decrypted using Electron's safeStorage API and parsed from JSON.
     */
    load() {
        if (this.isReady) {
            return this.settings;
        }

        {
            try {
                this.settings = JSON.parse(
                    safeStorage.decryptString(
                        readFileSync(ProgramSettings.settingsFilePath),
                    ),
                );

                console.info("Loaded settings:", this.settings);
            } catch {
                console.warn(
                    "No existing settings found, starting with empty settings.",
                );
            }

            this.isReady = true;
        }

        return this.settings;
    }

    /**
     * Writes the provided settings to the settings file. It merges the new settings with
     * the existing settings to ensure that only the specified fields are updated. The
     * merged settings are then encrypted using Electron's safeStorage API and written
     * to the file system.
     */
    async restore(settings: Partial<AppSettings>) {
        console.info("Restoring settings:", settings);

        this.settings = Object.assign(this.settings as any, settings);

        await writeFile(
            ProgramSettings.settingsFilePath,
            safeStorage.encryptString(JSON.stringify(this.settings)),
        );
    }
}
