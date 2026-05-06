import { BaseWindow, WebContentsView } from "electron";
import EventEmitter from "node:events";
import { Config } from "./config";
import { RpcMain } from "@hyaenidae/rpc";

const BROWSER_SHELL_HEADER_HEIGHT = 97;
const BROWSER_SHELL_CHAT_WIDTH = 451;

/**
 * Defines the options for creating a BrowserViews instance.
 */
export interface BrowserViewsOptions {
    defaultWidth: number;
    defaultHeight: number;
    shellUri: string;
}

/**
 * Extended WebContentsView with a built-in RPC channel.
 */
export class View extends WebContentsView {
    public readonly rpc = new RpcMain(this.webContents);

    constructor(options: Electron.WebContentsViewConstructorOptions) {
        super(options);
    }
}

/**
 * Manages the shell UI view and all tab content views inside a single BaseWindow.
 */
export class BrowserViews extends EventEmitter {
    private isAgentPanelOpen = true;

    public baseWindow: BaseWindow;
    public currentId: number | null = null;
    public tabs: View[] = [];
    public shell: View;

    constructor(options: BrowserViewsOptions) {
        super();

        this.baseWindow = new BaseWindow({
            width: options.defaultWidth,
            height: options.defaultHeight,
            title: "Hyaenidae",
            frame: false,
            autoHideMenuBar: true,
            titleBarStyle: "hidden",
        });

        this.shell = new View({
            webPreferences: {
                preload: require.resolve("./preload.js"),
                contextIsolation: true,
            },
        });

        // Create the window frame content view
        {
            this.shell.webContents.loadURL(options.shellUri);
            this.baseWindow.contentView.addChildView(this.shell);
            this.syncBounds();

            if (Config.openDevTools) {
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
                y: BROWSER_SHELL_HEADER_HEIGHT,
                width:
                    width -
                    (this.isAgentPanelOpen ? BROWSER_SHELL_CHAT_WIDTH : 0),
                height: height - BROWSER_SHELL_HEADER_HEIGHT,
            });
        });
    }

    /**
     * Toggles the visibility of the agent panel and syncs bounds to reflect the
     * change.
     */
    toggleAgentPanel(isAgentPanelOpen: boolean) {
        this.isAgentPanelOpen = isAgentPanelOpen;

        this.syncBounds();
    }

    /**
     * Creates a new tab, loads the given URL, wires up events, and returns its
     * ID.
     */
    async create(url: string = "about:blank") {
        const tab = new View({
            webPreferences: {
                contextIsolation: true,
            },
        });

        const id = tab.webContents.id;

        this.tabs.push(tab);
        this.syncBounds();
        tab.webContents.loadURL(url);

        {
            tab.webContents.on("page-title-updated", async (_, title) => {
                await this.shell.rpc.ask("shell:tab-title-changed", {
                    id,
                    title,
                });
            });

            tab.webContents.on("destroyed", async () => {
                await this.shell.rpc.ask("shell:tab-destroyed", { id });
            });

            tab.webContents.on("did-start-loading", async () => {
                await this.shell.rpc.ask("shell:tab-start-loading", { id });
            });

            tab.webContents.on("did-stop-loading", async () => {
                await this.shell.rpc.ask("shell:tab-stop-loading", { id });
            });

            tab.webContents.on("did-navigate", async (_, url) => {
                await this.shell.rpc.ask("shell:tab-url-updated", { id, url });
            });

            tab.webContents.setWindowOpenHandler(({ url }) => {
                this.create(url);

                return { action: "deny" };
            });
        }

        await this.shell.rpc.ask("shell:tab-created", { id, url });

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
        tab?.webContents.close();

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
                const focustab = this.tabs.find(
                    (t) => t.webContents.id === this.currentId,
                );

                if (focustab) {
                    this.baseWindow.contentView.removeChildView(focustab);
                }
            }

            tab.webContents.focus();
            this.baseWindow.contentView.addChildView(tab);
            this.currentId = id;

            await this.shell.rpc.ask("shell:tab-focused", { id });
        }
    }

    /**
     * Navigates the tab with the given ID to the specified URL.
     */
    async load(id: number, url: string) {
        await this.tabs
            .find((t) => t.webContents.id === id)
            ?.webContents.loadURL(url);
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
     * Get the navigation history of the tab with the given ID.
     */
    getNavigationHistory(id: number) {
        return this.tabs.find((t) => t.webContents.id === id)?.webContents
            .navigationHistory;
    }
}
