import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

let globalConfig: any = null;

try {
    globalConfig = JSON.parse(
        readFileSync(new URL("../config.json", import.meta.url), "utf-8"),
    );
} catch (error) {
    globalConfig = {};
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
        __APP_CONFIG__: {
            settingsUrl: globalConfig.settingsUrl || "hyaenidae://settings",
            downloadsUrl: globalConfig.downloadsUrl || "hyaenidae://downloads",
            defaultTabUrl:
                globalConfig.defaultTabUrl || "https://online.bonjourr.fr",
        },
    },
});
