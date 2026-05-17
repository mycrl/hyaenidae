import {
    WebContentsView,
    WebContentsViewConstructorOptions,
    WebPreferences,
} from "electron";
import type { Browser } from ".";
import { Bridge, DownloadEvent } from "@hyaenidae/bridge";
import { registerContextMenu } from "./menu";
import { LocalModelsManager, RemoteModelsManager } from "../runner/models";
import { UriProcessor } from "./loader";

export enum TabType {
    Shell = "shell",
    Application = "application",
    Other = "other",
}

/**
 * Extended WebContentsView with a built-in RPC channel.
 */
export class Tab extends WebContentsView {
    private downloadEventHandler?: (event: DownloadEvent) => void;

    /**
     * The RPC bridge for this tab, used for communication between the web
     * contents and the main process. The shell tab uses this bridge to
     * coordinate events and state updates for all tabs, while application tabs
     * use it to handle settings and model management requests from the renderer.
     */
    public readonly bridge = new Bridge(this.webContents);

    /**
     * The current title of the tab, which may be undefined if the page hasn't
     * set it yet.
     */
    public title?: string;

    /**
     * The current URL of the tab, which may be undefined if the page hasn't
     * navigated yet.
     */
    public url?: string;

    constructor(
        public readonly type: TabType,
        public readonly browser: Browser,
        public readonly options: WebContentsViewConstructorOptions,
    ) {
        const settings = browser.settings.load();
        super({
            ...options,
            webPreferences: {
                ...options.webPreferences,
                defaultFontSize: settings.defaultFontSize,
                defaultFontFamily: settings.defaultFontFamily,
            } as WebPreferences,
        });

        const id = this.webContents.id;

        /**
         * Register a context menu for the tab. The shell tab gets a different
         * menu with additional options, while other tabs get a standard menu
         * with common actions like reload and view source.
         */
        registerContextMenu(this);

        /**
         * Wire up web contents events to send messages to the shell for UI
         * updates. Only the shell tab doesn't need these events.
         */
        if (type != TabType.Shell) {
            this.webContents
                .on("page-title-updated", async (_, title) => {
                    this.title = title;

                    await browser.shell.bridge.request(
                        "shell:tab-title-changed",
                        {
                            id,
                            title,
                        },
                    );
                })
                .on("destroyed", async () => {
                    await browser.shell.bridge.request(
                        "shell:tab-destroyed",
                        id,
                    );
                })
                .on("did-start-loading", async () => {
                    await browser.shell.bridge.request(
                        "shell:tab-start-loading",
                        id,
                    );
                })
                .on("did-stop-loading", async () => {
                    await browser.shell.bridge.request(
                        "shell:tab-stop-loading",
                        id,
                    );
                })
                .on("did-navigate", async (_, url) => {
                    this.url = url;

                    await browser.shell.bridge.request(
                        "shell:tab-url-updated",
                        {
                            id,
                            url,
                        },
                    );
                })
                .setWindowOpenHandler(({ url }) => {
                    browser.create(url).catch((error) => {
                        console.error(
                            "Failed to open new tab for URL:",
                            url,
                            error,
                        );
                    });

                    return { action: "deny" };
                });
        }

        /**
         * Wire up RPC handlers for the tab. Only the shell tab doesn't need
         * these handlers.
         */
        if (type == TabType.Application) {
            /**
             * If the tab's URL is registered as a download URL, listen for
             * download events and forward them to the renderer. This allows
             * application tabs to display download progress for downloads
             * initiated by the page.
             */
            {
                this.downloadEventHandler = (event: DownloadEvent) => {
                    if (
                        this.url &&
                        UriProcessor.isDownloadRegisteredUrl(this.url)
                    ) {
                        this.bridge.send("download:item-updated", event);
                    }
                };

                browser.downloador.on("change", this.downloadEventHandler);
            }

            this.bridge
                .handle("settings:get", async () => browser.settings.load())
                .handle("settings:set", async (settings) => {
                    await browser.settings.restore(settings);

                    /**
                     * Send setting update notifications from the settings page
                     * to the shell.
                     */
                    browser.shell.bridge.send("settings:changed");
                })
                .handle("download:get-items", async () =>
                    browser.downloador.getItems(),
                )
                .handle("download:pause", async (id) => {
                    browser.downloador.pause(id);
                })
                .handle("download:resume", async (id) => {
                    browser.downloador.resume(id);
                })
                .handle("download:cancel", async (id) => {
                    browser.downloador.cancel(id);
                })
                .handle("model:search", async ({ query, limit }) =>
                    RemoteModelsManager.search(query, limit),
                )
                .handle("model:get-files", async (model) =>
                    RemoteModelsManager.getFiles(model),
                )
                .on("model:download", (options) => {
                    RemoteModelsManager.download(
                        options,
                        ({ path, progress }) => {
                            this.bridge.send("model:download-progress", {
                                name: options.name,
                                path,
                                progress,
                            });
                        },
                    ).catch((error) => {
                        const path =
                            error instanceof Error &&
                            "path" in error &&
                            typeof error.path === "string"
                                ? error.path
                                : "";

                        this.bridge.send("model:download-failed", {
                            name: options.name,
                            path,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Failed to download model.",
                        });
                    });
                })
                .handle("model:get-local-models", async () =>
                    LocalModelsManager.list(),
                )
                .handle("model:get-local-model-files", async (model) =>
                    LocalModelsManager.getFiles(model),
                )
                .handle("model:remove-local-model", async (model) => {
                    await LocalModelsManager.remove(model);
                })
                .handle("model:get-runners", async () =>
                    browser.modelRunner.getRunners(),
                )
                .handle(
                    "model:get-runner-status",
                    async () => browser.modelRunner.isRunning,
                )
                .handle(
                    "model:start-runner",
                    async (options) => await browser.modelRunner.start(options),
                )
                .handle("model:stop-runner", async () => {
                    await browser.modelRunner.stop();
                });
        }
    }

    /**
     * Loads the given URL in the tab's web contents. This method is used
     * instead of calling webContents.loadURL directly because it includes
     * additional logic for handling special URL schemes and coordinating with
     * the shell. For example, if the URL is registered as an application URL,
     * it may trigger different behavior than a normal web URL.
     */
    async loadUrl(url: string) {
        await this.webContents.loadURL(UriProcessor.parseInput(url));
    }

    /**
     * Closes the web contents associated with this tab
     */
    destroy() {
        if (this.downloadEventHandler) {
            this.browser.downloador.off("change", this.downloadEventHandler);
        }

        this.webContents.close();
    }
}
