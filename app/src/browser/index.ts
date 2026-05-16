import { BaseWindow } from "electron";
import EventEmitter from "node:events";
import { Layout } from "@hyaenidae/bridge";
import { CONFIG } from "../config";
import { SettingsManager } from "../settings";
import { ModelRunnerController } from "../runner";
import { Tab, TabType } from "./tab";
import { UriProcessor } from "./uri";
import { DownloadController } from "./download";

/**
 * Manages the shell UI view and all tab content views inside a single BaseWindow.
 */
export class Browser extends EventEmitter {
    public baseWindow: BaseWindow;
    public downloadController = new DownloadController();

    /**
     * The ID of the currently focused tab, or null if no tab is focused
     * (e.g. when all tabs are closed).
     */
    public focusedId: number | null = null;

    // All tabs except the shell tab.
    public tabs: Tab[] = [];

    // The shell tab is a special tab that hosts the main UI and is always present.
    public shell: Tab;

    /**
     * The layout state controls the dimensions of the tab bar and agent panel,
     * which can be toggled on and off. When the agent panel is toggled, tab
     * bounds are automatically recalculated to fit the remaining space.
     */
    public layout: Layout = {
        tabBarHeight: 98,
        agentPanelWidth: 451,
    };

    constructor(
        public readonly settingsManager: SettingsManager,
        public readonly modelRunnerController: ModelRunnerController,
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

        /**
         * Create the shell tab first since it's needed to host the main UI and
         * coordinate events for all other tabs. The shell tab is hidden behind
         * the scenes and doesn't navigate like regular tabs, so it doesn't need
         * to be managed in the tabs array.
         */
        {
            this.shell = new Tab(TabType.Shell, this, {
                webPreferences: {
                    preload: CONFIG.preloadScriptPath,
                    contextIsolation: true,
                },
            });

            this.shell.loadUrl(CONFIG.shellUrl);
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

        this.downloadController.on("progressing-change", (progressing) => {
            this.shell.bridge.send("download:progressing-changed", progressing);
        });
    }

    /**
     * Notifies all application pages and the shell that settings were persisted.
     */
    notifySettingsChanged() {
        this.shell.bridge.send("settings:changed");

        for (const tab of this.tabs) {
            if (tab.type === TabType.Application) {
                tab.bridge.send("settings:changed");
            }
        }
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
        const isApplicationUrl = UriProcessor.isApplicationRegisteredUrl(url);

        const tab = new Tab(
            isApplicationUrl ? TabType.Application : TabType.Other,
            this,
            {
                webPreferences: isApplicationUrl
                    ? {
                          preload: CONFIG.preloadScriptPath,
                          contextIsolation: true,
                      }
                    : {
                          backgroundThrottling: true,
                      },
            },
        );

        if (isApplicationUrl && CONFIG.openDevTools) {
            tab.webContents.openDevTools({
                mode: "detach",
            });
        }

        this.tabs.push(tab);
        this.syncBounds();

        const id = tab.webContents.id;

        await this.shell.bridge.request("shell:tab-created", { id, url });

        // Focus the new tab after creation to bring it to the front
        await this.focus(id);

        await tab.loadUrl(url);

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

            await this.shell.bridge.request("shell:tab-focused", id);
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

        await tab.loadUrl(url);
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
