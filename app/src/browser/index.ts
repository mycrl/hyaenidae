import { BaseWindow, session, WebContents } from "electron";
import EventEmitter from "node:events";
import { Layout } from "@hyaenidae/bridge";
import { CONFIG } from "../config";
import { SettingsManager } from "../settings";
import { ModelRunnerController } from "../model-runner";
import { Tab, TabType } from "./tab";

/**
 * Smart URL parser that mimics browser address bar behavior with the
 * following rules:
 * 1. If the input contains spaces, treat it as a search query and use the
 *    default search engine.
 * 2. If the input already starts with a protocol (such as http://, https://,
 *    or ftp://), treat it as a URL.
 * 3. If the input matches common website patterns (such as example.com or
 *    www.example.com), automatically prepend https://.
 * 4. Treat all other inputs as search queries and use the default search
 *    engine.
 */
function smartParseURL(
    input: string,
    searchEngine = "https://www.google.com/search?q=",
) {
    const trimmedInput = input.trim();

    if (
        trimmedInput.startsWith("http://") ||
        trimmedInput.startsWith("https://")
    ) {
        return trimmedInput;
    }

    // 1. Treat inputs containing spaces as search queries.
    if (trimmedInput.includes(" ")) {
        return searchEngine + encodeURIComponent(trimmedInput);
    }

    // 2. Check whether the input already includes a protocol.
    if (/^[a-z0-9]+:\/\//i.test(trimmedInput)) {
        return trimmedInput;
    }

    // 3. Detect common website-style hostnames.
    // Pattern: starts with letters or digits, contains dots, and ends with
    // a top-level domain of at least two characters (for example .com or .cn).
    const urlPattern = /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i;

    if (urlPattern.test(trimmedInput)) {
        // Prepend http:// when the protocol is omitted.
        return `http://${trimmedInput}`;
    }

    // 4. Fall back to the default search engine.
    return searchEngine + encodeURIComponent(trimmedInput);
}

function isApplicationRegisteredUrl(url: string) {
    return url == CONFIG.shellUrl || url == CONFIG.settingsUrl;
}

async function loadUrl(webContents: WebContents, uri: string) {
    const url =
        isApplicationRegisteredUrl(uri) || uri == "about:blank"
            ? uri
            : smartParseURL(uri);

    console.info("Loading URL:", url);

    await webContents.loadURL(url);
}

/**
 * Manages the shell UI view and all tab content views inside a single BaseWindow.
 */
export class Browser extends EventEmitter {
    private layout: Layout = { tabBarHeight: 98, agentPanelWidth: 451 };
    private baseWindow: BaseWindow;
    private focusedId: number | null = null;
    private tabs: Tab[] = [];
    private shell: Tab;

    constructor(
        private readonly settingsManager: SettingsManager,
        private readonly modelRunnerController: ModelRunnerController,
    ) {
        super();

        this.baseWindow = new BaseWindow({
            width: CONFIG.defaultWidth,
            height: CONFIG.defaultHeight,
            title: "Hyaenidae",
            frame: false,
            autoHideMenuBar: true,
            titleBarStyle: "hidden",
        });

        this.shell = new Tab(
            TabType.Shell,
            this,
            this.settingsManager,
            this.modelRunnerController,
            {
                webPreferences: {
                    preload: CONFIG.preloadScriptPath,
                    contextIsolation: true,
                },
            },
        );

        // Create the window frame content view
        {
            loadUrl(this.shell.webContents, CONFIG.shellUrl);
            this.syncBounds();
            this.baseWindow.contentView.addChildView(this.shell);

            if (CONFIG.openDevTools) {
                this.shell.webContents.openDevTools({
                    mode: "detach",
                });
            }
        }

        // Handle window resizing to adjust content views
        this.baseWindow.on("resize", () => {
            this.syncBounds();
        });
    }

    /**
     * Recalculates and applies bounds for the shell and all tab views.
     */
    syncBounds() {
        const [width, height] = this.baseWindow.getSize() as [number, number];

        this.shell.setBounds({
            x: 0,
            y: 0,
            width,
            height,
        });

        this.tabs.forEach((tab) => {
            tab.setBounds({
                x: 0,
                y: this.layout.tabBarHeight,
                width: width - this.layout.agentPanelWidth,
                height: height - this.layout.tabBarHeight,
            });
        });
    }

    /**
     * Toggles the visibility of the agent panel and syncs bounds to reflect the
     * change.
     */
    updateLayout(layout: Layout) {
        this.layout = layout;

        this.syncBounds();
    }

