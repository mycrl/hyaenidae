import { ipcRenderer, type WebContents } from "electron";
import * as Types from "./types";

export * from "./types";

export interface Api {
    /**
     * ============== Shell and Tab Management =============
     */

    /**
     * Lists every open content tab (excludes the hidden shell view).
     */
    "shell:get-tabs": [void, Types.BaseTabInfo[]];

    /**
     * Navigates forward in the tab history stack.
     *
     * @param tabId - WebContents id of the target tab.
     */
    "shell:tab-go-forward": [number, void];

    /**
     * Navigates backward in the tab history stack.
     *
     * @param tabId - WebContents id of the target tab.
     */
    "shell:tab-go-back": [number, void];

    /**
     * Whether the tab has a previous history entry.
     *
     * @param tabId - WebContents id of the target tab.
     * @returns True when back navigation is allowed.
     */
    "shell:tab-can-go-back": [number, boolean];

    /**
     * Whether the tab has a next history entry.
     *
     * @param tabId - WebContents id of the target tab.
     * @returns True when forward navigation is allowed.
     */
    "shell:tab-can-go-forward": [number, boolean];

    /**
     * Loads a URL in the given tab.
     */
    "shell:tab-load": [{ id: number; url: string }, void];

    /**
     * Reloads the current page in the tab.
     *
     * @param tabId - WebContents id of the target tab.
     */
    "shell:tab-reload": [number, void];

    /**
     * Stops an in-flight navigation or resource load.
     *
     * @param tabId - WebContents id of the target tab.
     */
    "shell:tab-stop-load": [number, void];

    /**
     * Closes and destroys a content tab.
     *
     * @param tabId - WebContents id of the tab to close.
     */
    "shell:tab-close": [number, void];

    /**
     * Brings a tab to the foreground in the window.
     *
     * @param tabId - WebContents id of the tab to focus.
     */
    "shell:tab-focus": [number, void];

    /**
     * Opens a new content tab and focuses it.
     *
     * @param initialUrl - Optional URL to load; omit for the default blank page.
     * @returns WebContents id assigned to the new tab.
     */
    "shell:tab-new": [string | undefined, number];

    /**
     * Reports shell chrome dimensions so the main process can size WebViews.
     */
    "shell:layout-changed": [Types.Layout, void];

    /**
     * Pushed when the document title changes.
     */
    "shell:tab-title-changed": [{ id: number; title: string }, void];

    /**
     * Pushed when a content tab is closed.
     *
     * @param tabId - WebContents id of the tab that was destroyed.
     */
    "shell:tab-destroyed": [number, void];

    /**
     * Pushed when a tab begins loading a document.
     *
     * @param tabId - WebContents id of the tab that started loading.
     */
    "shell:tab-start-loading": [number, void];

    /**
     * Pushed when a tab finishes loading (success or failure).
     *
     * @param tabId - WebContents id of the tab that stopped loading.
     */
    "shell:tab-stop-loading": [number, void];

    /**
     * Pushed when the tab's committed URL changes.
     */
    "shell:tab-url-updated": [{ id: number; url: string }, void];

    /**
     * Pushed after a new content tab is created.
     */
    "shell:tab-created": [{ id: number; url?: string }, void];

    /**
     * Pushed when a tab becomes the focused content view.
     *
     * @param tabId - WebContents id of the focused tab.
     */
    "shell:tab-focused": [number, void];

    /**
     * Triggers when the application is ready, indicating that the main process
     * has completed initialization and the renderer process can start rendering
     * the UI
     */
    "shell:ready": [void, void];

    /**
     * Minimizes the application window
     */
    "shell:minimize": [void, void];

    /**
     * Maximizes the application window
     */
    "shell:maximize": [void, void];

    /**
     * Restores the application window to its previous size
     */
    "shell:restore": [void, void];

    /**
     * Exits the application
     */
    "shell:quit": [void, void];

