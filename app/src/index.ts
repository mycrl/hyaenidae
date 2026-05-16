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
import { ModelRunnerCounter } from "./model-runner";
import { BaseTabInfo } from "@hyaenidae/bridge";

registerLogger();
initConfig();

const coreService = new Hyaenidae();
const settingsManager = new SettingsManager();
const modelRunnerCounter = new ModelRunnerCounter();
const browser = new Browser(settingsManager, modelRunnerCounter);
const browserRuntime = new ElectronBrowserRuntime(browser);
const shellBridge = browser.getShellBridge();

let isReady = false;

shellBridge
    .handle("shell:ready", async () => {
        if (!isReady) {
            isReady = true;

            await browser.create(
                settingsManager.load().homeUrl ?? CONFIG.defaultTabUrl,
            );
        }
    })
    .handle("shell:settings-get", async () => ({
        settings: await settingsManager.load(),
    }))
    .handle("shell:settings-set", async ({ settings }) => {
        await settingsManager.restore(settings as any);

        shellBridge.send("shell:settings-changed");
    })
    .handle("shell:minimize", async () => {
        browser.getBaseWindow().minimize();
    })
    .handle("shell:maximize", async () => {
        browser.getBaseWindow().maximize();
    })
    .handle("shell:restore", async () => {
        browser.getBaseWindow().restore();
    })
    .handle("shell:quit", async () => {
        app.quit();
    })
    .handle("shell:get-tabs", async () => ({
        tabs: browser.getTabs().map(
            (item) =>
                ({
                    id: item.webContents.id,
                    title: item.getTitle(),
                    url: item.getUrl(),
                    focused: item.webContents.id === browser.getFocusedId(),
                }) as BaseTabInfo,
        ),
    }))
    .handle("shell:tab-new", async ({ url } = {}) => ({
        id: await browser.create(url),
    }))
    .handle("shell:tab-close", async ({ id }) => {
        await browser.remove(id);
    })
    .handle("shell:tab-load", async ({ id, url }) => {
        await browser.load(id, url);
    })
    .handle("shell:tab-reload", async ({ id }) => {
        await browser.reload(id);
    })
    .handle("shell:tab-stop-load", async ({ id }) => {
        await browser.stop(id);
    })
    .handle("shell:tab-focus", async ({ id }) => {
        await browser.focus(id);
    })
    .handle(
        "shell:tab-can-go-back",
        async ({ id }) =>
            (await browser.getNavigationHistory(id)?.canGoBack()) ?? false,
    )
    .handle(
        "shell:tab-can-go-forward",
        async ({ id }) =>
            (await browser.getNavigationHistory(id)?.canGoForward()) ?? false,
    )
    .handle("shell:tab-go-back", async ({ id }) => {
        await browser.getNavigationHistory(id)?.goBack();
    })
    .handle("shell:tab-go-forward", async ({ id }) => {
        await browser.getNavigationHistory(id)?.goForward();
    })
    .on("shell:layout-changed", (layout) => {
        browser.updateLayout(layout);
    })
    .handle("agent:provider-get-models", async (modelProvider) => ({
        models: await getModelsWithModelProvider(modelProvider),
    }))
    .handle("agent:session-list", async () => ({
        sessions: coreService.sessionManager.list(),
    }))
    .handle("agent:session-create", async ({ name }) =>
        coreService.sessionManager.create(name),
    )
    .handle("agent:session-remove", async ({ id }) => {
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
                        shellBridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "done",
                            error: error.message,
                        });
                    })
                    .on("text", (message: string) => {
                        shellBridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "text",
                            message,
                        });
                    })
                    .on("activity", (activity: AgentActivityEvent) => {
                        shellBridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "activity",
                            ...activity,
                        });
                    })
                    .on("end", () => {
                        shellBridge.send("agent:chat-response", {
                            ...baseResponse,
                            type: "done",
                        });
                    });
            })
            .catch((error: any) => {
                shellBridge.send("agent:chat-response", {
                    ...baseResponse,
                    type: "done",
                    error: error.message,
                });
            });

        return { askId };
    })
    .handle("agent:chat-stop", async ({ askId }) => {
        await coreService.cancelAsk(askId);
    });

browser.on("all-tabs-closed", () => {
    app.quit();
});
