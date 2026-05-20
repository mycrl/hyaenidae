/**
 * Layout information used by the UI shell to size different regions.
 */
export interface Layout {
    /**
     * Height of the tab bar in pixels.
     */
    tabBarHeight: number;

    /**
     * Width of the agent side panel in pixels.
     */
    agentPanelWidth: number;
}

/**
 * Basic information about a browser tab, used in various API calls and UI
 * displays.
 */
export interface BaseTabInfo {
    id: number;
    title?: string;
    url?: string;
    focused: boolean;
}

/**
 * Describes a model provider configuration.
 * - When `type` is "custom", a `baseUrl` must be provided.
 * - `model` is required for all providers; `apiKey` is optional.
 */
export type ModelProvider = (
    | { type: "google" }
    | { type: "openai" }
    | { type: "custom"; baseUrl: string }
) & { model: string; apiKey?: string };

/**
 * Minimal metadata for an Agent session, used in UI lists and references.
 */
export interface AgentSession {
    /**
     * Unique session identifier.
     */
    id: number;

    /**
     * Optional human-readable name.
     */
    name?: string;
}

/**
 * Extended Agent session information including conversation history
 */
export interface AgentSessionWithState extends AgentSession {
    chats: {
        role: "user" | "assistant";
        content: string;
    }[];
}

/**
 * Parameters required to make an ask request to an Agent.
 */
export interface AgentAskOptions {
    /**
     * which provider/model to use
     */
    modelProvider: ModelProvider;

    /**
     * target session id
     */
    session: number;

    /**
     * user input text
     */
    message: string;

    /**
     * language for the request
     */
    language: string;
}

/**
 * A single text message item in the agent response stream (partial or final).
 */
export interface AgentStreamItem {
    sessionId: number;
    askId: number;
    message: string;
}

/**
 * Activity events emitted while an agent produces a response (e.g. reasoning,
 * tool calls).
 */
export interface AgentActivityItem {
    sessionId: number;
    askId: number;

    /**
     * Unique key for the activity, useful for deduplication or updates in UI.
     */
    key: string;

    /**
     * Activity kind: reasoning, tool, or generic status.
     */
    kind: "reasoning" | "tool" | "status";

    /**
     * Progress status of the activity.
     */
    status: "running" | "completed";

    /**
     * Name of the activity or tool.
     */
    name: string;

    /**
     * Optional payload with extra activity-specific data.
     */
    data?: unknown;
}

/**
 * Final result object for an Agent ask, optionally containing an error.
 */
export interface AgentResult {
    sessionId: number;
    askId: number;

    /**
     * Error message if the ask failed.
     */
    error?: string;
}

/**
 * Union type for agent response events: text chunks, activity events, or
 * completion.
 */
export type AgentResponseEvent =
    | ({ type: "text" } & AgentStreamItem)
    | ({ type: "activity" } & AgentActivityItem)
    | ({ type: "done" } & AgentResult);

/**
 * Metadata for a model (used to display available models in UI).
 */
export interface ModelInfo {
    /**
     * Model repository / identifier.
     */
    id: string;

    /**
     * Human-readable model name.
     */
    name: string;

    /**
     * Download count (approximate).
     */
    downloads: number;

    /**
     * ISO timestamp of last update.
     */
    updatedAt: string;

    /**
     * Number of external links or references.
     */
    links: number;

    /**
     * Optional task type (e.g. chat, completion).
     */
    task?: string;

    /**
     * Author or publisher.
     */
    author: string;

    /**
     * Tags associated with the model.
     */
    tags: string[];
}

/**
 * Description of a file within a model repository.
 */
export interface ModelFileInfo {
    /**
     * indicates whether it is a model binary or an mmproj project file.
     */
    type: "model" | "mmproj";
    size: number;
    path: string;
}

/**
 * Options required to start a local runner process for a model.
 */
export interface StartRunnerOptions {
    model: string;
    modelFile: string;
    mmprojFile?: string;
    runner: string;
}

/**
 * Coordinates and tab id used when showing a context menu for a tab.
 */
export interface ShowContextMenuOptions {
    x: number;
    y: number;
    tabId: number;
}

/**
 * Parameters to add the current selection into chat input.
 */
export interface AddToChatOptions {
    tabId: number;

    /**
     * Optional selected content with its type.
     */
    selected?: {
        content: string;
        type: "text" | "image" | "link";
    };
}

/**
 * Browser context payload used to send current tab and selection information to
 * other modules (e.g. Agent).
 */
export interface BrowserContextPayload {
    source: "browser";

    /**
     * Basic info about the current tab.
     */
    tab: {
        id: number;
        title: string | null;
        url: string | null;
    };

    /**
     * Optional selection within the page.
     */
    selection?: {
        type: "text" | "image" | "link";
        content: string;
    };
}

/**
 * Supported API provider type string literals.
 */
export type ApiProviderType = "google" | "openai" | "custom" | "local-runner";

/**
 * API provider configuration including identification and connection fields.
 */
export interface ApiProviderSettings {
    /**
     * Unique identifier for the provider.
     */
    id: string;

    /**
     * Display name (optional).
     */
    name?: string;

    /**
     * Provider type.
     */
    type: ApiProviderType;

    /**
     * Base URL for custom providers (only applicable when type === 'custom').
     */
    baseUrl?: string;

    /**
     * API key if required by the provider.
     */
    apiKey?: string;
}

/**
 * Local runner settings and selected model information.
 */
export interface LocalRunnerSettings {
    runner?: string;
    model?: string;
    modelFile?: string;
    mmprojFile?: string;
}

/**
 * Font family settings for semantic positions (standard, serif, sans-serif,
 * monospace).
 */
export interface FontSettings {
    standard?: string;
    serif?: string;
    sansSerif?: string;
    monospace?: string;
}

/**
 * Application-level settings structure exchanged between UI and main process
 * and persisted to disk.
 */
export interface AppSettings {
    /**
     * Schema version for potential migration handling.
     */
    schemaVersion: 1;

    /**
     * Default provider id used by agent UI.
     */
    defaultProviderId?: string;

    /**
     * Default model id for local/remote model selection.
     */
    defaultModelId?: string;

    /**
     * Configured API providers.
     */
    providers?: ApiProviderSettings[];

    /**
     * Settings related to the local runner.
     */
    localRunner?: LocalRunnerSettings;

    /**
     * Default font family settings for semantic slots.
     */
    defaultFontFamily?: FontSettings;

    /**
     * Default font size in pixels, or null to use the system/app default.
     */
    defaultFontSize?: number;

    /**
     * Homepage URL; when null the app default is used.
     */
    homeUrl?: string;

    /**
     * Language setting for the application.
     */
    language?: string;
}

export type DownloadEventType =
    | "progressing"
    | "completed"
    | "cancelled"
    | "interrupted";

/**
 * Event structure for download progress and status updates emitted by the main
 * process when a download is initiated from the renderer (e.g. for model files).
 */
export interface DownloadEvent {
    id: number;
    type: DownloadEventType;
    url: string;
    path: string;
    filename: string;
    isPaused: boolean;
    canResume: boolean;
    bytesPerSecond: number;
    totalBytes: number;
    receivedBytes: number;
    progress: number;
}
