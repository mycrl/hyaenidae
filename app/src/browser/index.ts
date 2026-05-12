import { BaseWindow, WebContentsView } from "electron";
import EventEmitter from "node:events";
import { Layout, Bridge } from "@hyaenidae/bridge";
import { CONFIG } from "../config";
import { SettingsManager } from "../settings";
import { LocalModelsManager } from "../model-runner/models";
import { ModelRunnerCounter } from "../model-runner";

export function isApplicationRegisteredUrl(url: string) {
    return url == CONFIG.shellUrl || url == CONFIG.settingsUrl;
}

/**
 * Extended WebContentsView with a built-in RPC channel.
 */
export class View extends WebContentsView {
    public readonly bridge = new Bridge(this.webContents);

    constructor(options: Electron.WebContentsViewConstructorOptions) {
        super(options);
    }

    destroy() {
        this.webContents.close();
    }
}

/**
 * Manages the shell UI view and all tab content views inside a single BaseWindow.
 */
export class Browser extends EventEmitter {
    private layout: Layout = { tabBarHeight: 98, agentPanelWidth: 451 };

    public baseWindow: BaseWindow;
    public currentId: number | null = null;
    public tabs: View[] = [];
    public shell: View;

    constructor(
        private readonly settingsManager: SettingsManager,
        private readonly modelRunnerCounter: ModelRunnerCounter,
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

        console.info("Browser view initialized");

        this.shell = new View({
            webPreferences: {
                preload: CONFIG.preloadScriptPath,
                contextIsolation: true,
            },
        });

        console.info("Shell view initialized");

        // Create the window frame content view
        {
            this.shell.webContents.loadURL(CONFIG.shellUrl);
            this.baseWindow.contentView.addChildView(this.shell);
            this.syncBounds();

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

        console.info("Creating new tab with URL:", url);

        const tab = new View({
            webPreferences: isHyaenidaeUrl
                ? {
                      preload: CONFIG.preloadScriptPath,
                      contextIsolation: true,
                  }
                : {
                      backgroundThrottling: true,
                  },
        });

        if (isHyaenidaeUrl && CONFIG.openDevTools) {
            tab.webContents.openDevTools({
                mode: "detach",
            });
        }

        const id = tab.webContents.id;

        this.tabs.push(tab);
        this.syncBounds();
        tab.webContents.loadURL(url);

        {
            tab.webContents.on("page-title-updated", async (_, title) => {
                await this.shell.bridge.request("shell:tab-title-changed", {
                    id,
                    title,
                });
            });

            tab.webContents.on("destroyed", async () => {
                await this.shell.bridge.request("shell:tab-destroyed", { id });
            });

            tab.webContents.on("did-start-loading", async () => {
                await this.shell.bridge.request("shell:tab-start-loading", {
                    id,
                });
            });

            tab.webContents.on("did-stop-loading", async () => {
                await this.shell.bridge.request("shell:tab-stop-loading", {
                    id,
                });
            });

            tab.webContents.on("did-navigate", async (_, url) => {
                await this.shell.bridge.request("shell:tab-url-updated", {
                    id,
                    url,
                });
            });

            tab.webContents.setWindowOpenHandler(({ url }) => {
                this.create(url);

                return { action: "deny" };
            });

            tab.bridge.handle("shell:settings-get", async () => {
                return {
                    settings: await this.settingsManager.load(),
                };
            });

            tab.bridge.handle("shell:settings-set", async ({ settings }) => {
                await this.settingsManager.restore(settings);

                this.shell.bridge.send("shell:settings-changed");
            });

            tab.bridge.handle("model:search", async ({ query, limit }) => {
                return {
                    models: await LocalModelsManager.searchModels(query, limit),
                };
            });

            tab.bridge.handle("model:get-files", async ({ model }) => {
                return {
                    files: await LocalModelsManager.getModelFiles(model),
                };
            });

            tab.bridge.on("model:download", (options) => {
                const targetPath = options.files[0]?.path;

                if (!targetPath) {
                    tab.bridge.send("model:download-fail", {
                        name: options.name,
                        path: "",
                        error: "No file selected for download.",
                    });
                    return;
                }

                LocalModelsManager.downloadModel(options, (progress) => {
                    tab.bridge.send("model:download-progress", {
                        name: options.name,
                        path: targetPath,
                        progress,
                    });
                })
                    .then(() => {
                        tab.bridge.send("model:download-progress", {
                            name: options.name,
                            path: targetPath,
                            progress: 1,
                        });
                    })
                    .catch((error) => {
                        tab.bridge.send("model:download-fail", {
                            name: options.name,
                            path: targetPath,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Failed to download model.",
                        });
                    });
            });

            tab.bridge.handle("model:get-local-models", async () => {
                return {
                    models: await LocalModelsManager.getLocalModels(),
                };
            });

            tab.bridge.handle("model:get-local-model-files", async ({ model }) => {
                return {
                    files: await LocalModelsManager.getLocalModelFiles(model),
                };
            });

            tab.bridge.handle("model:remove-local-model", async ({ model }) => {
                await LocalModelsManager.removeLocalModel(model);
            });

            tab.bridge.handle("model:get-runners", async () => {
                return {
                    runners: await this.modelRunnerCounter.getRunners(),
                };
            });

            tab.bridge.handle("model:get-runner-status", async () => {
                return {
                    options: this.modelRunnerCounter.runnerOptions,
                };
            });

            tab.bridge.handle("model:start-runner", async (options) => {
                return await this.modelRunnerCounter.start(options);
            });

            tab.bridge.handle("model:stop-runner", async () => {
                await this.modelRunnerCounter.stop();
            });
        }

        await this.shell.bridge.request("shell:tab-created", { id, url });

        // Focus the new tab after creation to bring it to the front
        await this.focus(id);

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

        // If there are no tabs left after removal, reset currentId and emit an
        // event
        if (this.tabs.length === 0) {
            this.currentId = null;
            this.emit("all-tabs-closed");

            return;
        }

        // If the removed tab was focused, auto-focus an adjacent tab
        if (tab && this.currentId === id) {
            this.baseWindow.contentView.removeChildView(tab);
            this.currentId = null;

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
            // If there is a currently focused tab, remove it from the content
            // view before adding the new one
            if (this.currentId != null) {
                const focustab = this.tabs.find((t) => t.webContents.id === this.currentId);

                if (focustab) {
                    this.baseWindow.contentView.removeChildView(focustab);
                }
            }

            tab.webContents.focus();
            this.baseWindow.contentView.addChildView(tab);
            this.currentId = id;

            await this.shell.bridge.request("shell:tab-focused", { id });
        }
    }

    /**
     * Navigates the tab with the given ID to the specified URL.
     */
    async load(id: number, url: string) {
        await this.tabs.find((t) => t.webContents.id === id)?.webContents.loadURL(url);
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
        return this.currentId == null ? undefined : this.getTab(this.currentId);
    }

    /**
     * Get the navigation history of the tab with the given ID.
     */
    getNavigationHistory(id: number) {
        return this.tabs.find((t) => t.webContents.id === id)?.webContents.navigationHistory;
    }
}
