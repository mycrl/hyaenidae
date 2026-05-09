import { app } from "electron";

import {
    AgentActivityEvent,
    AgentSessionController,
    ModelProviderController,
} from "@hyaenidae/core";
import { ElectronBrowserRuntime } from "./browser/runtime";
import { Browser } from "./browser";
import { CONFIG, initConfig } from "./config";
import { SettingsManager } from "./settings";

initConfig();

const settingsManager = new SettingsManager();
const modelProviders = new ModelProviderController();
const browser = new Browser(settingsManager, modelProviders);
const agentSessions = new AgentSessionController();
const browserRuntime = new ElectronBrowserRuntime(browser);

browser.on("all-tabs-closed", () => {
    app.quit();
});

browser.shell.bridge.handle("agent:provider-list", async () => {
    return {
        providers: Object.entries(modelProviders.getProviders()).map(([id, provider]) => ({
            id: Number(id),
            apiKey: provider.options.apiKey,
            baseURL: provider.options.baseURL,
        })),
    };
});

browser.shell.bridge.handle("agent:provider-get-models", async ({ id }) => {
    const provider = modelProviders.getProvider(id);
    if (!provider) {
        throw new Error(`Model provider with id ${id} not found`);
    }

    const models = await provider.getModels();
    return { models };
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

browser.shell.bridge.handle("agent:session-list", async () => {
    return { sessions: agentSessions.listSessions() };
});

browser.shell.bridge.handle("agent:session-create", async ({ name }) => {
    const session = agentSessions.createSession(name);
    return { id: session.id };
});

browser.shell.bridge.handle("agent:session-remove", async ({ id }) => {
    agentSessions.removeSession(id);
});

browser.shell.bridge.handle(
    "agent:chat-ask",
    async ({ provider, session, model, message, locale }) => {
        const modelProvider = modelProviders.getProvider(provider);
        if (!modelProvider) {
            throw new Error(`Model provider with id ${provider} not found`);
        }

        const { id, streamPromise } = agentSessions.ask({
            session,
            model,
            message,
            locale,
            browserRuntime,
            modelProvider,
        });

        streamPromise
            .then((stream) => {
                stream.on("error", (error: Error) => {
                    browser.shell.bridge.send("agent:chat-response-done", {
                        error: error.message,
                        session,
                        id,
                    });
                });

                stream.on("text", (message: string) => {
                    browser.shell.bridge.send("agent:chat-response", {
                        id,
                        session,
                        message,
                    });
                });

                stream.on("activity", (activity: AgentActivityEvent) => {
                    browser.shell.bridge.send("agent:chat-activity", {
                        id,
                        session,
                        ...activity,
                    });
                });

                stream.on("end", () => {
                    browser.shell.bridge.send("agent:chat-response-done", { id, session });
                });
            })
            .catch((error: Error) => {
                browser.shell.bridge.send("agent:chat-response-done", {
                    error: error.message,
                    session,
                    id,
                });
            });

        return { id };
    },
);

{
    let isReady = false;

    browser.shell.bridge.handle("shell:ready", async () => {
        // create an initial tab on startup
        if (!isReady) {
            isReady = true;

            console.log("Shell is ready. Creating initial tab with URL:", CONFIG.defaultTabUrl);

            await browser.create(CONFIG.defaultTabUrl);
        }
    });
}