    /**
     * Creates a new tab, loads the given URL, wires up events, and returns its
     * ID.
     */
    async create(url: string = "about:blank") {
        const isHyaenidaeUrl = isApplicationRegisteredUrl(url);

        const tab = new Tab(
            TabType.Other,
            this,
            this.settingsManager,
            this.modelRunnerController,
            {
                webPreferences: isHyaenidaeUrl
                    ? {
                          preload: CONFIG.preloadScriptPath,
                          contextIsolation: true,
                      }
                    : {
                          backgroundThrottling: true,
                      },
            },
        );

        if (isHyaenidaeUrl && CONFIG.openDevTools) {
            tab.webContents.openDevTools({
                mode: "detach",
            });
        }

        this.tabs.push(tab);
        this.syncBounds();

        const id = tab.webContents.id;

        await this.shell.getBridge().request("shell:tab-created", { id, url });

        // Focus the new tab after creation to bring it to the front
        await this.focus(id);

        await loadUrl(tab.webContents, url);

        return id;
    }

    /**
     * Removes the tab with the given ID; if focused, auto-focuses an adjacent
     * tab.
     */
    async remove(id: number) {
        const index = this.tabs.findIndex((t) => t.webContents.id === id);
        if (index === -1) {
            return;
        }

        const [tab] = this.tabs.splice(index, 1);
        tab?.destroy();

        /**
         * If there are no tabs left after removal, reset focusedId and emit an
         * event
         */
        if (this.tabs.length === 0) {
            this.focusedId = null;
            this.emit("all-tabs-closed");

            return;
        }

        // If the removed tab was focused, auto-focus an adjacent tab
        if (tab && this.focusedId === id) {
            this.baseWindow.contentView.removeChildView(tab);
            this.focusedId = null;

            // Try to focus the next tab, otherwise the previous tab
            const nextTab = this.tabs[index] || this.tabs[index - 1];
            if (nextTab) {
                await this.focus(nextTab.webContents.id);
            }
        }
    }

    /**
     * Switches the visible content view to the tab with the given ID.
     */
    async focus(id: number) {
        const tab = this.tabs.find((t) => t.webContents.id === id);
        if (tab) {
            /**
             * If there is a currently focused tab, remove it from the content
             * view before adding the new one
             */
            if (this.focusedId != null) {
                const focustab = this.tabs.find(
                    (t) => t.webContents.id === this.focusedId,
                );

                if (focustab) {
                    this.baseWindow.contentView.removeChildView(focustab);
                }
            }

            tab.webContents.focus();
            this.baseWindow.contentView.addChildView(tab);
            this.focusedId = id;

            await this.shell.getBridge().request("shell:tab-focused", { id });
        }
    }

    /**
     * Navigates the tab with the given ID to the specified URL.
     */
    async load(id: number, url: string) {
        const tab = this.tabs.find((t) => t.webContents.id === id);
        if (!tab) {
            return;
        }

        await loadUrl(tab.webContents, url);
    }

    /**
     * Reloads the current page in the tab with the given ID.
     */
    reload(id: number) {
        this.tabs.find((t) => t.webContents.id === id)?.webContents.reload();
    }

    /**
     * Stops any ongoing navigation or resource loading in the tab with the
     * given ID.
     */
    stop(id: number) {
        this.tabs.find((t) => t.webContents.id === id)?.webContents.stop();
    }

    /**
     * Returns the BaseWindow instance of the browser
     */
    getBaseWindow() {
        return this.baseWindow;
    }

    /**
     * Returns an array of all open tabs
     */
    getTabs() {
        return this.tabs;
    }

    /**
     * Returns the shell bridge for communication with the shell tab
     */
    getShellBridge() {
        return this.shell.getBridge();
    }

    /**
     * Returns the currently focused tab, or undefined if no tab is focused.
     */
    getFocusedId() {
        return this.focusedId;
    }

    /**
     * Returns the tab with the given ID, or undefined if not found.
     */
    getTab(id: number) {
        return this.tabs.find((t) => t.webContents.id === id);
    }

    /**
     * Returns the currently focused tab, or undefined if no tab is focused.
     */
    getFocusedTab() {
        return this.focusedId == null ? undefined : this.getTab(this.focusedId);
    }

    /**
     * Get the navigation history of the tab with the given ID.
     */
    getNavigationHistory(id: number) {
        return this.tabs.find((t) => t.webContents.id === id)?.webContents
            .navigationHistory;
    }
}
