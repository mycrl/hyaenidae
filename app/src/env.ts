import "dotenv/config";

export const Env = {
    defaultTabUrl: process.env.DEFAULT_TAB_URL || "http://localhost:5173",
    openDevTools: process.env.OPEN_DEVTOOLS === "true",
    shellUri: process.env.SHELL_URI || "http://localhost:5173",
    defaultShellWidth: Number(process.env.DEFAULT_SHELL_WIDTH || "1280"),
    defaultShellHeight: Number(process.env.DEFAULT_SHELL_HEIGHT || "760"),
    defaultModelApiKey: process.env.DEFAULT_MODEL_API_KEY || "hyaenidae",
    defaultModelBaseURL: process.env.DEFAULT_MODEL_BASE_URL || "http://127.0.0.1:8000/v1",
};
