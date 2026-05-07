import { app } from "electron";

import { ModelService } from "@hyaenidae/core";
import { BrowserViews } from "./views";
import { Args } from "./args";

const modelService = new ModelService({
    apiKey: Args.defaultModelApiKey,
    baseURL: Args.defaultModelBaseURL,
});

const views = new BrowserViews();

views.on("all-tabs-closed", () => {
    app.quit();
});

views.shell.rpc.handle("shell:minimize", async () => {
    views.baseWindow.minimize();
});

views.shell.rpc.handle("shell:maximize", async () => {
    views.baseWindow.maximize();
});

views.shell.rpc.handle("shell:restore", async () => {
    views.baseWindow.restore();
});

views.shell.rpc.handle("shell:quit", async () => {
    app.quit();
});

views.shell.rpc.handle("shell:tab-new", async () => {
    return {
        id: await views.create(),
    };
});

views.shell.rpc.handle("shell:tab-close", async ({ id }) => {
    await views.remove(id);
});

views.shell.rpc.handle("shell:tab-load", async ({ id, url }) => {
    await views.load(id, url);
});

views.shell.rpc.handle("shell:tab-reload", async ({ id }) => {
    await views.reload(id);
});

views.shell.rpc.handle("shell:tab-stop-load", async ({ id }) => {
    await views.stop(id);
});

views.shell.rpc.handle("shell:tab-focus", async ({ id }) => {
    await views.focus(id);
});

views.shell.rpc.handle("shell:tab-can-go-back", async ({ id }) => {
    return (await views.getNavigationHistory(id)?.canGoBack()) ?? false;
});

views.shell.rpc.handle("shell:tab-can-go-forward", async ({ id }) => {
    return (await views.getNavigationHistory(id)?.canGoForward()) ?? false;
});

views.shell.rpc.handle("shell:tab-go-back", async ({ id }) => {
    await views.getNavigationHistory(id)?.goBack();
});

views.shell.rpc.handle("shell:tab-go-forward", async ({ id }) => {
    await views.getNavigationHistory(id)?.goForward();
});

views.shell.rpc.on("shell:layout-changed", (layout) => {
    views.updateLayout(layout);
});

{
    let askCounter = 0;
    let sessions: { id: number; name: string }[] = [];

    views.shell.rpc.handle("agent:get-sessions", async () => {
        return { sessions };
    });

    views.shell.rpc.handle("agent:create-session", async ({ name }) => {
        const id = sessions.length;

        sessions.push({
            id,
            name: name || `Session ${sessions.length + 1}`,
        });

        return { id };
    });

    views.shell.rpc.handle("agent:ask", async ({ session, model, message }) => {
        const response = await modelService.ask(model, message);
        const id = askCounter++;

        response.on("error", (error) => {
            views.shell.rpc.send("agent:response-done", {
                error: error.message,
                session,
                id,
            });
        });

        response.on("data", (message) => {
            views.shell.rpc.send("agent:response", {
                id,
                session,
                message: message.toString(),
            });
        });

        response.on("end", () => {
            views.shell.rpc.send("agent:response-done", { id, session });
        });

        return { id };
    });
}

{
    let isReady = false;

    views.shell.rpc.handle("shell:ready", async () => {
        // create an initial tab on startup
        if (!isReady) {
            isReady = true;

            await views.create(Args.defaultTabUrl);
        }
    });
}
