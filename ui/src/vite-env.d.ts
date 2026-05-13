/// <reference types="vite/client" />

import type { BridgeRenderer } from "@hyaenidae/bridge";

declare global {
    const hyaenidae: {
        bridge: BridgeRenderer;
    };

    const __APP_CONFIG__: {
        settingsUrl: string;
    };
}

declare module "react" {
    interface HTMLAttributes<T> {
        tag?: string;
    }
}

export {};