    /**
     * Triggers when the context menu should be shown
     */
    "shell:show-context-menu": [Types.ShowContextMenuOptions, void];

    /**
     * Adds the currently selected content (text, image, or link) to the chat input
     */
    "shell:add-to-chat": [Types.AddToChatOptions, void];

    /**
     * ============== Settings Management =============
     */

    /**
     * Loads persisted application settings from disk.
     */
    "settings:get": [void, Types.AppSettings];

    /**
     * Merges and persists a settings patch.
     */
    "settings:set": [Partial<Types.AppSettings>, void];

    /**
     * Pushed when settings are persisted (from any application page or shell).
     */
    "settings:changed": [void, void];

    /**
     * ============== Browser Download Management =============
     */

    /**
     * Pushed when a browser download item is created or its state changes.
     */
    "download:item-updated": [Types.DownloadEvent, void];

    /**
     * Pushed when the shell should show or hide the “downloading” chrome state.
     *
     * @param progressing - True while at least one download is in progress.
     */
    "download:progressing-changed": [boolean, void];

    /**
     * Lists in-flight browser downloads tracked by the main process.
     */
    "download:get-items": [void, Types.DownloadEvent[]];

    /**
     * Pauses a browser download.
     *
     * @param downloadId - Download item id (`DownloadEvent.id`).
     */
    "download:pause": [number, void];

    /**
     * Resumes a paused browser download.
     *
     * @param downloadId - Download item id (`DownloadEvent.id`).
     */
    "download:resume": [number, void];

    /**
     * Cancels a browser download.
     *
     * @param downloadId - Download item id (`DownloadEvent.id`).
     */
    "download:cancel": [number, void];

    /**
     * ============== Model Management =============
     */

    /**
     * Search Hugging Face for GGUF model repositories.
     */
    "model:search": [{ query: string; limit?: number }, Types.ModelInfo[]];

    /**
     * Lists downloadable files in a Hugging Face model repository.
     *
     * @param modelId - Repository id (e.g. `org/model-name`).
     */
    "model:get-files": [string, Types.ModelFileInfo[]];

    /**
     * Download a model artifact (and optional mmproj) into the local cache.
     */
    "model:download": [{ name: string; files: Types.ModelFileInfo[] }, void];

    /**
     * Pushed when a Hugging Face model download fails.
     */
    "model:download-failed": [
        { name: string; path: string; error: string },
        void,
    ];

    /**
     * Pushed periodically during a Hugging Face model download (progress 0–1).
     */
    "model:download-progress": [
        { name: string; path: string; progress: number },
        void,
    ];

    /**
     * Lists model repository names already cached on disk.
     */
    "model:get-local-models": [void, string[]];

    /**
     * Lists files for one locally cached model.
     *
     * @param modelId - Local model directory name.
     */
    "model:get-local-model-files": [string, Types.ModelFileInfo[]];

    /**
     * Deletes a locally cached model directory.
     *
     * @param modelId - Local model directory name to remove.
     */
    "model:remove-local-model": [string, void];

    /**
     * Lists installed local inference runner bundles.
     *
     * @returns Runner directory names available to start.
     */
    "model:get-runners": [void, string[]];

    /**
     * Whether a local model runner process is currently running.
     *
     * @returns True when the loader subprocess is active.
     */
    "model:get-runner-status": [void, boolean];

    /**
     * Start a runner for the specified local model and return connection info.
     */
    "model:start-runner": [
        Types.StartRunnerOptions,
        { baseUrl: string; apiKey: string },
    ];

    /**
     * Stop the currently running local runner (if any).
     */
    "model:stop-runner": [void, void];

    /**
     * ============== Agent Management =============
     */

    /**
     * Fetches model ids available for an API provider configuration.
     */
    "agent:provider-get-models": [Types.ModelProvider, string[]];

    /**
     * Lists agent chat sessions stored in the main process.
     */
    "agent:session-list": [void, Types.AgentSession[]];

