export interface BrowserTabSummary {
    id: number;
    title: string;
    url: string;
    isFocused: boolean;
    isLoading: boolean;
}

export interface BrowserElementNode {
    role: string;
    name?: string;
    description?: string;
    value?: string;
    selector?: string;
    children?: BrowserElementNode[];
}

export interface BrowserDomSnapshot {
    tabId: number;
    url: string;
    title: string;
    document?: {
        title: string;
        url: string;
        textSample: string;
        elements: Array<{
            bounds: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            tag: string;
            selector: string;
            role?: string;
            text?: string;
            ariaLabel?: string;
            value?: string;
            href?: string;
            placeholder?: string;
        }>;
    };
    accessibility?: BrowserElementNode;
}

export interface BrowserVisionSnapshot {
    tabId: number;
    mimeType: string;
    base64: string;
    width: number;
    height: number;
}

export interface BrowserGroundingTarget {
    tabId: number;
    selector?: string;
    role?: string;
    text?: string;
    url?: string;
    point?: {
        x: number;
        y: number;
    };
    reason: string;
    confidence: "low" | "medium" | "high";
}

export interface BrowserScriptResult {
    tabId: number;
    result: unknown;
}

export interface BrowserActionResult {
    tabId: number;
    action: string;
    ok: boolean;
    details?: string;
}

export interface BrowserRuntime {
    listTabs(): Promise<BrowserTabSummary[]>;
    getFocusedTab(): Promise<BrowserTabSummary | null>;
    openTab(url?: string): Promise<BrowserTabSummary>;
    closeTab(tabId: number): Promise<void>;
    focusTab(tabId: number): Promise<BrowserTabSummary>;
    load(tabId: number, url: string): Promise<BrowserTabSummary>;
    reload(tabId: number): Promise<void>;
    goBack(tabId: number): Promise<void>;
    goForward(tabId: number): Promise<void>;
    snapshotDom(tabId?: number): Promise<BrowserDomSnapshot>;
    captureVision(tabId?: number): Promise<BrowserVisionSnapshot>;
    groundFromVision(input: {
        tabId?: number;
        description: string;
    }): Promise<BrowserGroundingTarget[]>;
    runScript(input: {
        tabId?: number;
        script: string;
        args?: unknown[];
    }): Promise<BrowserScriptResult>;
    act(input: {
        tabId?: number;
        action: "click" | "type" | "scroll";
        selector?: string;
        text?: string;
        direction?: "up" | "down";
        amount?: number;
    }): Promise<BrowserActionResult>;
    actAtPoint(input: {
        tabId?: number;
        action: "click" | "type";
        x: number;
        y: number;
        text?: string;
    }): Promise<BrowserActionResult>;
}
