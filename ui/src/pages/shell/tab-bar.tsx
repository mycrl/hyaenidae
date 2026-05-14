import "../../styles/pages.shell.tab-bar.css";

import {
    Cog6ToothIcon,
    GlobeAltIcon,
    PlusIcon,
    SparklesIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useShellStore } from "../../services/shell";

export default function TabBar() {
    const { t } = useTranslation();
    const tabs = useShellStore((state) => state.tabs);
    const activeTabId = useShellStore((state) => state.activeTabId);
    const createTab = useShellStore((state) => state.createTab);
    const focusTabRpc = useShellStore((state) => state.focusTabRpc);
    const closeTabRpc = useShellStore((state) => state.closeTabRpc);
    const minimizeWindow = useShellStore((state) => state.minimizeWindow);
    const maximizeWindow = useShellStore((state) => state.maximizeWindow);
    const restoreWindow = useShellStore((state) => state.restoreWindow);
    const quitWindow = useShellStore((state) => state.quitWindow);
    const isAgentPanelOpen = useShellStore((state) => state.isAgentPanelOpen);
    const isWindowMaximized = useShellStore((state) => state.isWindowMaximized);
    const toggleAgentPanel = useShellStore((state) => state.toggleAgentPanel);
    const fallbackTabTitle = t("tabs.newTab");

    const showContextMenu = (event: React.MouseEvent, tabId: number) => {
        event.preventDefault();

        hyaenidae.bridge.send("shell:show-context-menu", {
            x: event.clientX,
            y: event.clientY,
            tabId,
        });
    };

    return (
        <div tag="tab-bar" className="tab-bar-root">
            <div tag="tab-strip" className="tab-bar-strip">
                {tabs.map((tab, index) => (
                    <button
                        key={`${tab.id}-${index}`}
                        onClick={() => focusTabRpc(tab.id)}
                        title={tab.title?.trim() || fallbackTabTitle}
                        className={[
                            "tab-bar-tab",
                            activeTabId === tab.id ? "tab-bar-tab-active" : "tab-bar-tab-inactive",
                        ].join(" ")}
                        onContextMenu={(e) => {
                            showContextMenu(e, tab.id);
                        }}
                    >
                        <GlobeAltIcon className="tab-bar-tab-icon" />
                        <span className="tab-bar-tab-title">
                            {tab.title?.trim() || fallbackTabTitle}
                        </span>
                        <span
                            role="button"
                            aria-label={t("tabs.closeTab")}
                            onClick={(e) => {
                                e.stopPropagation();

                                closeTabRpc(tab.id);
                            }}
                            className="tab-bar-tab-close"
                        >
                            <XMarkIcon className="tab-bar-tab-close-icon" />
                        </span>
                    </button>
                ))}

                <button
                    onClick={() => {
                        void createTab();
                    }}
                    title={t("tabs.addTab")}
                    aria-label={t("tabs.addTab")}
                    className="tab-bar-add-button"
                >
                    <PlusIcon className="tab-bar-add-icon" />
                </button>

                <div
                    tag="tab-drag-spacer"
                    className="flex-1 h-full"
                    style={{ WebkitAppRegion: "drag" } as CSSProperties}
                />
            </div>

            <div tag="tab-controls" className="tab-bar-controls">
                <button
                    type="button"
                    onClick={toggleAgentPanel}
                    title={isAgentPanelOpen ? t("chat.collapse") : t("chat.expand")}
                    aria-label={isAgentPanelOpen ? t("chat.collapse") : t("chat.expand")}
                    className={[
                        "tab-bar-agent-toggle",
                        isAgentPanelOpen
                            ? "tab-bar-agent-toggle-open"
                            : "tab-bar-agent-toggle-closed",
                    ].join(" ")}
                >
                    <SparklesIcon className="tab-bar-agent-toggle-icon" />
                    <span className="tab-bar-agent-toggle-label">AI</span>
                </button>

                <button
                    type="button"
                    onClick={() => createTab(__APP_CONFIG__.settingsUrl)}
                    title={t("settings.open")}
                    aria-label={t("settings.open")}
                    className="tab-bar-settings-button"
                >
                    <Cog6ToothIcon className="tab-bar-settings-icon" />
                </button>

                <div tag="tab-window-divider" className="tab-bar-divider" />

                <div tag="tab-window-controls" className="tab-bar-window-controls">
                    <button
                        onClick={minimizeWindow}
                        title={t("window.minimize")}
                        className="tab-bar-window-button"
                    >
                        <WinMinimizeIcon />
                    </button>

                    <button
                        onClick={isWindowMaximized ? restoreWindow : maximizeWindow}
                        title={isWindowMaximized ? t("window.restore") : t("window.maximize")}
                        className="tab-bar-window-button"
                    >
                        {isWindowMaximized ? <WinRestoreIcon /> : <WinMaximizeIcon />}
                    </button>

                    <button
                        onClick={quitWindow}
                        title={t("window.close")}
                        className="tab-bar-window-button tab-bar-window-button-close"
                    >
                        <XMarkIcon className="tab-bar-window-close-icon" />
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

function WinRestoreIcon() {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
        >
            {/* Restore icon: two overlapping rectangles */}
            <rect x="2" y="3" width="6" height="6" />
            <rect x="1" y="0.6" width="6" height="6" />
        </svg>
    );
}
