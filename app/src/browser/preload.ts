import { contextBridge } from "electron";
import { BridgeRenderer } from "@hyaenidae/bridge";

const bridge = new BridgeRenderer();

contextBridge.exposeInMainWorld("hyaenidae", {
    bridge: {
        // == bridge API exposed to the renderer process ==

        request: bridge.request.bind(bridge),
        send: bridge.send.bind(bridge),
        on: bridge.on.bind(bridge),
        handle: bridge.handle.bind(bridge),
        off: bridge.off.bind(bridge),
    },
});
