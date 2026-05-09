import { create } from "zustand";
import i18n from "../i18n";
import type { Layout } from "@hyaenidae/bridge";

export interface Tab {
    id: number;
    title: string;
    url: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
}

interface ShellStoreState {
    // Source-of-truth for all browser tabs in renderer process.
    tabs: Tab[];
    // ID of the currently focused tab. Null means no active tab available.
    activeTabId: number | null;
    // Guards against duplicate RPC event subscription in React StrictMode.
    rpcInitialized: boolean;
    // Controls whether the right-side agent panel is expanded in layout.
    isAgentPanelOpen: boolean;
    // Tracks whether the application window is currently maximized.
    isWindowMaximized: boolean;
    addTab: (tab: Tab) => void;
    focusTab: (id: number) => void;
    removeTab: (id: number) => void;
    setTabLoading: (id: number, isLoading: boolean) => void;
    setTabUrl: (id: number, url: string) => void;
    setTabTitle: (id: number, title: string) => void;
    setTabNavState: (id: number, canGoBack: boolean, canGoForward: boolean) => void;
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
    layoutChanged: (layout: Layout) => Promise<void>;
    setWindowMaximized: (maximized: boolean) => void;
}

export const useShellStore = create<ShellStoreState>((set, get) => ({
    tabs: [],
    activeTabId: null,
    rpcInitialized: false,
    isAgentPanelOpen: true,
    isWindowMaximized: false,
    initializeRpc: async () => {
        // Initialize once: bind shell events -> store updates.
        if (get().rpcInitialized) {
            return;
        }

        set({ rpcInitialized: true });

        hyaenidae.bridge.handle("shell:tab-created", async ({ id, url }) => {
            get().addTab({
                id,
                title: i18n.t("tabs.newTab"),
                url: url ?? "",
                isLoading: false,
                canGoBack: false,
                canGoForward: false,
            });
        });

        hyaenidae.bridge.handle("shell:tab-focused", async ({ id }) => {
            get().focusTab(id);
        });

        hyaenidae.bridge.handle("shell:tab-destroyed", async ({ id }) => {
            get().removeTab(id);
        });

        hyaenidae.bridge.handle("shell:tab-start-loading", async ({ id }) => {
            get().setTabLoading(id, true);
        });

        hyaenidae.bridge.handle("shell:tab-stop-loading", async ({ id }) => {
            get().setTabLoading(id, false);
        });

        hyaenidae.bridge.handle("shell:tab-url-updated", async ({ id, url }) => {
            get().setTabUrl(id, url);
            // URL update usually means history state may have changed as well.
            await get().refreshTabNavState(id);
        });

        hyaenidae.bridge.handle("shell:tab-title-changed", async ({ id, title }) => {
            get().setTabTitle(id, title ?? i18n.t("tabs.newTab"));
        });

        await hyaenidae.bridge.request("shell:ready");
    },
    addTab: (tab) =>
        set((state) => {
            // RPC may deliver duplicated create events; ignore if the tab already exists.
            if (state.tabs.some((item) => item.id === tab.id)) {
                return state;
            }

            return {
                ...state,
                tabs: [...state.tabs, tab],
                activeTabId: state.activeTabId ?? tab.id,
            };
        }),
    focusTab: (id) => set({ activeTabId: id }),
    removeTab: (id) =>
        set((state) => ({
            ...state,
            tabs: state.tabs.filter((tab) => tab.id !== id),
            activeTabId: state.activeTabId === id ? null : state.activeTabId,
        })),
    setTabLoading: (id, isLoading) =>
        set((state) => ({
            ...state,
            tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, isLoading } : tab)),
        })),
    setTabUrl: (id, url) =>
        set((state) => ({
            ...state,
            tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, url } : tab)),
        })),
    setTabTitle: (id, title) =>
        set((state) => ({
            ...state,
            tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab)),
        })),
    setTabNavState: (id, canGoBack, canGoForward) =>
        set((state) => ({
            ...state,
            tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, canGoBack, canGoForward } : tab,
            ),
        })),
    refreshTabNavState: async (id) => {
        // Back/forward availability is queried from shell to keep toolbar state accurate.
        const [canGoBack, canGoForward] = await Promise.all([
            hyaenidae.bridge.request("shell:tab-can-go-back", { id }),
            hyaenidae.bridge.request("shell:tab-can-go-forward", { id }),
        ]);

        get().setTabNavState(id, canGoBack as boolean, canGoForward as boolean);
    },
    createTab: async (url) => {
        if (url) {
            await hyaenidae.bridge.request("shell:tab-new", { url });
            return;
        }

        await hyaenidae.bridge.request("shell:tab-new");
    },
    focusTabRpc: async (id) => {
        await hyaenidae.bridge.request("shell:tab-focus", { id });
    },
    closeTabRpc: async (id) => {
        await hyaenidae.bridge.request("shell:tab-close", { id });
    },
    goBack: async () => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.bridge.request("shell:tab-go-back", { id: activeTabId });
    },
    goForward: async () => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.bridge.request("shell:tab-go-forward", {
            id: activeTabId,
        });
    },
    refreshOrStop: async () => {
        const { activeTabId, tabs } = get();
        if (activeTabId === null) {
            return;
        }

        // Browser convention: same button acts as Stop while loading, Refresh otherwise.
        const activeTab = tabs.find((tab) => tab.id === activeTabId);
        if (activeTab?.isLoading) {
            await hyaenidae.bridge.request("shell:tab-stop-load", {
                id: activeTabId,
            });
            return;
        }

        await hyaenidae.bridge.request("shell:tab-reload", { id: activeTabId });
    },
    goHome: async () => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.bridge.request("shell:tab-load", {
            id: activeTabId,
            url: "about:home",
        });
    },
    navigateTo: async (url) => {
        const { activeTabId } = get();
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.bridge.request("shell:tab-load", {
            id: activeTabId,
            url,
        });
    },
    minimizeWindow: async () => {
        await hyaenidae.bridge.request("shell:minimize");
    },
    maximizeWindow: async () => {
        await hyaenidae.bridge.request("shell:maximize");
        set({ isWindowMaximized: true });
    },
    restoreWindow: async () => {
        await hyaenidae.bridge.request("shell:restore");
        set({ isWindowMaximized: false });
    },
    quitWindow: async () => {
        await hyaenidae.bridge.request("shell:quit");
    },
    toggleAgentPanel: async () => {
        set((state) => ({
            isAgentPanelOpen: !state.isAgentPanelOpen,
        }));
    },
    setWindowMaximized: (maximized) => {
        set({ isWindowMaximized: maximized });
    },
    layoutChanged: async (layout) => {
        hyaenidae.bridge.send("shell:layout-changed", layout);
    },
}));

export const useTabStore = useShellStore;
