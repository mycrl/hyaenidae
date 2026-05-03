import { useCallback, useEffect, useState } from "react";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowPathIcon,
    HomeIcon,
    PlusIcon,
    XMarkIcon,
    EllipsisVerticalIcon,
    GlobeAltIcon,
    LockClosedIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tab {
    id: number;
    title: string;
    url: string;
    /** Whether the tab is currently loading a page */
    isLoading: boolean;
    /** Whether backward navigation is available */
    canGoBack: boolean;
    /** Whether forward navigation is available */
    canGoForward: boolean;
}

// ── Root Component ────────────────────────────────────────────────────────────

export default function App() {
    // Tab state is event-driven by RPC notifications from main process.
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<number | null>(null);
    const [urlInput, setUrlInput] = useState("");
    const [isEditingUrl, setIsEditingUrl] = useState(false);

    /**
     * Re-queries can-go-back and can-go-forward for the given tab and updates
     * the tab state. Called after each start-loading so the toolbar reflects
     * the current history position immediately.
     */
    const refreshNavState = useCallback(async (id: number) => {
        const [canGoBack, canGoForward] = await Promise.all([
            hyaenidae.rpc.ask("shell:tab-can-go-back", { id }),
            hyaenidae.rpc.ask("shell:tab-can-go-forward", { id }),
        ]);
        setTabs((prev) =>
            prev.map((tab) =>
                tab.id === id ? { ...tab, canGoBack, canGoForward } : tab,
            ),
        );
    }, []);

    useEffect(() => {
        hyaenidae.rpc.on("shell:tab-created", async ({ id, url }) => {
            setTabs((prev) => {
                if (prev.some((tab) => tab.id === id)) {
                    return prev;
                }

                return [
                    ...prev,
                    {
                        id,
                        title: "新标签页",
                        url: url ?? "",
                        isLoading: false,
                        canGoBack: false,
                        canGoForward: false,
                    },
                ];
            });

            setActiveTabId((prev) => prev ?? id);
        });

        hyaenidae.rpc.on("shell:tab-focused", async ({ id }) => {
            setActiveTabId(id);
        });

        hyaenidae.rpc.on("shell:tab-destroyed", async ({ id }) => {
            setTabs((prev) => prev.filter((tab) => tab.id !== id));
            setActiveTabId((prev) => (prev === id ? null : prev));
        });

        hyaenidae.rpc.on("shell:tab-start-loading", async ({ id }) => {
            // Update URL and mark tab as loading
            setTabs((prev) =>
                prev.map((tab) =>
                    tab.id === id ? { ...tab, isLoading: true } : tab,
                ),
            );
        });

        hyaenidae.rpc.on("shell:tab-stop-loading", async ({ id }) => {
            setTabs((prev) =>
                prev.map((tab) =>
                    tab.id === id ? { ...tab, isLoading: false } : tab,
                ),
            );
        });

        hyaenidae.rpc.on("shell:tab-url-updated", async ({ id, url }) => {
            setTabs((prev) =>
                prev.map((tab) => (tab.id === id ? { ...tab, url } : tab)),
            );

            // Re-query navigation capability so back/forward buttons update immediately
            await refreshNavState(id);
        });

        hyaenidae.rpc.on("shell:tab-title-changed", async ({ id, title }) => {
            setTabs((prev) =>
                prev.map((tab) =>
                    tab.id === id
                        ? { ...tab, title: title ?? "新标签页" }
                        : tab,
                ),
            );
        });

        hyaenidae.rpc.on("shell:layout-change", async () => {
            // TODO: rpc currently has no layout snapshot query, keep empty for now.
        });

        // Notify the main process that the UI is ready to receive events and commands.
        hyaenidae.rpc.ask("shell:ready");
    }, [refreshNavState]);

    useEffect(() => {
        if (isEditingUrl) {
            return;
        }

        const activeTab = tabs.find((tab) => tab.id === activeTabId);
        setUrlInput(activeTab?.url ?? "");
    }, [tabs, activeTabId, isEditingUrl]);

    // ── Derived active-tab navigation state ──────────────────────────────────

    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    const activeIsLoading = activeTab?.isLoading ?? false;
    const activeCanGoBack = activeTab?.canGoBack ?? false;
    const activeCanGoForward = activeTab?.canGoForward ?? false;

    // ── Tab actions ───────────────────────────────────────────────────────────

    /** Create a new blank tab and switch to it */
    const addTab = async () => {
        await hyaenidae.rpc.ask("shell:tab-new");
    };

    /** Close a tab by id; activates the nearest remaining tab */
    const closeTab = async (id: number, e: React.MouseEvent) => {
        // Prevent the click from also activating the tab
        e.stopPropagation();

        await hyaenidae.rpc.ask("shell:tab-close", { id });
    };

    /** Switch to a tab and sync the URL bar */
    const selectTab = async (tab: Tab) => {
        await hyaenidae.rpc.ask("shell:tab-focus", { id: tab.id });
    };

    // ── Navigation actions (business logic left empty) ────────────────────────

    const handleBack = async () => {
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.rpc.ask("shell:tab-go-back", {
            id: activeTabId,
        });
    };

    const handleForward = async () => {
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.rpc.ask("shell:tab-go-forward", {
            id: activeTabId,
        });
    };

    const handleRefresh = async () => {
        if (activeTabId === null) {
            return;
        }

        if (activeIsLoading) {
            // While loading, the button acts as a stop button
            await hyaenidae.rpc.ask("shell:tab-stop-load", { id: activeTabId });
        } else {
            await hyaenidae.rpc.ask("shell:tab-reload", { id: activeTabId });
        }
    };

    const handleHome = async () => {
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.rpc.ask("shell:tab-load", {
            id: activeTabId,
            url: "about:home", // Replace with actual home page URL
        });
    };

    const handleNavigate = async (url: string) => {
        if (activeTabId === null) {
            return;
        }

        await hyaenidae.rpc.ask("shell:tab-load", {
            id: activeTabId,
            url,
        });

        setIsEditingUrl(false);
    };

    // ── Window control actions (business logic left empty) ────────────────────

    const handleMinimize = async () => {
        await hyaenidae.rpc.ask("shell:minimize");
    };

    const handleMaximize = async () => {
        await hyaenidae.rpc.ask("shell:maximize");
    };

    const handleClose = async () => {
        await hyaenidae.rpc.ask("shell:quit");
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden select-none">
            {/* ── Tab Strip ──────────────────────────────────────────────────
                Contains: scrollable tab list | new-tab button | window controls
            ──────────────────────────────────────────────────────────────── */}
            <div className="flex items-end bg-[#DEE1E6] h-10 flex-shrink-0 pl-[5px]">
                {/* Scrollable tab list */}
                <div className="tabs-strip flex items-end flex-1 h-full overflow-x-auto min-w-0">
                    {tabs.map((tab, index) => (
                        <button
                            key={`${tab.id}-${index}`}
                            onClick={() => selectTab(tab)}
                            title={tab.title}
                            className={[
                                // Base tab shape (old Chrome-like inverted trapezoid)
                                "relative flex items-center gap-1.5 h-9 px-4",
                                "min-w-[120px] max-w-[240px] flex-shrink-0",
                                "[clip-path:polygon(12px_0,calc(100%-12px)_0,100%_110%,0_110%)]",
                                "border-t border-l border-r border-b-0 text-sm -mr-2 last:mr-0",
                                "transition-colors duration-100",
                                // Active vs inactive appearance
                                activeTabId === tab.id
                                    ? "bg-white border-gray-300 text-gray-800 z-10 shadow-sm"
                                    : "bg-[#E9EDF2] border-gray-300/70 text-gray-600 hover:bg-white/80",
                            ].join(" ")}
                        >
                            {/* Favicon placeholder */}
                            <GlobeAltIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />

                            {/* Tab title */}
                            <span className="flex-1 truncate text-left text-xs">
                                {tab.title}
                            </span>

                            {/* Close tab button */}
                            <span
                                role="button"
                                aria-label="关闭标签页"
                                onClick={(e) => closeTab(tab.id, e)}
                                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-300 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                            >
                                <XMarkIcon className="w-3 h-3" />
                            </span>
                        </button>
                    ))}

                    {/* New Tab (+) button */}
                    <button
                        onClick={addTab}
                        title="新建标签页"
                        aria-label="新建标签页"
                        className="flex items-center justify-center w-8 h-8 mb-0.5 ml-1 flex-shrink-0 rounded-full hover:bg-white/50 text-gray-600 transition-colors"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </button>

                    {/* Draggable spacer — fills remaining tab strip space for Electron window drag */}
                    <div
                        className="flex-1 h-full"
                        style={
                            { WebkitAppRegion: "drag" } as React.CSSProperties
                        }
                    />
                </div>

                {/* Window Controls — Windows style (right side of tab strip) */}
                <div className="flex items-center h-full flex-shrink-0">
                    {/* Minimize */}
                    <button
                        onClick={handleMinimize}
                        title="最小化"
                        className="w-11 h-full flex items-center justify-center hover:bg-black/10 text-gray-700 transition-colors"
                    >
                        <WinMinimizeIcon />
                    </button>

                    {/* Maximize */}
                    <button
                        onClick={handleMaximize}
                        title="最大化"
                        className="w-11 h-full flex items-center justify-center hover:bg-black/10 text-gray-700 transition-colors"
                    >
                        <WinMaximizeIcon />
                    </button>

                    {/* Close — red hover matches OS behavior */}
                    <button
                        onClick={handleClose}
                        title="关闭"
                        className="w-11 h-full flex items-center justify-center hover:bg-red-600 hover:text-white text-gray-700 transition-colors"
                    >
                        <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* ── Navigation Toolbar ─────────────────────────────────────────
                Back | Forward | Refresh | Home | [URL Bar] | More Options
            ──────────────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-white border-b border-gray-200 flex-shrink-0">
                {/* Back — disabled when there is no backward history */}
                <NavIconButton
                    title="后退"
                    onClick={handleBack}
                    disabled={!activeCanGoBack}
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                </NavIconButton>

                {/* Forward — disabled when there is no forward history */}
                <NavIconButton
                    title="前进"
                    onClick={handleForward}
                    disabled={!activeCanGoForward}
                >
                    <ArrowRightIcon className="w-4 h-4" />
                </NavIconButton>

                {/* Refresh / Stop — shows X while loading, arrow when idle */}
                <NavIconButton
                    title={activeIsLoading ? "停止" : "刷新"}
                    onClick={handleRefresh}
                >
                    {activeIsLoading ? (
                        <XMarkIcon className="w-4 h-4" />
                    ) : (
                        <ArrowPathIcon className="w-4 h-4" />
                    )}
                </NavIconButton>

                {/* Home */}
                <NavIconButton title="主页" onClick={handleHome}>
                    <HomeIcon className="w-4 h-4" />
                </NavIconButton>

                {/* URL / Omnibox */}
                <div className="flex-1 flex items-center gap-2 mx-2 px-3 py-1 bg-gray-100 rounded-full border border-transparent focus-within:bg-white focus-within:border-blue-500 transition-colors">
                    {/* Lock / security icon */}
                    <LockClosedIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />

                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onFocus={() => setIsEditingUrl(true)}
                        onBlur={() => setIsEditingUrl(false)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleNavigate(urlInput);
                        }}
                        placeholder="搜索或输入网址"
                        spellCheck={false}
                        className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 min-w-0"
                    />
                </div>

                {/* More Options (⋮) */}
                <NavIconButton
                    title="更多选项"
                    onClick={() => {
                        /* TODO */
                    }}
                >
                    <EllipsisVerticalIcon className="w-4 h-4" />
                </NavIconButton>
            </div>

            {/* ── Content Area ───────────────────────────────────────────────
                Intentionally left empty — the host application fills this area.
            ──────────────────────────────────────────────────────────────── */}
            <div className="flex-1 bg-white" />
        </div>
    );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

/** Round icon button used in the navigation toolbar */
function NavIconButton({
    title,
    onClick,
    disabled = false,
    children,
}: {
    title: string;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            title={title}
            aria-label={title}
            onClick={onClick}
            disabled={disabled}
            className={[
                "w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0",
                disabled
                    ? "text-gray-300 cursor-default"
                    : "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

/** Windows-style minimize icon: a short horizontal rule near the bottom */
function WinMinimizeIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="0" y="8" width="10" height="1.2" />
        </svg>
    );
}

/** Windows-style maximize icon: a thin square outline */
function WinMaximizeIcon() {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
        >
            <rect x="0.6" y="0.6" width="8.8" height="8.8" />
        </svg>
    );
}
