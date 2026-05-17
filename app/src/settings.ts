import { safeStorage } from "electron";
import { writeFile } from "node:fs/promises";
import { AppSettings } from "@hyaenidae/bridge";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const WorkDir = path.dirname(process.execPath);

export let ProgramSettings = {
    webviewDir: path.join(WorkDir, "./webview"),
    defaultTabUrl: "https://google.com",
    shellUrl: "hyaenidae://shell",
    settingsUrl: "hyaenidae://settings",
    downloadsUrl: "hyaenidae://downloads",
    defaultWidth: 1280,
    defaultHeight: 760,
    openDevTools: false,
    preloadScriptPath: require.resolve("../dist/preload.js"),
    settingsFilePath: path.join(WorkDir, "./settings.dat"),
    resourcesDir: path.join(WorkDir, "./resources"),
    defaultLocalApiKey: randomUUID(),
};

/**
 * Initializes the application configuration by reading from a JSON file. If the
 * file cannot be read or parsed, it falls back to default configuration values.
 *
 * @param path - The file path to the configuration JSON file.
 * Defaults to "../../config.json".
 */
export function initProgramSettings() {
    for (const filePath of [
        process.env.CONFIG_FILE_PATH ??
            path.join(__dirname, "../../config.json"),
        path.join(WorkDir, "./config.json"),
    ]) {
        console.info("Initializing program settings from", filePath);

        try {
            ProgramSettings = Object.assign(
                ProgramSettings,
                JSON.parse(readFileSync(filePath, "utf-8")),
            );

            break;
        } catch {
            console.warn(`Failed to read program settings ${filePath}`);
        }
    }

    console.info("Program settings initialized:", ProgramSettings);
}

/**
 * SettingsController is responsible for reading and writing application settings
 * to a JSON file in the user's data directory. It provides methods to read the
 * current settings and to write new settings, merging them with existing ones.
 *
 * The settings are stored in a file named "settings.json" within a "hyaenidae"
 * subdirectory of the user's data path.
 */
export class SettingsController {
    private settings: AppSettings | null = null;

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
        if (this.settings) {
            return this.settings;
        }

        try {
            this.settings = JSON.parse(
                safeStorage.decryptString(
                    readFileSync(ProgramSettings.settingsFilePath),
                ),
            );

            console.info("Loaded settings:", this.settings);
        } catch {
            this.settings = {
                schemaVersion: 1,
                providers: [
                    {
                        id: "provider-local",
                        name: "local-runner",
                        type: "local-runner",
                        baseUrl: null,
                        apiKey: null,
                    },
                ],
                localRunner: {
                    runner: null,
                    model: null,
                    modelFile: null,
                    mmprojFile: null,
                },
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

            console.warn(
                "No existing settings found, starting with empty settings.",
            );
        }

        return this.settings!!;
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
