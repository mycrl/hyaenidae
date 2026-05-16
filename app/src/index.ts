import { app } from "electron";
import {
    AgentActivityEvent,
    Hyaenidae,
    getModelsWithModelProvider,
} from "@hyaenidae/core";
import { ElectronBrowserRuntime } from "./runtime";
import { Browser } from "./browser";
import { CONFIG, initConfig } from "./config";
import { SettingsManager } from "./settings";
import { registerLogger } from "./logger";
import { ModelRunnerController } from "./runner";
import { BaseTabInfo } from "@hyaenidae/bridge";

registerLogger();
initConfig();

const coreService = new Hyaenidae();
const settingsManager = new SettingsManager();
const modelRunnerController = new ModelRunnerController();
const browser = new Browser(settingsManager, modelRunnerController);
const browserRuntime = new ElectronBrowserRuntime(browser);

let isReady = false;

browser.shell.bridge
    .handle("shell:ready", async () => {
        if (!isReady) {
            console.info("Shell is ready");

            isReady = true;

            await browser.create(CONFIG.defaultTabUrl);
        }
    })
    .handle("settings:get", async () => settingsManager.load())
    .handle("settings:set", async (settings) => {
        await settingsManager.restore(settings as any);

        browser.notifySettingsChanged();
    })
    .handle("shell:minimize", async () => {
        browser.baseWindow.minimize();
    })
    .handle("shell:maximize", async () => {
        browser.baseWindow.maximize();
    })
    .handle("shell:restore", async () => {
        browser.baseWindow.restore();
    })
    .handle("shell:quit", async () => {
        app.quit();
    })
    .handle("shell:get-tabs", async () =>
        browser.tabs.map(
            (item) =>
                ({
                    id: item.webContents.id,
                    title: item.title,
                    url: item.url,
                    focused: item.webContents.id === browser.focusedId,
                }) as BaseTabInfo,
        ),
    )
    .handle("shell:tab-new", async (url) => browser.create(url))
    .handle("shell:tab-close", async (id) => {
        await browser.remove(id);
    })
    .handle("shell:tab-load", async ({ id, url }) => {
        await browser.load(id, url);
    })
    .handle("shell:tab-reload", async (id) => {
        await browser.reload(id);
    })
    .handle("shell:tab-stop-load", async (id) => {
        await browser.stop(id);
    })
    .handle("shell:tab-focus", async (id) => {
        await browser.focus(id);
    })
    .handle(
        "shell:tab-can-go-back",
        async (id) =>
            (await browser.getNavigationHistory(id)?.canGoBack()) ?? false,
    )
    .handle(
        "shell:tab-can-go-forward",
        async (id) =>
            (await browser.getNavigationHistory(id)?.canGoForward()) ?? false,
    )
    .handle("shell:tab-go-back", async (id) => {
        await browser.getNavigationHistory(id)?.goBack();
    })
    .handle("shell:tab-go-forward", async (id) => {
        await browser.getNavigationHistory(id)?.goForward();
    })
    .on("shell:layout-changed", (layout) => {
        browser.updateLayout(layout);
    })
    .handle("agent:provider-get-models", async (modelProvider) =>
        getModelsWithModelProvider(modelProvider),
    )
    .handle("agent:session-list", async () => coreService.sessionManager.list())
    .handle("agent:session-create", async (name) =>
        coreService.sessionManager.create(name),
    )
    .handle("agent:session-remove", async (id) => {
        coreService.sessionManager.remove(id);
    })
    .handle("agent:chat-ask", async (options) => {
        const { askId, askTask } = coreService.ask({
            ...options,
            browserRuntime,
        });

        const baseResponse = {
            sessionId: options.session,
            askId,
        };

        askTask()
            .then((response) => {
                response
                    .on("error", (error: Error) => {
                        browser.shell.bridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "done",
                            error: error.message,
                        });
                    })
                    .on("text", (message: string) => {
                        browser.shell.bridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "text",
                            message,
                        });
                    })
                    .on("activity", (activity: AgentActivityEvent) => {
                        browser.shell.bridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "activity",
                            ...activity,
                        });
                    })
                    .on("end", () => {
                        browser.shell.bridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "done",
                        });
                    });
            })
            .catch((error: any) => {
                browser.shell.bridge.send("agent:chat-response", {
                    ...baseResponse,
                    type: "done",
                    error: error.message,
                });
            });

        return askId;
    })
    .handle("agent:chat-stop", async (askId) => {
        await coreService.cancelAsk(askId);
    });

browser.on("all-tabs-closed", () => {
    app.quit();
});
