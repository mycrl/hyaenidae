import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

let globalConfig: any = null;

try {
    globalConfig = import("../config.json");
} catch {
    globalConfig = {};
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
        __APP_CONFIG__: {
            settingsUrl: globalConfig.settingsUrl || "hyaenidae://settings",
        },
    },
});
