/// <reference types="vite/client" />

import type { RpcRenderer } from "@hyaenidae/rpc";

declare global {
    const hyaenidae: {
        rpc: RpcRenderer;
    };
}

export {};
