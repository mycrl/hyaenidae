/**
 * Shared browser capabilities used by the agent runtime, UI, and Electron adapter.
 * Keep this file focused on contracts so the implementation can stay in app/.
 */

/**
 * Lightweight summary of a browser tab exposed to the agent and UI layers.
 */
export interface BrowserTabSummary {
    // Stable numeric identifier for the tab, used across RPC and session state.
    id: number;
    // The most recent tab title shown to the user.
    title: string;
    // The current page URL for display and navigation decisions.
    url: string;
    // Whether this tab is the active focus target.
    isFocused: boolean;
    // Whether the tab is still loading content or navigation is in progress.
    isLoading: boolean;
}

/**
 * Recursive accessibility-oriented node used to describe visible page structure.
 */
export interface BrowserElementNode {
    // Accessibility role such as button, link, textbox, or heading.
    role: string;
    // Human-readable accessible name, when available.
    name?: string;
    // Optional extra description exposed by the accessibility tree.
    description?: string;
    // Current value for editable or stateful controls.
    value?: string;
    // Selector that the action layer can use to target the element.
    selector?: string;
    // Child nodes form the recursive accessibility tree.
    children?: BrowserElementNode[];
}

/**
 * Combined DOM and accessibility snapshot captured from the current page.
 */
export interface BrowserDomSnapshot {
    // The tab this snapshot was captured from.
    tabId: number;
    // Current URL at capture time.
    url: string;
    // Document title at capture time.
    title: string;
    // Optional accessibility tree when the DOM summary alone is not enough.
    accessibility?: BrowserElementNode;
}

/**
 * Encoded screenshot payload returned by the browser runtime.
 */
export interface BrowserImageSnapshot {
    // The tab this screenshot came from.
    tabId: number;
    // MIME type for the image payload, usually image/png.
    mimeType: string;
    // Base64-encoded image data.
    base64: string;
    // Screenshot width in pixels.
    width: number;
    // Screenshot height in pixels.
    height: number;
}

/**
 * Raw result returned from evaluating a script inside a browser tab.
 */
export interface BrowserScriptResult {
    // The tab that executed the script.
    tabId: number;
    // Unstructured script return value from the page context.
    result: unknown;
}

/**
 * Outcome of a browser action such as click, typing, or scrolling.
 */
export interface BrowserActionResult {
    // The tab where the action was attempted.
    tabId: number;
    // Action kind that was attempted.
    action: string;
    // Whether the action succeeded.
    ok: boolean;
    // Optional human-readable failure or diagnostic details.
    details?: string;
}

/**
 * Browser control surface consumed by the agent tooling layer.
 */
export interface BrowserRuntime {
    /**
     * Lists every known tab together with focus and loading state.
     */
    listTabs(): Promise<BrowserTabSummary[]>;

    /**
     * Returns the currently focused tab when one is available.
     */
    getFocusedTab(): Promise<BrowserTabSummary | null>;

    /**
     * Opens a new tab and optionally navigates it to an initial URL.
     */
    openTab(url?: string): Promise<BrowserTabSummary>;

    /**
     * Closes an existing tab and releases its backing resources.
     */
    closeTab(tabId: number): Promise<void>;

    /**
     * Moves browser focus to the requested tab.
     */
    focusTab(tabId: number): Promise<BrowserTabSummary>;

    /**
     * Navigates a tab to a new URL and returns its latest summary.
     */
    load(tabId: number, url: string): Promise<BrowserTabSummary>;

    /**
     * Reloads the current document in a tab.
     */
    reload(tabId: number): Promise<void>;

    /**
     * Steps backward through the tab navigation history.
     */
    goBack(tabId: number): Promise<void>;

    /**
     * Steps forward through the tab navigation history.
     */
    goForward(tabId: number): Promise<void>;

    /**
     * Captures a compact DOM and accessibility snapshot for reasoning.
     */
    snapshotDom(tabId?: number): Promise<BrowserDomSnapshot>;

    /**
     * Captures a screenshot of the visible page for visual inspection.
     */
    captureScreenshot(tabId?: number): Promise<BrowserImageSnapshot>;

    /**
     * Executes JavaScript inside the tab context.
     */
    runScript(input: {
        tabId?: number;
        script: string;
        args?: unknown[];
    }): Promise<BrowserScriptResult>;

    /**
     * Performs a selector-based DOM action against the page.
     */
    act(input: {
        tabId?: number;
        action: "click" | "type" | "scroll";
        selector?: string;
        text?: string;
        direction?: "up" | "down";
        amount?: number;
    }): Promise<BrowserActionResult>;

    /**
     * Performs a coordinate-based fallback action when DOM targeting fails.
     */
    actAtPoint(input: {
        tabId?: number;
        action: "click" | "type";
        x: number;
        y: number;
        text?: string;
    }): Promise<BrowserActionResult>;
}