    /**
     * Creates a new agent conversation session.
     *
     * @param name - Optional display name; omit for a default title.
     */
    "agent:session-create": [string | undefined, Types.AgentSession];

    /**
     * Deletes an agent session and its messages.
     *
     * @param sessionId - Agent session id (`AgentSession.id`).
     */
    "agent:session-remove": [number, void];

    /**
     * Starts an agent turn (stream chunks on `agent:chat-response`).
     *
     * @returns Ask id used to correlate streamed events and `agent:chat-stop`.
     */
    "agent:chat-ask": [Types.AgentAskOptions, number];

    /**
     * Streams text, tool activity, completion, and errors for one ask.
     */
    "agent:chat-response": [Types.AgentResponseEvent, void];

    /**
     * Cancels an in-flight agent response.
     *
     * @param askId - Ask id returned from `agent:chat-ask`.
     */
    "agent:chat-stop": [number, void];
}

/**
 * Defines the structure of messages exchanged between the main and renderer
 * processes in the RPC system, including the type of message (request,
 * response, or error) and the associated parameters.
 */
const MessageType = {
    Request: "request",
    Response: "response",
    Error: "error",
} as const;

type MessageType = (typeof MessageType)[keyof typeof MessageType];

/**
 * Defines the structure of an RPC message, which includes a unique identifier (id),
 * the type of message (request, response, or error), and the parameters associated
 * with the message.
 */
interface Message {
    id: number;
    method: string;
    type: MessageType;
    params: any;
}

const U32_MAX = 4294967295;
const BRIDGE_RPC_EVENT_NAME = "rpc:message";

/**
 * Defines the communication handler for sending and receiving messages.
 * The handler must implement a `send` method for sending messages and
 * an `on` method for registering a callback to handle incoming messages.
 */
type BridgeHandler = {
    send: (method: string, message: any) => void;
    on: (method: string, callback: (message: any) => void) => void;
    off: (method: string) => void;
};

/**
 * Implements a generic RPC service that can be used to send requests and handle
 * responses between the main and renderer processes in an Electron application.
 * The RpcService class manages the sending of messages, handling of responses,
 * and registration of listeners for specific RPC methods.
 */
export class BridgeService {
    private counter = 0;
    private handler: BridgeHandler;
    private listeners: { [key: string]: (message: Message) => void } = {};

    constructor(handler: BridgeHandler) {
        this.handler = handler;

        handler.on(BRIDGE_RPC_EVENT_NAME, (message) => {
            const listener = this.listeners[message.method];
            if (listener) {
                listener(message);
            }
        });
    }

