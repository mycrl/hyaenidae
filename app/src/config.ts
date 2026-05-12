import { app } from "electron";
import path from "node:path";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

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
    defaultLocalApiKey: string;
};

export let CONFIG: Config = {
    defaultTabUrl: "https://google.com",
    shellUrl: "http://localhost:5173",
    settingsUrl: "http://localhost:5173/#settings",
    defaultWidth: 1280,
    defaultHeight: 760,
    openDevTools: true,
    preloadScriptPath: require.resolve("../dist/preload.js"),
    settingsFilePath: path.join(app.getPath("userData"), "./settings.dat"),
    resourcesDir: path.join(app.getPath("userData"), "./resources"),
    defaultLocalApiKey: randomUUID(),
};

/**
 * Initializes the application configuration by reading from a JSON file. If the
 * file cannot be read or parsed, it falls back to default configuration values.
 *
 * @param path - The file path to the configuration JSON file.
 * Defaults to "../../config.json".
 */
export function initConfig(
    configFilePath = process.env.CONFIG_FILE_PATH ?? require.resolve("../../config.json"),
) {
    console.info("Initializing configuration from", configFilePath);

    try {
        CONFIG = Object.assign(CONFIG, JSON.parse(readFileSync(configFilePath, "utf-8")));
    } catch {
        console.warn("Failed to read configuration file, using default configuration.");
    }

    console.info("Configuration initialized:", CONFIG);
}
