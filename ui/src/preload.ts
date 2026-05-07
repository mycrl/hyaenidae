import { contextBridge } from "electron";
import { RpcRenderer } from "@hyaenidae/rpc";

const rpcRenderer = new RpcRenderer();

contextBridge.exposeInMainWorld("hyaenidae", {
    rpc: {
        // == RPC API exposed to the renderer process ==

        request: rpcRenderer.request.bind(rpcRenderer),
        send: rpcRenderer.send.bind(rpcRenderer),
        on: rpcRenderer.on.bind(rpcRenderer),
        handle: rpcRenderer.handle.bind(rpcRenderer),
        off: rpcRenderer.off.bind(rpcRenderer),
    },
});