    /**
     * Sends an RPC request for the specified method with the given parameters
     * and returns a promise that resolves with the response or rejects with an
     * error if the request times out or if an error response is received.
     *
     * @param method - The name of the RPC method to call, which must be a key
     * of the Api type.
     *
     * @param params - The parameters to send with the RPC request, which must
     * match the expected parameters for the specified method in the Api
     * type.
     *
     * @returns A promise that resolves with the response from the RPC call or
     * rejects with an error if the request times out or if an error response is
     * received.
     */
    async request<T extends keyof Api>(
        method: T,
        params?: Api[T][0],
        { timeout }: { timeout: number } = { timeout: 10000 },
    ): Promise<Api[T][1]> {
        const id = this.counter++;
        const listenerKey = `${method}-relay-${id}`;

        if (id > U32_MAX) {
            this.counter = 0;
        }

        this.handler.send(BRIDGE_RPC_EVENT_NAME, {
            method,
            id,
            type: MessageType.Request,
            params,
        } as Message);

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                delete this.listeners[listenerKey];

                reject(new Error(`RPC request timed out: ${method}`));
            }, timeout);

            this.listeners[listenerKey] = (message: Message) => {
                clearTimeout(timer);

                message.type === MessageType.Error
                    ? reject(new Error(message.params))
                    : resolve(message.params);

                delete this.listeners[listenerKey];
            };
        });
    }

    /**
     * Registers a handler for the specified RPC method, which will be called
     * whenever a request for that method is received. The callback function
     * should return a promise that resolves with the response to be sent back
     * to the requester or rejects with an error if the request cannot be processed.
     *
     * @param method - The name of the RPC method to handle, which must be a key
     * of the Api type.
     *
     * @param callback - A function that takes the parameters of the RPC request
     * and returns a promise that resolves with the response to be sent back to
     * the requester or rejects with an error if the request cannot be processed.
     */
    handle<T extends keyof Api>(
        method: T,
        callback: (params: Api[T][0]) => Promise<Api[T][1]>,
    ) {
        this.listeners[method] = async (message: Message) => {
            this.handler.send(BRIDGE_RPC_EVENT_NAME, {
                id: message.id,
                method: `${method}-relay-${message.id}`,
                ...(await callback(message.params)
                    .then((params) => ({
                        type: MessageType.Response,
                        params,
                    }))
                    .catch((err: any) => ({
                        type: MessageType.Error,
                        params: err.message,
                    }))),
            });
        };

        return this;
    }

    /**
     * Unregisters the handler for the specified RPC method, so that it will no
     * longer be called when requests for that method are received.
     *
     * @param method - The name of the RPC method to stop handling, which must
     * be a key of the Api type.
     */
    off<T extends keyof Api>(method: T) {
        delete this.listeners[method];

        this.handler.off(method);
    }

    /**
     * Sends a message for electron ipc channel.
     */
    send<T extends keyof Api>(method: T, params?: Api[T][0]) {
        this.handler.send(method, params);
    }

    /**
     * Registers a callback for the specified electron ipc channel.
     */
    on<T extends keyof Api>(method: T, callback: (params: Api[T][0]) => void) {
        this.handler.on(method, callback);

        return this;
    }
}

/**
 * Implements the RPC service for the renderer process in an Electron application.
 *
 * The BridgeRenderer class extends the BridgeService class and uses the ipcRenderer
 * module to send and receive messages between the renderer and main processes.
 * It provides a convenient interface for making RPC calls from the renderer
 * process to the main process and handling responses.
 */
export class BridgeRenderer extends BridgeService {
    constructor() {
        let callbacks: { [key: string]: any } = {};

        super({
            send: (method, message) => {
                console.debug("Renderer Sending IPC message:", method, message);

                ipcRenderer.send(method, message);
            },
            on: (method, callback) => {
                callbacks[method] = (_: any, message: any) => {
                    console.debug(
                        "Renderer Received IPC message:",
                        method,
                        message,
                    );

                    callback(message);
                };

                ipcRenderer.on(method, callbacks[method]);
            },
            off: (method) => {
                if (callbacks[method]) {
                    ipcRenderer.off(method, callbacks[method]);

                    delete callbacks[method];
                }
            },
        });
    }
}

/**
 * Implements the RPC service for the main process in an Electron application.
 *
 * The Bridge class extends the BridgeService class and uses the ipcMain module to
 * send and receive messages between the main and renderer processes. It provides
 * a convenient interface for making RPC calls from the main process to the
 * renderer process and handling responses. The constructor takes a WebContents
 * instance, which is used to send messages to the appropriate renderer process.
 */
export class Bridge extends BridgeService {
    constructor(webContents: WebContents) {
        let callbacks: { [key: string]: any } = {};

        super({
            on: (method, callback) => {
                callbacks[method] = (_: any, message: any) => {
                    console.debug(
                        "Main Received IPC message:",
                        method,
                        message,
                    );

                    callback(message);
                };

                webContents.ipc.on(method, callbacks[method]);
            },
            send: (method, message) => {
                console.debug("Main Sending IPC message:", method, message);

                webContents.send(method, message);
            },
            off: (method) => {
                if (callbacks[method]) {
                    webContents.ipc.off(method, callbacks[method]);

                    delete callbacks[method];
                }
            },
        });
    }
}
