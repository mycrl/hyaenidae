// Shared browser capabilities used by the agent runtime, UI, and Electron adapter.
// Keep this file focused on contracts so the implementation can stay in app/.

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

export interface BrowserScriptResult {
    // The tab that executed the script.
    tabId: number;
    // Unstructured script return value from the page context.
    result: unknown;
}

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

export interface BrowserRuntime {
    // Tab lifecycle and navigation primitives.
    // These are the high-level controls the agent uses to manage browser context.
    // Returns all known tabs, including the focused tab and loading state.
    listTabs(): Promise<BrowserTabSummary[]>;
    // Returns the currently focused tab, or null when no browser tab is active.
    getFocusedTab(): Promise<BrowserTabSummary | null>;
    // Opens a new tab and optionally loads a URL into it.
    openTab(url?: string): Promise<BrowserTabSummary>;
    // Closes the specified tab and releases its browser resources.
    closeTab(tabId: number): Promise<void>;
    // Moves focus to the specified tab and returns its latest summary.
    focusTab(tabId: number): Promise<BrowserTabSummary>;
    // Navigates the specified tab to a new URL.
    load(tabId: number, url: string): Promise<BrowserTabSummary>;
    // Reloads the current page in the specified tab.
    reload(tabId: number): Promise<void>;
    // Navigates the specified tab back in its history, if possible.
    goBack(tabId: number): Promise<void>;
    // Navigates the specified tab forward in its history, if possible.
    goForward(tabId: number): Promise<void>;

    // Read-only inspection surfaces.
    // Prefer these before acting, because they let the agent reason without mutating the page.
    // Produces a compact DOM and accessibility snapshot for page reasoning.
    snapshotDom(tabId?: number): Promise<BrowserDomSnapshot>;
    // Captures a screenshot for visual inspection and grounding.
    captureScreenshot(tabId?: number): Promise<BrowserImageSnapshot>;
    // Uses the screenshot or visual context to suggest candidate targets for a text description.
    groundFromVision(input: {
        tabId?: number;
        description: string;
    }): Promise<BrowserGroundingTarget[]>;

    // Direct execution surfaces used for helper scripts and fallback interaction.
    // These are escape hatches when inspection is not sufficient or the page requires a stronger primitive.
    // Executes a script inside the tab context and returns its result.
    runScript(input: {
        tabId?: number;
        script: string;
        args?: unknown[];
    }): Promise<BrowserScriptResult>;
    // Performs a DOM-first action such as click, type, or scroll.
    act(input: {
        tabId?: number;
        action: "click" | "type" | "scroll";
        selector?: string;
        text?: string;
        direction?: "up" | "down";
        amount?: number;
    }): Promise<BrowserActionResult>;
    // Performs a fallback action at a screen coordinate when selector-based control is not enough.
    actAtPoint(input: {
        tabId?: number;
        action: "click" | "type";
        x: number;
        y: number;
        text?: string;
    }): Promise<BrowserActionResult>;
}
