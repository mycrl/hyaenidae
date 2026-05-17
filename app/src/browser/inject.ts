import { contextBridge } from "electron";
import { BridgeRenderer } from "@hyaenidae/bridge";

const bridge = new BridgeRenderer();

/**
 * Expose the bridge API to the renderer process. This allows the renderer to
 * communicate with the main process using the defined bridge methods.
 *
 * The API is exposed under the global `hyaenidae` object, which contains a
 * `bridge` property with the necessary methods for communication.
 *
 * This setup ensures that the renderer process can safely interact with the
 * main process without exposing any unnecessary APIs or functionality.
 *
 * The methods exposed include:
 * - `request`: For making requests to the main process and receiving responses.
 * - `send`: For sending messages to the main process without expecting a response.
 * - `on`: For listening to events from the main process.
 * - `handle`: For handling requests from the main process.
 * - `off`: For removing event listeners or handlers.
 *
 * This design promotes a clear separation of concerns and enhances the security
 * of the application by only exposing the necessary communication methods to
 * the renderer process.
 */
contextBridge.exposeInMainWorld("hyaenidae", {
    bridge: {
        request: bridge.request.bind(bridge),
        send: bridge.send.bind(bridge),
        on: bridge.on.bind(bridge),
        handle: bridge.handle.bind(bridge),
        off: bridge.off.bind(bridge),
    },
});
