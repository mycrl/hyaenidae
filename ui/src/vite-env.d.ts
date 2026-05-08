/// <reference types="vite/client" />

import type { BridgeRenderer } from "@hyaenidae/bridge";

declare global {
    const hyaenidae: {
        bridge: BridgeRenderer;
    };
}

export {};
