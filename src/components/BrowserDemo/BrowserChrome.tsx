import type { ReactNode } from "react";
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    ArrowRightIcon,
    CloseIcon,
    CogIcon,
    GlobeIcon,
    HomeIcon,
    LockIcon,
    PlusIcon,
    SparklesIcon,
    WinMaximizeIcon,
    WinMinimizeIcon,
} from "./icons.tsx";
import "../../styles/BrowserChrome.css";

type BrowserChromeProps = {
    tabTitle: string;
    showTab: boolean;
    urlText: string;
    urlReady: boolean;
    agentPanelOpen: boolean;
    showUrlCursor: boolean;
};

export default function BrowserChrome({
    tabTitle,
    showTab,
    urlText,
    urlReady,
    agentPanelOpen,
    showUrlCursor,
}: BrowserChromeProps) {
    return (
        <div className="browser-chrome">
            {/* Tab strip — matches desktop shell tab-bar */}
            <div className="tab-bar">
                <div className="tab-strip">
                    {showTab ? (
                        <button
                            type="button"
                            className="tab tab-active tab-enter"
                            aria-label="Active tab"
                        >
                            <GlobeIcon className="tab-icon" />
                            <span className="tab-title">{tabTitle}</span>
                            <span className="tab-close" aria-hidden>
                                <CloseIcon className="tab-close-icon" />
                            </span>
                        </button>
                    ) : null}

                    <button
                        type="button"
                        className="tab-add"
                        aria-label="New tab"
                    >
                        <PlusIcon className="tab-add-icon" />
                    </button>

                    <div className="tab-drag-spacer" />
                </div>

                <div className="tab-controls">
                    <button
                        type="button"
                        className={[
                            "agent-toggle",
                            agentPanelOpen
                                ? "agent-toggle-open"
                                : "agent-toggle-closed",
                        ].join(" ")}
                        aria-label="Toggle AI panel"
                    >
                        <SparklesIcon className="agent-toggle-icon" />
                        <span>AI</span>
                    </button>

                    <button
                        type="button"
                        className="chrome-icon-btn"
                        aria-label="Settings"
                    >
                        <CogIcon className="chrome-icon" />
                    </button>

                    <div className="chrome-divider" />

                    <div className="window-controls">
                        <button
                            type="button"
                            className="win-btn"
                            aria-label="Minimize"
                        >
                            <WinMinimizeIcon />
                        </button>
                        <button
                            type="button"
                            className="win-btn"
                            aria-label="Maximize"
                        >
                            <WinMaximizeIcon />
                        </button>
                        <button
                            type="button"
                            className="win-btn win-btn-close"
                            aria-label="Close"
                        >
                            <CloseIcon className="win-close-icon" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation row — matches desktop shell navigation-bar */}
            <div className="nav-bar">
                <NavButton label="Back" enabled>
                    <ArrowLeftIcon />
                </NavButton>
                <NavButton label="Forward" enabled={urlReady}>
                    <ArrowRightIcon />
                </NavButton>
                <NavButton label="Refresh">
                    <ArrowPathIcon />
                </NavButton>
                <NavButton label="Home">
                    <HomeIcon />
                </NavButton>

                <div
                    className={[
                        "omnibox",
                        urlReady ? "omnibox-ready" : "",
                    ].join(" ")}
                >
                    <LockIcon className="omnibox-lock" />
                    <div className="omnibox-input" aria-live="polite">
                        {urlText ? (
                            <>
                                <span className="omnibox-text">{urlText}</span>
                                {showUrlCursor ? (
                                    <span className="omnibox-cursor">|</span>
                                ) : null}
                            </>
                        ) : (
                            <span className="omnibox-placeholder skeleton-line" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NavButton({
    label,
    enabled = true,
    children,
}: {
    label: string;
    enabled?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className={["nav-btn", enabled ? "nav-btn-on" : "nav-btn-off"].join(
                " ",
            )}
            aria-label={label}
            disabled={!enabled}
        >
            {children}
        </button>
    );
}
