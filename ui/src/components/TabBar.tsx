import {
    GlobeAltIcon,
    PlusIcon,
    SparklesIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore } from "../state/tabStore";

export default function TabBar() {
    const { t } = useTranslation();
    const tabs = useTabStore((state) => state.tabs);
    const activeTabId = useTabStore((state) => state.activeTabId);
    const createTab = useTabStore((state) => state.createTab);
    const focusTabRpc = useTabStore((state) => state.focusTabRpc);
    const closeTabRpc = useTabStore((state) => state.closeTabRpc);
    const minimizeWindow = useTabStore((state) => state.minimizeWindow);
    const maximizeWindow = useTabStore((state) => state.maximizeWindow);
    const quitWindow = useTabStore((state) => state.quitWindow);
    const isAgentPanelOpen = useTabStore((state) => state.isAgentPanelOpen);
    const toggleAgentPanel = useTabStore((state) => state.toggleAgentPanel);

    return (
        <div className="h-12 border-b border-slate-200 bg-white flex items-end justify-between">
            <div className="tabs-strip h-full min-w-0 flex-1 overflow-x-auto px-2 flex items-end">
                {tabs.map((tab, index) => (
                    <button
                        key={`${tab.id}-${index}`}
                        onClick={() => focusTabRpc(tab.id)}
                        title={tab.title}
                        className={[
                            "h-9 min-w-[140px] max-w-[260px] flex-shrink-0",
                            "px-3 rounded-t-xl border border-b-0 mr-1",
                            "flex items-center gap-2 text-xs transition-colors",
                            activeTabId === tab.id
                                ? "bg-white border-slate-300 text-slate-800"
                                : "bg-transparent border-transparent text-slate-600 hover:bg-transparent",
                        ].join(" ")}
                    >
                        <GlobeAltIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="flex-1 truncate text-left">
                            {tab.title}
                        </span>
                        <span
                            role="button"
                            aria-label={t("tabs.closeTab")}
                            onClick={(e) => {
                                e.stopPropagation();
                                closeTabRpc(tab.id);
                            }}
                            className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
                        >
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </span>
                    </button>
                ))}

                <button
                    onClick={createTab}
                    title={t("tabs.addTab")}
                    aria-label={t("tabs.addTab")}
                    className="h-8 w-8 mb-1 ml-1 flex-shrink-0 rounded-lg border border-transparent text-slate-600 hover:border-slate-300 hover:bg-white transition-colors"
                >
                    <PlusIcon className="w-4 h-4 mx-auto" />
                </button>

                <div
                    className="flex-1 h-full"
                    style={{ WebkitAppRegion: "drag" } as CSSProperties}
                />
            </div>

            <div className="h-full flex items-center flex-shrink-0 gap-3 pl-2">
                <button
                    type="button"
                    onClick={toggleAgentPanel}
                    title={
                        isAgentPanelOpen ? t("chat.collapse") : t("chat.expand")
                    }
                    aria-label={
                        isAgentPanelOpen ? t("chat.collapse") : t("chat.expand")
                    }
                    className={[
                        "h-8 px-2.5 rounded-lg border transition-colors",
                        "flex items-center gap-1.5 text-xs font-medium",
                        isAgentPanelOpen
                            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                >
                    <SparklesIcon className="w-4 h-4" />
                    <span className="leading-none">AI</span>
                </button>

                <div className="h-6 w-px bg-slate-200" />

                <div className="h-full flex items-center flex-shrink-0">
                    <button
                        onClick={minimizeWindow}
                        title={t("window.minimize")}
                        className="w-11 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200/70 transition-colors"
                    >
                        <WinMinimizeIcon />
                    </button>

                    <button
                        onClick={maximizeWindow}
                        title={t("window.maximize")}
                        className="w-11 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200/70 transition-colors"
                    >
                        <WinMaximizeIcon />
                    </button>

                    <button
                        onClick={quitWindow}
                        title={t("window.close")}
                        className="w-11 h-full flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white transition-colors"
                    >
                        <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function WinMinimizeIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="0" y="8" width="10" height="1.2" />
        </svg>
    );
}

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
