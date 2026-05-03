import { app } from "electron";
import { BrowserViews } from "./views";
import { Config } from "./config";

const views = new BrowserViews({
    defaultWidth: Config.frame.width,
    defaultHeight: Config.frame.height,
    shellUri: Config.frame.uri,
});

views.on("all-tabs-closed", () => {
    app.quit();
});

views.shell.rpc.on("shell:minimize", async () => {
    views.baseWindow.minimize();
});

views.shell.rpc.on("shell:maximize", async () => {
    views.baseWindow.maximize();
});

views.shell.rpc.on("shell:restore", async () => {
    views.baseWindow.restore();
});

views.shell.rpc.on("shell:quit", async () => {
    app.quit();
});

views.shell.rpc.on("shell:tab-new", async () => {
    return {
        id: await views.create(),
    };
});

views.shell.rpc.on("shell:tab-close", async ({ id }) => {
    await views.remove(id);
});

views.shell.rpc.on("shell:tab-load", async ({ id, url }) => {
    await views.load(id, url);
});

views.shell.rpc.on("shell:tab-reload", async ({ id }) => {
    await views.reload(id);
});

views.shell.rpc.on("shell:tab-stop-load", async ({ id }) => {
    await views.stop(id);
});

views.shell.rpc.on("shell:tab-focus", async ({ id }) => {
    await views.focus(id);
});

views.shell.rpc.on("shell:tab-can-go-back", async ({ id }) => {
    return (await views.getNavigationHistory(id)?.canGoBack()) ?? false;
});

views.shell.rpc.on("shell:tab-can-go-forward", async ({ id }) => {
    return (await views.getNavigationHistory(id)?.canGoForward()) ?? false;
});

views.shell.rpc.on("shell:tab-go-back", async ({ id }) => {
    await views.getNavigationHistory(id)?.goBack();
});

views.shell.rpc.on("shell:tab-go-forward", async ({ id }) => {
    await views.getNavigationHistory(id)?.goForward();
});

let browserShellIsReady = false;

views.shell.rpc.on("shell:ready", async () => {
    // create an initial tab on startup
    if (!browserShellIsReady) {
        browserShellIsReady = true;

        await views.create(Config.defaultTabUrl);
    }
});

app.on("window-all-closed", () => {
    app.quit();
});
