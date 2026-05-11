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
    // Optional compact document summary with visible text and actionable candidates.
    document?: {
        // Raw document title, preserved separately so the agent can compare it with the tab title.
        title: string;
        // Document URL after any in-page navigation or redirects.
        url: string;
        // Small text sample from the document body for cheap reasoning.
        textSample: string;
        // Candidate elements that are likely to be interacted with.
        elements: Array<{
            // Screen-space rectangle used for hit testing and fallback mouse actions.
            bounds: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            // DOM tag name for the candidate element.
            tag: string;
            // Stable selector string used by DOM-first actions.
            selector: string;
            // Optional accessibility role if the DOM reader could resolve it.
            role?: string;
            // Visible text content or label text extracted for matching.
            text?: string;
            // Accessible label attribute when text content is not enough.
            ariaLabel?: string;
            // Current control value for inputs and similar form elements.
            value?: string;
            // Link destination for anchors and similar navigation targets.
            href?: string;
            // Placeholder text for empty inputs, useful for form filling.
            placeholder?: string;
        }>;
    };
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
 * Candidate interaction target grounded from visual inspection.
 */
export interface BrowserGroundingTarget {
    // The tab this grounded target belongs to.
    tabId: number;
    // DOM selector when grounding can identify a reliable selector.
    selector?: string;
    // Accessibility role when role-based matching is the safest choice.
    role?: string;
    // Visible text or label that the agent can use for confirmation.
    text?: string;
    // URL target when the grounded result is navigation-oriented.
    url?: string;
    // Physical screen point for fallback click or type actions.
    point?: {
        x: number;
        y: number;
    };
    // Human-readable explanation for why this target was selected.
    reason: string;
    // Confidence level for choosing this target.
    confidence: "low" | "medium" | "high";
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
     * Resolves a textual visual description into likely page targets.
     */
    groundFromVision(input: {
        tabId?: number;
        description: string;
    }): Promise<BrowserGroundingTarget[]>;

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
