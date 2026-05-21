import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// prettier-ignore
// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
        CONFIG: {
            settingsUrl: process.env.HYAENIDAE_SETTINGS_URL || "hyaenidae://settings",
            downloadsUrl:process.env.HYAENIDAE_DOWNLOADS_URL || "hyaenidae://downloads",
            defaultTabUrl: process.env.HYAENIDAE_DEFAULT_TAB_URL || "https://online.bonjourr.fr",
        },
    },
});
