import { contextBridge } from "electron";
import { RpcRenderer } from "@hyaenidae/rpc";

const rpcRenderer = new RpcRenderer();

contextBridge.exposeInMainWorld("hyaenidae", {
    rpc: {
        // == RPC API exposed to the renderer process ==

        ask: rpcRenderer.ask.bind(rpcRenderer),
        on: rpcRenderer.on.bind(rpcRenderer),
        off: rpcRenderer.off.bind(rpcRenderer),
    },
});
