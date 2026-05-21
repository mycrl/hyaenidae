import { app } from "electron";
import { Mavis, ModelProvider } from "@hyaenidae/mavis";
import {
    SettingsController,
    initProgramSettings,
    ProgramSettings,
} from "./settings";
import { ElectronBrowserRuntime } from "./runtime";
import { Browser, registerApplicationProtocolHooks } from "./browser";
import { registerLogger } from "./logger";
import { BaseTabInfo } from "@hyaenidae/bridge";
import { DownloadController } from "./browser/download";

registerLogger();
initProgramSettings();
registerApplicationProtocolHooks();

const mavis = new Mavis();
const settings = new SettingsController();
const downloador = new DownloadController();
const browser = new Browser(settings, downloador);
const browserRuntime = new ElectronBrowserRuntime(browser);

let isReady = false;

browser.shell.bridge
    .handle("shell:ready", async () => {
        if (!isReady) {
            console.info("Shell is ready");

            isReady = true;

            await browser.create(ProgramSettings.defaultTabUrl);
        }
    })
    .handle("settings:get", async () => settings.load())
    .handle("settings:set", async (item) => {
        await settings.restore(item);
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
    .handle(
        "agent:provider-get-models",
        async (modelProvider) =>
            await new ModelProvider(modelProvider).listModels(),
    )
    .handle("agent:session-list", async () => mavis.sessionManager.list())
    .handle(
        "agent:session-get",
        async (id) => await mavis.sessionManager.get(id, false),
    )
    .handle("agent:session-create", async (name) =>
        mavis.sessionManager.create(name),
    )
    .handle("agent:session-remove", async (id) => {
        mavis.sessionManager.remove(id);
    })
    .handle("agent:chat-ask", async (options) => {
        const sessionId = options.session;
        const { askId, task } = mavis.ask(
            options.message,
            {
                session: options.session,
                language: options.language,
                modelProvider: new ModelProvider(options.modelProvider),
                browserRuntime,
            },
            (event) => {
                if (event.type === "text") {
                    browser.shell.bridge.send("agent:chat-response", {
                        kind: "text",
                        sessionId,
                        askId,
                        message: event.message,
                    });
                    return;
                }

                browser.shell.bridge.send("agent:chat-response", {
                    kind: "activity",
                    sessionId,
                    askId,
                    ...event.activity,
                });
            },
        );

        task()
            .then(() => null)
            .catch((error: Error) => error)
            .then((error) => {
                browser.shell.bridge.send("agent:chat-response", {
                    kind: "done",
                    sessionId,
                    askId,
                    ...(error != null ? { error: error.message } : {}),
                });
            });

        return askId;
    })
    .handle("agent:chat-stop", async (askId) => {
        await mavis.cancelAsk(askId);
    });

browser.on("all-tabs-closed", () => {
    app.quit();
});
