export type Optional<T> = T | null;

export interface Layout {
    tabBarHeight: number;
    agentPanelWidth: number;
}

export type ModelProvider = (
    | { type: "google" }
    | { type: "openai" }
    | { type: "custom"; baseUrl: string }
) & { model: string; apiKey?: string };

export interface AgentSession {
    id: number;
    name?: string;
}

export interface AgentAskOptions {
    modelProvider: ModelProvider;
    session: number;
    message: string;
    locale: string;
}

export interface AgentStreamItem {
    sessionId: number;
    askId: number;
    message: string;
}

export interface AgentActivityItem {
    sessionId: number;
    askId: number;
    key: string;
    kind: "reasoning" | "tool" | "status";
    status: "running" | "completed";
    name: string;
    data?: unknown;
}

export interface AgentResult {
    sessionId: number;
    askId: number;
    error?: string;
}

export type AgentResponseEvent =
    | ({ type: "text" } & AgentStreamItem)
    | ({ type: "activity" } & AgentActivityItem)
    | ({ type: "done" } & AgentResult);

export interface ModelInfo {
    id: string;
    name: string;
    downloads: number;
    updatedAt: string;
    links: number;
    task?: string;
    author: string;
    tags: string[];
}

export interface ModelFileInfo {
    type: "model" | "mmproj";
    size: number;
    path: string;
}

export interface StartRunnerOptions {
    model: string;
    modelFile: string;
    mmprojFile?: string;
    runner: string;
}

export interface ShowContextMenuOptions {
    x: number;
    y: number;
    tabId: number;
}

export interface AddToChatOptions {
    tabId: number;
    selected?: {
        content: string;
        type: "text" | "image" | "link";
    };
}

export interface BrowserContextPayload {
    source: "browser";
    tab: {
        id: number;
        title: string | null;
        url: string | null;
    };
    selection?: {
        type: "text" | "image" | "link";
        content: string;
    };
}

export type ApiProviderType = "google" | "openai" | "custom" | "local-runner";

export interface ApiProviderSettings {
    id: string;
    name: Optional<string>;
    type: ApiProviderType;
    baseUrl: Optional<string>;
    apiKey: Optional<string>;
}

export interface LocalRunnerSettings {
    runner: Optional<string>;
    model: Optional<string>;
    modelFile: Optional<string>;
    mmprojFile: Optional<string>;
}

export interface FontSettings {
    standard: Optional<string>;
    serif: Optional<string>;
    sansSerif: Optional<string>;
    monospace: Optional<string>;
}

export interface AppSettings {
    schemaVersion: 1;
    defaultProviderId: Optional<string>;
    defaultModelId: Optional<string>;
    providers: ApiProviderSettings[];
    localRunner: LocalRunnerSettings;
    defaultFontFamily: FontSettings;
    defaultFontSize: Optional<number>;
    homeUrl: Optional<string>;
}
