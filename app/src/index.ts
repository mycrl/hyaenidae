import { app } from "electron";

import { AgentSessionController, ModelService, type AgentActivityEvent } from "@hyaenidae/core";
import { ElectronBrowserRuntime } from "./browser-runtime";
import { BrowserViews } from "./views";
import { Args } from "./args";

const modelService = new ModelService({
    apiKey: Args.defaultModelApiKey,
    baseURL: Args.defaultModelBaseURL,
});

const views = new BrowserViews();
const browserRuntime = new ElectronBrowserRuntime(views);
const agentSessions = new AgentSessionController(modelService);

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
    views.shell.rpc.handle("agent:get-sessions", async () => {
        return { sessions: agentSessions.listSessions() };
    });

    views.shell.rpc.handle("agent:create-session", async ({ name }) => {
        const session = agentSessions.createSession(name);
        return { id: session.id };
    });

    views.shell.rpc.handle("agent:ask", async ({ session, model, message, locale }) => {
        const { id, streamPromise } = agentSessions.ask({
            session,
            model,
            message,
            locale,
            browser: browserRuntime,
        });

        void streamPromise
            .then((stream) => {
                stream.on("error", (error: Error) => {
                    views.shell.rpc.send("agent:response-done", {
                        error: error.message,
                        session,
                        id,
                    });
                });

                stream.on("text", (message: string) => {
                    views.shell.rpc.send("agent:response", {
                        id,
                        session,
                        message,
                    });
                });

                stream.on("activity", (activity: AgentActivityEvent) => {
                    views.shell.rpc.send("agent:activity", {
                        id,
                        session,
                        ...activity,
                    });
                });

                stream.on("end", () => {
                    views.shell.rpc.send("agent:response-done", { id, session });
                });
            })
            .catch((error: Error) => {
                views.shell.rpc.send("agent:response-done", {
                    error: error.message,
                    session,
                    id,
                });
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
