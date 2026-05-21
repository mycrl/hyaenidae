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
    id: string;

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
    session: string;

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
    sessionId: string;
    askId: string;
    message: string;
}

/**
 * Activity payload streamed from the agent runtime before IPC metadata.
 */
export type AgentActivityEvent =
    | {
          key: string;
          type: "reasoning";
          data?: { text: string };
      }
    | {
          key: string;
          type: "tool";
          status: "running";
          tool: string;
          data: { arguments: Record<string, unknown> };
      }
    | {
          key: string;
          type: "tool";
          status: "completed";
          tool: string;
          data: { output: unknown; isError: boolean };
      }
    | {
          key: string;
          type: "compression";
          status: "running";
      }
    | {
          key: string;
          type: "compression";
          status: "completed";
          data?: { error?: string };
      }
    | {
          key: string;
          type: "renamed";
          data: { title: string };
      }
    | {
          key: string;
          type: "agentSwitched";
          data: { agentName: string };
      };

/**
 * Activity events emitted while an agent produces a response (e.g. reasoning,
 * tool calls).
 */
export type AgentActivityItem = AgentActivityEvent & {
    sessionId: string;
    askId: string;
};

/**
 * Final result object for an Agent ask, optionally containing an error.
 */
export interface AgentResult {
    sessionId: string;
    askId: string;

    /**
     * Error message if the ask failed.
     */
    error?: string;
}

/**
 * Union type for agent response events: text chunks, activity events, or
 * completion.
 *
 * Uses `kind` for the stream envelope so activity payloads can use `type`
 * without colliding with `kind: "activity"`.
 */
export type AgentResponseEvent =
    | ({ kind: "text" } & AgentStreamItem)
    | ({ kind: "activity" } & AgentActivityItem)
    | ({ kind: "done" } & AgentResult);

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
export type ApiProviderType = "google" | "openai" | "custom";

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
