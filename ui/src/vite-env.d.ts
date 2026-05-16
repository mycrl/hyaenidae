/// <reference types="vite/client" />

import type { BridgeRenderer } from "@hyaenidae/bridge";

declare global {
    const hyaenidae: {
        bridge: BridgeRenderer;
    };

    interface FontData {
        family: string;
        fullName: string;
        postscriptName: string;
        style: string;
    }

    function queryLocalFonts(): Promise<FontData[]>;

    const __APP_CONFIG__: {
        settingsUrl: string;
        downloadsUrl: string;
        defaultTabUrl: string;
    };
}

declare module "react" {
    interface HTMLAttributes<T> {
        tag?: string;
    }
}

export {};
