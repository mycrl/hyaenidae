import { app } from "electron";
import { AgentActivityEvent, Hyaenidae, getModelsWithModelProvider } from "@hyaenidae/core";
import { ElectronBrowserRuntime } from "./browser/runtime";
import { Browser } from "./browser";
import { CONFIG, initConfig } from "./config";
import { SettingsManager } from "./settings";
import { registerLogger } from "./logger";
import { ModelRunnerCounter } from "./model-runner";

registerLogger();
initConfig();

const coreService = new Hyaenidae();
const settingsManager = new SettingsManager();
const modelRunnerCounter = new ModelRunnerCounter();
const browser = new Browser(settingsManager, modelRunnerCounter);
const browserRuntime = new ElectronBrowserRuntime(browser);

browser.on("all-tabs-closed", () => {
    app.quit();
});

browser.shell.bridge.handle("shell:settings-get", async () => {
    return {
        settings: await settingsManager.load(),
    };
});

browser.shell.bridge.handle("shell:minimize", async () => {
    browser.baseWindow.minimize();
});

browser.shell.bridge.handle("shell:maximize", async () => {
    browser.baseWindow.maximize();
});

browser.shell.bridge.handle("shell:restore", async () => {
    browser.baseWindow.restore();
});

browser.shell.bridge.handle("shell:quit", async () => {
    app.quit();
});

browser.shell.bridge.handle("shell:tab-new", async ({ url } = {}) => {
    const id = await browser.create(url);
    return { id };
});

browser.shell.bridge.handle("shell:tab-close", async ({ id }) => {
    await browser.remove(id);
});

browser.shell.bridge.handle("shell:tab-load", async ({ id, url }) => {
    await browser.load(id, url);
});

browser.shell.bridge.handle("shell:tab-reload", async ({ id }) => {
    await browser.reload(id);
});

browser.shell.bridge.handle("shell:tab-stop-load", async ({ id }) => {
    await browser.stop(id);
});

browser.shell.bridge.handle("shell:tab-focus", async ({ id }) => {
    await browser.focus(id);
});

browser.shell.bridge.handle("shell:tab-can-go-back", async ({ id }) => {
    return (await browser.getNavigationHistory(id)?.canGoBack()) ?? false;
});

browser.shell.bridge.handle("shell:tab-can-go-forward", async ({ id }) => {
    return (await browser.getNavigationHistory(id)?.canGoForward()) ?? false;
});

browser.shell.bridge.handle("shell:tab-go-back", async ({ id }) => {
    await browser.getNavigationHistory(id)?.goBack();
});

browser.shell.bridge.handle("shell:tab-go-forward", async ({ id }) => {
    await browser.getNavigationHistory(id)?.goForward();
});

browser.shell.bridge.on("shell:layout-changed", (layout) => {
    browser.updateLayout(layout);
});

browser.shell.bridge.handle("agent:provider-get-models", async (modelProvider) => {
    return { models: await getModelsWithModelProvider(modelProvider) };
});

browser.shell.bridge.handle("agent:session-list", async () => {
    return { sessions: coreService.sessionManager.list() };
});

browser.shell.bridge.handle("agent:session-create", async ({ name }) => {
    return coreService.sessionManager.create(name);
});

browser.shell.bridge.handle("agent:session-remove", async ({ id }) => {
    coreService.sessionManager.remove(id);
});

browser.shell.bridge.handle("agent:chat-ask", async (options) => {
    const sessionId = options.session;
    const { id, askTask } = coreService.ask({
        ...options,
        browserRuntime,
    });

    askTask()
        .then((stream) => {
            stream.on("error", (error: Error) => {
                browser.shell.bridge.send("agent:chat-response-done", {
                    error: error.message,
                    sessionId,
                    id,
                });
            });

            stream.on("text", (message: string) => {
                browser.shell.bridge.send("agent:chat-response", {
                    message,
                    sessionId,
                    id,
                });
            });

            stream.on("activity", (activity: AgentActivityEvent) => {
                browser.shell.bridge.send("agent:chat-activity", {
                    id,
                    sessionId,
                    ...activity,
                });
            });

            stream.on("end", () => {
                browser.shell.bridge.send("agent:chat-response-done", {
                    sessionId,
                    id,
                });
            });

            stream.start();
        })
        .catch((error: Error) => {
            browser.shell.bridge.send("agent:chat-response-done", {
                error: error.message,
                sessionId,
                id,
            });
        });

    return { id };
});

{
    let isReady = false;

    browser.shell.bridge.handle("shell:ready", async () => {
        if (!isReady) {
            isReady = true;

            console.info("Shell is ready. Creating initial tab with URL:", CONFIG.defaultTabUrl);

            await browser.create(CONFIG.defaultTabUrl);
        }
    });
}
