import "dotenv/config";

export const Config: {
    defaultTabUrl: string;
    openDevTools: boolean;
    frame: {
        uri: string;
        width: number;
        height: number;
    };
} = {
    defaultTabUrl: process.env.DEFAULT_TAB_URL || "http://localhost:5173",
    openDevTools: process.env.OPEN_DEVTOOLS === "true",
    frame: {
        uri: process.env.DEFAULT_FRAME_URI || "http://localhost:5173",
        width: Number(process.env.DEFAULT_FRAME_WIDTH || "800"),
        height: Number(process.env.DEFAULT_FRAME_HEIGHT || "600"),
    },
};
