import { ipcRenderer, type WebContents } from "electron";

export interface Layout {
    tabBarHeight: number;
    agentPanelWidth: number;
}

export interface AgentSession {
    session: number;
}

export interface AgentAsk extends AgentSession {
    type: "agent" | "chat";
    model: string;
    message: string;
}

export interface AgentStreamItem extends AgentSession {
    id: number;
    message: string;
}

export interface AgentResult extends AgentSession {
    id: number;
    error?: string;
}

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
     * Toggles the visibility of the agent panel
     */
    "shell:layout-changed": [Layout, void];

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

    /**
     * Retrieves a list of active agent sessions.
     */
    "agent:get-sessions": [void, { sessions: { id: number; name: string }[] }];

    /**
     * Creates a new agent session with an optional name.
     */
    "agent:create-session": [{ name?: string }, { id: number }];

    /**
     * Sends a message to an agent or chat model.
     */
    "agent:ask": [AgentAsk, { id: number }];

    /**
     * Triggers when a response is received from an agent or chat model.
     */
    "agent:response": [AgentStreamItem, void];

    /**
     * Triggers when a response stream from an agent or chat model is completed.
     */
    "agent:response-done": [AgentResult, void];

    /**
     * Stops an ongoing conversation with an agent or chat model, providing the
     * unique ID of the conversation to stop.
     */
    "agent:stop": [AgentSession & { id: number }, void];
}

/**
 * Defines the structure of messages exchanged between the main and renderer
 * processes in the RPC system, including the type of message (request,
 * response, or error) and the associated parameters.
 */
enum MessageType {
    Request = "request",
    Response = "response",
    Error = "error",
}

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

/**
 * Implements a generic RPC service that can be used to send requests and handle
 * responses between the main and renderer processes in an Electron application.
 * The RpcService class manages the sending of messages, handling of responses,
 * and registration of listeners for specific RPC methods.
 */
export class RpcService {
    private counter = 0;
    private listeners: { [key: string]: (message: Message) => void } = {};

    static RPC_METHOD = "rpc:message";

    constructor(
        /**
         * Defines the communication handler for sending and receiving messages.
         * The handler must implement a `send` method for sending messages and
         * an `on` method for registering a callback to handle incoming messages.
         */
        private readonly handler: {
            send: (method: string, message: any) => void;
            on: (method: string, callback: (message: any) => void) => void;
            off: (method: string) => void;
        },
        /**
         * Defines the timeout duration (in milliseconds) for RPC requests. If a
         * response is not received within this time frame, the request will be
         * rejected with a timeout error.
         */
        private readonly timeout: number = 10000,
    ) {
        handler.on(RpcService.RPC_METHOD, (message) => {
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
    async request<T extends keyof RpcInterfaces>(
        method: T,
        params?: RpcInterfaces[T][0],
    ): Promise<RpcInterfaces[T][1]> {
        const id = this.counter++;
        const listenerKey = `${method}-relay-${id}`;

        if (id > U32_MAX) {
            this.counter = 0;
        }

        this.handler.send(RpcService.RPC_METHOD, {
            method,
            id,
            type: MessageType.Request,
            params,
        } as Message);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                delete this.listeners[listenerKey];

                reject(new Error(`RPC request timed out: ${method}`));
            }, this.timeout);

            this.listeners[listenerKey] = (message: Message) => {
                clearTimeout(timeout);

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
     * of the RpcInterfaces type.
     *
     * @param callback - A function that takes the parameters of the RPC request
     * and returns a promise that resolves with the response to be sent back to
     * the requester or rejects with an error if the request cannot be processed.
     */
    handle<T extends keyof RpcInterfaces>(
        method: T,
        callback: (params: RpcInterfaces[T][0]) => Promise<RpcInterfaces[T][1]>,
    ) {
        this.listeners[method] = async (message: Message) => {
            this.handler.send(RpcService.RPC_METHOD, {
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
    }

    /**
     * Unregisters the handler for the specified RPC method, so that it will no
     * longer be called when requests for that method are received.
     *
     * @param method - The name of the RPC method to stop handling, which must
     * be a key of the RpcInterfaces type.
     */
    off<T extends keyof RpcInterfaces>(method: T) {
        delete this.listeners[method];

        this.handler.off(method);
    }

    /**
     * Sends a message for electron ipc channel.
     */
    send<T extends keyof RpcInterfaces>(method: T, params: RpcInterfaces[T][0]) {
        this.handler.send(method, params);
    }

    /**
     * Registers a callback for the specified electron ipc channel.
     */
    on<T extends keyof RpcInterfaces>(method: T, callback: (params: RpcInterfaces[T][0]) => void) {
        this.handler.on(method, callback);
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
        let callbacks: { [key: string]: any } = {};

        super(
            {
                send: (method, message) => {
                    ipcRenderer.send(method, message);
                },
                on: (method, callback) => {
                    callbacks[method] = (_: any, message: any) => {
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
        let callbacks: { [key: string]: any } = {};

        super(
            {
                on: (method, callback) => {
                    callbacks[method] = (_: any, message: any) => {
                        callback(message);
                    };

                    webContents.ipc.on(method, callbacks[method]);
                },
                send: (method, message) => {
                    webContents.send(method, message);
                },
                off: (method) => {
                    if (callbacks[method]) {
                        webContents.ipc.off(method, callbacks[method]);

                        delete callbacks[method];
                    }
                },
            },
            timeout,
        );
    }
}
