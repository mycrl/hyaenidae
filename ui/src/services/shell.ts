import type { AddToChatOptions, Api, Layout } from "@hyaenidae/bridge";

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
    "shell:tab-focused": number;
    "shell:tab-destroyed": number;
    "shell:tab-start-loading": number;
    "shell:tab-stop-loading": number;
    "shell:tab-url-updated": { id: number; url?: string };
    "shell:tab-title-changed": { id: number; title?: string };
}

interface ShellListenedEventMap {
    "shell:add-to-chat": AddToChatOptions;
    "download:progressing-changed": boolean;
}

const handleShellRpcEvent = <
    TEvent extends keyof ShellHandledEventMap & keyof Api,
    TOutput = ShellHandledEventMap[TEvent],
>(
    event: TEvent,
    handler: ShellEventHandler<TOutput>,
) => {
    hyaenidae.bridge.handle(event, async (payload: Api[TEvent][0]) => {
        await handler(payload as unknown as TOutput);

        return undefined as Api[TEvent][1];
    });
};

const listenShellEvent = <
    TEvent extends keyof ShellListenedEventMap & keyof Api,
    TOutput = ShellListenedEventMap[TEvent],
>(
    event: TEvent,
    handler: ShellEventHandler<TOutput>,
) => {
    hyaenidae.bridge.on(event, async (payload: Api[TEvent][0]) => {
        await handler(payload as unknown as TOutput);
    });
};

export const onTabCreated = (
    handler: (tab: { id: number; url?: string }) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-created", handler);
};

export const onTabFocused = (handler: (id: number) => Promise<void> | void) => {
    handleShellRpcEvent("shell:tab-focused", handler);
};

export const onTabDestroyed = (
    handler: (id: number) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-destroyed", handler);
};

export const onTabStartLoading = (
    handler: (id: number) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-start-loading", handler);
};

export const onTabStopLoading = (
    handler: (id: number) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-stop-loading", handler);
};

export const onTabUrlUpdated = (
    handler: (input: { id: number; url?: string }) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-url-updated", handler);
};

export const onTabTitleChanged = (
    handler: (input: { id: number; title?: string }) => Promise<void> | void,
) => {
    handleShellRpcEvent("shell:tab-title-changed", handler);
};

export const onAddToChat = (
    handler: (input: AddToChatOptions) => Promise<void> | void,
) => {
    listenShellEvent("shell:add-to-chat", handler);
};

export const readyShell = async () => {
    await hyaenidae.bridge.request("shell:ready");
};

export const getTabNavigationState = async (id: number) => {
    const [canGoBack, canGoForward] = await Promise.all([
        hyaenidae.bridge.request("shell:tab-can-go-back", id),
        hyaenidae.bridge.request("shell:tab-can-go-forward", id),
    ]);

    return { canGoBack, canGoForward };
};

export const getTabs = async () => {
    return await hyaenidae.bridge.request("shell:get-tabs");
};

export const createTab = async (url?: string) => {
    await hyaenidae.bridge.request("shell:tab-new", url);
};

export const focusTab = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-focus", id);
};

export const closeTab = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-close", id);
};

export const goBack = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-go-back", id);
};

export const goForward = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-go-forward", id);
};

export const stopTabLoad = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-stop-load", id);
};

export const reloadTab = async (id: number) => {
    await hyaenidae.bridge.request("shell:tab-reload", id);
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

export const showContextMenu = (input: {
    x: number;
    y: number;
    tabId: number;
}) => {
    hyaenidae.bridge.send("shell:show-context-menu", input);
};

export const onDownloadProgressingChanged = (
    handler: (progressing: boolean) => Promise<void> | void,
) => {
    listenShellEvent("download:progressing-changed", handler);
};
