import { Bridge } from "@hyaenidae/bridge";
import { WebContentsView, WebContentsViewConstructorOptions, WebPreferences } from "electron";
import type { Browser } from ".";
import type { SettingsManager } from "../settings";
import type { ModelRunnerCounter } from "../model-runner";
import { registerContextMenu } from "./context-menu";
import { LocalModelsManager, RemoteModelsManager } from "../model-runner/models";

export enum TabType {
    Shell = "shell",
    Other = "other",
}

/**
 * Extended WebContentsView with a built-in RPC channel.
 */
export class Tab extends WebContentsView {
    private readonly bridge = new Bridge(this.webContents);
    private title?: string;
    private url?: string;

    constructor(
        type: TabType,
        browser: Browser,
        settingsManager: SettingsManager,
        modelRunnerCounter: ModelRunnerCounter,
        options: WebContentsViewConstructorOptions,
    ) {
        const settings = settingsManager.load();
        super({
            ...options,
            webPreferences: {
                ...options.webPreferences,
                defaultFontSize: settings.defaultFontSize,
                defaultFontFamily: settings.defaultFontFamily,
            } as WebPreferences,
        });

        const tab = this;
        const id = tab.webContents.id;

        /**
         * Register a context menu for the tab. The shell tab gets a different
         * menu with additional options, while other tabs get a standard menu
         * with common actions like reload and view source.
         */
        if (type === TabType.Shell) {
            registerContextMenu({
                browser,
                tab,
                isShell: true,
            });
        } else {
            registerContextMenu({
                browser,
                tab,
            });
        }

        /**
         * Wire up web contents events to send messages to the shell for UI updates
         */
        if (type === TabType.Other) {
            const shellBridge = browser.getShellBridge();

            tab.webContents
                .on("page-title-updated", async (_, title) => {
                    this.title = title;

                    await shellBridge.request("shell:tab-title-changed", {
                        id,
                        title,
                    });
                })
                .on("destroyed", async () => {
                    await shellBridge.request("shell:tab-destroyed", { id });
                })
                .on("did-start-loading", async () => {
                    await shellBridge.request("shell:tab-start-loading", {
                        id,
                    });
                })
                .on("did-stop-loading", async () => {
                    await shellBridge.request("shell:tab-stop-loading", {
                        id,
                    });
                })
                .on("did-navigate", async (_, url) => {
                    this.url = url;

                    await shellBridge.request("shell:tab-url-updated", {
                        id,
                        url,
                    });
                })
                .setWindowOpenHandler(({ url }) => {
                    browser.create(url).catch((error) => {
                        console.error("Failed to open new tab for URL:", url, error);
                    });

                    return { action: "deny" };
                });

            tab.bridge
                .handle("shell:settings-get", async () => {
                    return {
                        settings: await settingsManager.load(),
                    };
                })
                .handle("shell:settings-set", async ({ settings }) => {
                    await settingsManager.restore(settings as any);

                    shellBridge.send("shell:settings-changed");
                })
                .handle("model:search", async ({ query, limit }) => {
                    return {
                        models: await RemoteModelsManager.search(query, limit),
                    };
                })
                .handle("model:get-files", async ({ model }) => {
                    return {
                        files: await RemoteModelsManager.getFiles(model),
                    };
                })
                .on("model:download", (options) => {
                    RemoteModelsManager.download(options, ({ path, progress }) => {
                        tab.bridge.send("model:download-progress", {
                            name: options.name,
                            path,
                            progress,
                        });
                    }).catch((error) => {
                        const path =
                            error instanceof Error &&
                            "path" in error &&
                            typeof error.path === "string"
                                ? error.path
                                : "";

                        tab.bridge.send("model:download-fail", {
                            name: options.name,
                            path,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Failed to download model.",
                        });
                    });
                })
                .handle("model:get-local-models", async () => {
                    return {
                        models: await LocalModelsManager.list(),
                    };
                })
                .handle("model:get-local-model-files", async ({ model }) => {
                    return {
                        files: await LocalModelsManager.getFiles(model),
                    };
                })
                .handle("model:remove-local-model", async ({ model }) => {
                    await LocalModelsManager.remove(model);
                })
                .handle("model:get-runners", async () => {
                    return {
                        runners: await modelRunnerCounter.getRunners(),
                    };
                })
                .handle("model:get-runner-status", async () => {
                    return {
                        running: modelRunnerCounter.isRunning,
                    };
                })
                .handle("model:start-runner", async (options) => {
                    return await modelRunnerCounter.start(options);
                })
                .handle("model:stop-runner", async () => {
                    await modelRunnerCounter.stop();
                });
        }
    }

    /**
     * Returns the RPC bridge associated with this tab
     */
    getBridge() {
        return this.bridge;
    }

    /**
     * Returns the current title of the tab, or undefined if not set yet
     */
    getTitle() {
        return this.title;
    }

    /**
     * Returns the current URL of the tab, or undefined if not set yet
     */
    getUrl() {
        return this.url;
    }

    /**
     * Closes the web contents associated with this tab
     */
    destroy() {
        this.webContents.close();
    }
}
