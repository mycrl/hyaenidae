import { ipcRenderer, type WebContents } from "electron";

export interface RpcInterfaces {
    /**
     * Navigates forward to the next history entry in the specified tab
     */
    "shell:tab-go-forward": [{ id: number }, void];

    /**
     * Navigates backward to the previous history entry in the specified tab
     */
    "shell:tab-go-back": [{ id: number }, void];

    /**
     * Checks if the specified tab can navigate backward in its history, returning
     * a boolean indicating whether backward navigation is possible
     */
    "shell:tab-can-go-back": [{ id: number }, boolean];

    /**
     * Checks if the specified tab can navigate forward in its history, returning a
     * boolean indicating whether forward navigation is possible
     */
    "shell:tab-can-go-forward": [{ id: number }, boolean];

    /**
     * Pushes a new URL into the history of the specified tab
     */
    "shell:tab-load": [{ id: number; url: string }, void];

    /**
     * Flushes the browsing history of the specified tab
     */
    "shell:tab-reload": [{ id: number }, void];

    /**
     * Stops the current navigation or page load in the specified tab
     */
    "shell:tab-stop-load": [{ id: number }, void];

    /**
     * Closes the specified tab
     */
    "shell:tab-close": [{ id: number }, void];

    /**
     * Focuses on and activates the specified tab
     */
    "shell:tab-focus": [{ id: number }, void];

    /**
     * Creates a new tab
     */
    "shell:tab-new": [{ url?: string }, { id: number }];

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
     * Triggers when the layout of the application changes, such as when tabs
     * are rearranged or moved between windows
     */
    "shell:layout-change": [void, void];

    /**
     * Triggers when a tab's title is updated, providing the tab ID and the new
     * title
     */
    "shell:tab-title-changed": [{ id: number; title: string }, void];

    /**
     * Triggers when a tab is destroyed, providing the ID of the destroyed tab
     */
    "shell:tab-destroyed": [{ id: number }, void];

    /**
     * Triggers when a tab starts navigating to a new URL, providing the tab ID
     * and the URL being navigated to
     */
    "shell:tab-start-loading": [{ id: number }, void];

    /**
     * Triggers when a tab finishes navigating to a new URL, providing the tab ID,
     * the URL that was navigated to, and whether the tab can navigate backward
     * or forward in its history
     */
    "shell:tab-stop-loading": [{ id: number }, void];

    /**
     * Triggers when a tab's URL is updated (e.g., due to in-page navigation),
     * providing the tab ID and the new URL
     */
    "shell:tab-url-updated": [{ id: number; url: string }, void];

    /**
     * Triggers when a new tab is created, providing the ID of the new tab and
     * optionally the URL it was created with
     */
    "shell:tab-created": [{ id: number; url?: string }, void];

    /**
     * Triggers when a tab is focused, providing the ID of the focused tab
     */
    "shell:tab-focused": [{ id: number }, void];

    /**
     * Triggers when the application is ready, indicating that the main process
     * has completed initialization and the renderer process can start rendering
     * the UI
     */
    "shell:ready": [void, void];
}

/**
 * Defines the structure of messages exchanged between the main and renderer
 * processes in the RPC system, including the type of message (request,
 * response, or error) and the associated parameters.
 */
enum RpcMessageType {
    Request = "request",
    Response = "response",
    Error = "error",
}

/**
 * Defines the structure of an RPC message, which includes a unique identifier (id),
 * the type of message (request, response, or error), and the parameters associated
 * with the message.
 */
interface RpcMessage {
    id: number;
    type: RpcMessageType;
    params: any;
}

/**
 * Implements a generic RPC service that can be used to send requests and handle
 * responses between the main and renderer processes in an Electron application.
 * The RpcService class manages the sending of messages, handling of responses,
 * and registration of listeners for specific RPC methods.
 */
export class RpcService {
    private counter = 0;
    private listeners: { [key: string]: (message: RpcMessage) => void } = {};

