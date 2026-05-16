import type { AddToChatOptions, Api, DownloadEvent, Layout } from "@hyaenidae/bridge";

export interface Tab {
    id: number;
    title?: string;
    url?: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
}

type ShellEventHandler<T> = (payload: T) => Promise<void> | void;

interface ShellHandledEventMap {
    "shell:tab-created": { id: number; url?: string };
    "shell:tab-focused": { id: number };
    "shell:tab-destroyed": { id: number };
    "shell:tab-start-loading": { id: number };
    "shell:tab-stop-loading": { id: number };
    "shell:tab-url-updated": { id: number; url?: string };
    "shell:tab-title-changed": { id: number; title?: string };
}

interface ShellListenedEventMap {
    "shell:add-to-chat": AddToChatOptions;
    "shell:download-event": DownloadEvent;
}

const handleShellRpcEvent = <
    TEvent extends keyof ShellHandledEventMap & keyof Api,
    TOutput = ShellHandledEventMap[TEvent],
>(
    event: TEvent,
    handler: ShellEventHandler<TOutput>,
    map?: (payload: ShellHandledEventMap[TEvent]) => TOutput,
) => {
    hyaenidae.bridge.handle(event, async (payload: Api[TEvent][0]) => {
        const normalizedPayload = payload as unknown as ShellHandledEventMap[TEvent];

        await handler(map ? map(normalizedPayload) : (normalizedPayload as unknown as TOutput));

        return undefined as Api[TEvent][1];
    });
};

const listenShellEvent = <
    TEvent extends keyof ShellListenedEventMap & keyof Api,
    TOutput = ShellListenedEventMap[TEvent],
>(
    event: TEvent,
    handler: ShellEventHandler<TOutput>,
    map?: (payload: ShellListenedEventMap[TEvent]) => TOutput,
) => {
    hyaenidae.bridge.on(event, async (payload: Api[TEvent][0]) => {
        const normalizedPayload = payload as unknown as ShellListenedEventMap[TEvent];

        await handler(map ? map(normalizedPayload) : (normalizedPayload as unknown as TOutput));
    });
};

export const onTabCreated = (
    handler: (tab: { id: number; url?: string }) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-created", handler);
};

export const onTabFocused = (handler: (input: { id: number }) => Promise<void> | void) => {
    handleShellRpcEvent("shell:tab-focused", handler);
};

export const onTabDestroyed = (handler: (input: { id: number }) => Promise<void> | void) => {
    handleShellRpcEvent("shell:tab-destroyed", handler);
};

export const onTabStartLoading = (handler: (input: { id: number }) => Promise<void> | void) => {
    handleShellRpcEvent("shell:tab-start-loading", handler);
};

export const onTabStopLoading = (handler: (input: { id: number }) => Promise<void> | void) => {
    handleShellRpcEvent("shell:tab-stop-loading", handler);
};

export const onTabUrlUpdated = (
    handler: (input: { id: number; url?: string }) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-url-updated", handler, ({ id, url }) => ({ id, url }));
};

export const onTabTitleChanged = (
    handler: (input: { id: number; title?: string }) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-title-changed", handler, ({ id, title }) => ({ id, title }));
};

export const onAddToChat = (handler: (input: AddToChatOptions) => Promise<void> | void) => {
    listenShellEvent("shell:add-to-chat", handler);
};

export const readyShell = async () => {
    await hyaenidae.bridge.request("shell:ready");
};

export const getTabNavigationState = async (id: number) => {
    const [canGoBack, canGoForward] = await Promise.all([
        hyaenidae.bridge.request("shell:tab-can-go-back", { id }),
        hyaenidae.bridge.request("shell:tab-can-go-forward", { id }),
    ]);

    return {
        canGoBack: canGoBack as boolean,
        canGoForward: canGoForward as boolean,
    };
};

export const getTabs = async () => {
    return (await hyaenidae.bridge.request("shell:get-tabs")).tabs;
};

export const createTab = async (url?: string) => {
    if (url) {
        await hyaenidae.bridge.request("shell:tab-new", { url });
        return;
    }

    await hyaenidae.bridge.request("shell:tab-new");
};

export const focusTab = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-focus", { id });
};

export const closeTab = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-close", { id });
};

export const goBack = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-go-back", { id });
};

export const goForward = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-go-forward", { id });
};

export const stopTabLoad = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-stop-load", { id });
};

export const reloadTab = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-reload", { id });
};

export const loadTab = async (id: number, url: string) => {
    await hyaenidae.bridge.request("shell:tab-load", { id, url });
};

export const minimizeWindow = async () => {
    await hyaenidae.bridge.request("shell:minimize");
};

export const maximizeWindow = async () => {
    await hyaenidae.bridge.request("shell:maximize");
};

export const restoreWindow = async () => {
    await hyaenidae.bridge.request("shell:restore");
};

export const quitWindow = async () => {
    await hyaenidae.bridge.request("shell:quit");
};

export const sendLayoutChanged = (layout: Layout) => {
    hyaenidae.bridge.send("shell:layout-changed", layout);
};

export const showContextMenu = (input: { x: number; y: number; tabId: number }) => {
    hyaenidae.bridge.send("shell:show-context-menu", input);
};

export const onDownloadEvent = (handler: (event: DownloadEvent) => Promise<void> | void) => {
    listenShellEvent("shell:download-event", handler);
};
