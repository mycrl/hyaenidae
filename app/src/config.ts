import { app } from "electron";
import path from "node:path";
import { readFileSync } from "node:fs";

export type Config = {
    defaultTabUrl: string;
    shellUrl: string;
    settingsUrl: string;
    defaultWidth: number;
    defaultHeight: number;
    openDevTools: boolean;
    preloadScriptPath: string;
    settingsFilePath: string;
    resourcesDir: string;
};

const DEFAULT_CONFIG: Config = {
    defaultTabUrl: "https://google.com",
    shellUrl: "http://localhost:5173",
    settingsUrl: "http://localhost:5173/#settings",
    defaultWidth: 1280,
    defaultHeight: 760,
    openDevTools: true,
    preloadScriptPath: path.resolve("../../ui/dist/preload.js"),
    settingsFilePath: path.join(app.getPath("userData"), "./settings.dat"),
    resourcesDir: path.join(app.getPath("userData"), "./resources"),
};

export let CONFIG: Config = {} as any;

/**
 * Initializes the application configuration by reading from a JSON file. If the
 * file cannot be read or parsed, it falls back to default configuration values.
 *
 * @param path - The file path to the configuration JSON file.
 * Defaults to "../../config.json".
 */
export function initConfig(configFilePath = path.resolve("../../config.json")) {
    console.info("Initializing configuration from", configFilePath);

    try {
        CONFIG = Object.assign(DEFAULT_CONFIG, JSON.parse(readFileSync(configFilePath, "utf-8")));
    } catch {
        console.warn("Failed to read configuration file, using default configuration.");

        CONFIG = DEFAULT_CONFIG;
    }
}
