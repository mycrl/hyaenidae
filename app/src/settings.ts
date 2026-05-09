import { app } from "electron";
import { join, dirname } from "node:path";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";

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

    constructor(private path = join(app.getPath("userData"), "hyaenidae/settings.json")) {
        console.log("SettingsManager initialized with path:", this.path);
    }

    async load() {
        if (this.settings) {
            return this.settings;
        }

        try {
            this.settings = JSON.parse(await readFile(this.path, "utf-8"));
        } catch {
            console.warn("No existing settings found, starting with empty settings.");

            this.settings = {};
        }

        return this.settings;
    }

    async restore(settings: any) {
        console.log("Restoring settings:", settings);

        this.settings = {
            ...(this.settings || {}),
            ...settings,
        };

        // Ensure the directory exists before writing the file
        if ((await stat(this.path).catch(() => null)) == null) {
            await mkdir(dirname(this.path), { recursive: true });
        }

        await writeFile(this.path, JSON.stringify(this.settings, null, 4), "utf-8");
    }
}