    constructor(
        /**
         * Defines the communication handler for sending and receiving messages.
         * The handler must implement a `send` method for sending messages and
         * an `on` method for registering a callback to handle incoming messages.
         */
        private readonly handler: {
            send: (method: string, message: RpcMessage) => void;
            on: (
                callback: (method: string, message: RpcMessage) => void,
            ) => void;
        },
        /**
         * Defines the timeout duration (in milliseconds) for RPC requests. If a
         * response is not received within this time frame, the request will be
         * rejected with a timeout error.
         */
        private readonly timeout: number = 10000,
    ) {
        handler.on((method, message) => {
            const listener = this.listeners[method];
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
     * of the RpcInterfaces type.
     *
     * @param params - The parameters to send with the RPC request, which must
     * match the expected parameters for the specified method in the RpcInterfaces
     * type.
     *
     * @returns A promise that resolves with the response from the RPC call or
     * rejects with an error if the request times out or if an error response is
     * received.
     */
    public async ask<T extends keyof RpcInterfaces>(
        method: T,
        params?: RpcInterfaces[T][0],
    ): Promise<RpcInterfaces[T][1]> {
        const id = this.counter++;
        const listenerKey = `${method}-relay-${id}`;

        this.handler.send(method, { id, type: RpcMessageType.Request, params });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                delete this.listeners[listenerKey];

                reject(new Error(`RPC request timed out: ${method}`));
            }, this.timeout);

            this.listeners[listenerKey] = (message: RpcMessage) => {
                clearTimeout(timeout);

                message.type === RpcMessageType.Error
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
     * of the RpcInterfaces type.
     *
     * @param callback - A function that takes the parameters of the RPC request
     * and returns a promise that resolves with the response to be sent back to
     * the requester or rejects with an error if the request cannot be processed.
     */
    public on<T extends keyof RpcInterfaces>(
        method: T,
        callback: (params: RpcInterfaces[T][0]) => Promise<RpcInterfaces[T][1]>,
    ) {
        this.listeners[method] = (message: RpcMessage) => {
            callback(message.params)
                .then((result) => {
                    this.handler.send(`${method}-relay-${message.id}`, {
                        id: message.id,
                        type: RpcMessageType.Response,
                        params: result,
                    });
                })
                .catch((err: any) => {
                    this.handler.send(`${method}-relay-${message.id}`, {
                        id: message.id,
                        type: RpcMessageType.Error,
                        params: err.message,
                    });
                });
        };
    }

    /**
     * Unregisters the handler for the specified RPC method, so that it will no
     * longer be called when requests for that method are received.
     *
     * @param method - The name of the RPC method to stop handling, which must
     * be a key of the RpcInterfaces type.
     */
    public off<T extends keyof RpcInterfaces>(method: T) {
        delete this.listeners[method];
    }
}

/**
 * Implements the RPC service for the renderer process in an Electron application.
 *
 * The RpcRenderer class extends the RpcService class and uses the ipcRenderer
 * module to send and receive messages between the renderer and main processes.
 * It provides a convenient interface for making RPC calls from the renderer
 * process to the main process and handling responses.
 */
export class RpcRenderer extends RpcService {
    constructor(timeout?: number) {
        super(
            {
                send: (method, message) => {
                    ipcRenderer.send("rpc:message", method, message);
                },
                on: (callback) => {
                    ipcRenderer.on("rpc:message", (_, method, message) => {
                        callback(method, message);
                    });
                },
            },
            timeout,
        );
    }
}

/**
 * Implements the RPC service for the main process in an Electron application.
 *
 * The RpcMain class extends the RpcService class and uses the ipcMain module to
 * send and receive messages between the main and renderer processes. It provides
 * a convenient interface for making RPC calls from the main process to the
 * renderer process and handling responses. The constructor takes a WebContents
 * instance, which is used to send messages to the appropriate renderer process.
 */
export class RpcMain extends RpcService {
    constructor(webContents: WebContents, timeout?: number) {
        super(
            {
                on: (callback) =>
                    webContents.ipc.on("rpc:message", (_, method, message) => {
                        callback(method, message);
                    }),
                send: (method, message) => {
                    webContents.send("rpc:message", method, message);
                },
            },
            timeout,
        );
    }
}
