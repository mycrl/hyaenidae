import { create } from "zustand";
import type { DownloadEvent, Layout } from "@hyaenidae/bridge";
import type { Tab } from "./shell";
import { useSettingsStore } from "./settings.state";
import {
    closeTab,
    createTab,
    focusTab,
    getTabNavigationState,
    getTabs,
    goBack,
    goForward,
    loadTab,
    maximizeWindow,
    minimizeWindow,
    onDownloadEvent,
    onTabCreated,
    onTabDestroyed,
    onTabFocused,
    onTabStartLoading,
    onTabStopLoading,
    onTabTitleChanged,
    onTabUrlUpdated,
    quitWindow,
    readyShell,
    reloadTab,
    restoreWindow,
    sendLayoutChanged,
    showContextMenu,
    stopTabLoad,
} from "./shell";

const updateTabList = (tabs: Tab[], id: number, updater: (tab: Tab) => Tab) =>
    tabs.map((tab) => (tab.id === id ? updater(tab) : tab));

interface ShellState {
    tabs: Tab[];
    downloads: DownloadEvent[];
    activeTabId: number | null;
    rpcInitialized: boolean;
    isAgentPanelOpen: boolean;
    isWindowMaximized: boolean;
    addTab: (tab: Tab) => void;
    focusTabState: (id: number) => void;
    removeTab: (id: number) => void;
    setTabLoading: (id: number, isLoading: boolean) => void;
    setTabUrl: (id: number, url?: string) => void;
    setTabTitle: (id: number, title?: string) => void;
    setTabNavState: (
        id: number,
        canGoBack: boolean,
        canGoForward: boolean,
    ) => void;
    refreshTabNavState: (id: number) => Promise<void>;
    initializeRpc: () => Promise<void>;
    createTab: (url?: string) => Promise<void>;
    focusTabRpc: (id: number) => Promise<void>;
    closeTabRpc: (id: number) => Promise<void>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;
    refreshOrStop: () => Promise<void>;
    goHome: () => Promise<void>;
    navigateTo: (url: string) => Promise<void>;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    restoreWindow: () => Promise<void>;
    quitWindow: () => Promise<void>;
    toggleAgentPanel: () => Promise<void>;
    openAgentPanel: () => void;
    layoutChanged: (layout: Layout) => Promise<void>;
    showTabContextMenu: (input: {
        x: number;
        y: number;
        tabId: number;
    }) => void;
}

export const useShellStore = create<ShellState>((set, get) => ({
    tabs: [],
    downloads: [],
    activeTabId: null,
    rpcInitialized: false,
    isAgentPanelOpen: true,
    isWindowMaximized: false,
    initializeRpc: async () => {
        if (get().rpcInitialized) {
            return;
        }

        set({ rpcInitialized: true });

        onTabCreated(({ id, url }) => {
            get().addTab({
                id,
                url,
                title: undefined,
                isLoading: false,
                canGoBack: false,
                canGoForward: false,
            });
        });

        onTabFocused(({ id }) => {
            get().focusTabState(id);
        });

        onTabDestroyed(({ id }) => {
            get().removeTab(id);
        });

        onTabStartLoading(({ id }) => {
            get().setTabLoading(id, true);
        });

        onTabStopLoading(({ id }) => {
            get().setTabLoading(id, false);
        });

        onTabUrlUpdated(async ({ id, url }) => {
            get().setTabUrl(id, url);
            await get().refreshTabNavState(id);
        });

        onTabTitleChanged(({ id, title }) => {
            get().setTabTitle(id, title);
        });

        onDownloadEvent((event) => {
            let downloads = get().downloads;

            const index = downloads.findIndex((item) => item.url === event.url);
            if (index === -1) {
                downloads.push(event);
            } else {
                downloads[index] = event;
            }

            set({ downloads });
        });

        getTabs().then((tabs) => {
            set({
                tabs: tabs.map((tab) => {
                    if (tab.focused) {
                        get().focusTabState(tab.id);
                    }

                    return {
                        id: tab.id,
                        url: tab.url,
                        title: undefined,
                        isLoading: false,
                        canGoBack: false,
                        canGoForward: false,
                    };
                }),
            });
        });

        await readyShell();
    },
    addTab: (tab) =>
        set((state) => {
            if (state.tabs.some((item) => item.id === tab.id)) {
                return state;
            }

            return {
                tabs: [...state.tabs, tab],
                activeTabId: state.activeTabId ?? tab.id,
            };
        }),
    focusTabState: (id) => set({ activeTabId: id }),
    removeTab: (id) =>
        set((state) => ({
            tabs: state.tabs.filter((tab) => tab.id !== id),
            activeTabId: state.activeTabId === id ? null : state.activeTabId,
        })),
    setTabLoading: (id, isLoading) =>
        set((state) => ({
            tabs: updateTabList(state.tabs, id, (tab) => ({
                ...tab,
                isLoading,
            })),
        })),
    setTabUrl: (id, url) =>
        set((state) => ({
            tabs: updateTabList(state.tabs, id, (tab) => ({ ...tab, url })),
        })),
    setTabTitle: (id, title) =>
        set((state) => ({
            tabs: updateTabList(state.tabs, id, (tab) => ({ ...tab, title })),
        })),
    setTabNavState: (id, canGoBack, canGoForward) =>
        set((state) => ({
            tabs: updateTabList(state.tabs, id, (tab) => ({
                ...tab,
                canGoBack,
                canGoForward,
            })),
        })),
    refreshTabNavState: async (id) => {
        const navigationState = await getTabNavigationState(id);

        get().setTabNavState(
            id,
            navigationState.canGoBack,
            navigationState.canGoForward,
        );
    },
    createTab: async (url) => {
        await createTab(url);
    },
    focusTabRpc: async (id) => {
        await focusTab(id);
    },
    closeTabRpc: async (id) => {
        await closeTab(id);
    },
    goBack: async () => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await goBack(activeTabId);
    },
    goForward: async () => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await goForward(activeTabId);
    },
    refreshOrStop: async () => {
        const { activeTabId, tabs } = get();
        if (activeTabId === null) {
            return;
        }

        const activeTab = tabs.find((tab) => tab.id === activeTabId);
        if (activeTab?.isLoading) {
            await stopTabLoad(activeTabId);
            return;
        }

        await reloadTab(activeTabId);
    },
    goHome: async () => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await loadTab(
            activeTabId,
            useSettingsStore.getState().settings.homeUrl ??
                __APP_CONFIG__.defaultTabUrl,
        );
    },
    navigateTo: async (url) => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await loadTab(activeTabId, url);
    },
    minimizeWindow: async () => {
        await minimizeWindow();
    },
    maximizeWindow: async () => {
        await maximizeWindow();

        set({ isWindowMaximized: true });
    },
    restoreWindow: async () => {
        await restoreWindow();

        set({ isWindowMaximized: false });
    },
    quitWindow: async () => {
        await quitWindow();
    },
    toggleAgentPanel: async () => {
        set((state) => ({ isAgentPanelOpen: !state.isAgentPanelOpen }));
    },
    openAgentPanel: () => {
        set({ isAgentPanelOpen: true });
    },
    layoutChanged: async (layout) => {
        sendLayoutChanged(layout);
    },
    showTabContextMenu: (input) => {
        showContextMenu(input);
    },
}));
