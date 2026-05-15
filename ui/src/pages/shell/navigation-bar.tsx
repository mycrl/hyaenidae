import "../../styles/pages.shell.navigation-bar.css";

import {
    ArrowLeftIcon,
    ArrowPathIcon,
    ArrowRightIcon,
    HomeIcon,
    LockClosedIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useShellStore } from "../../services/shell.state";

export default function NavigationBar() {
    const { t } = useTranslation();
    const activeTab = useShellStore(
        (state) => state.tabs.find((tab) => tab.id === state.activeTabId) ?? null,
    );
    const goBack = useShellStore((state) => state.goBack);
    const goForward = useShellStore((state) => state.goForward);
    const refreshOrStop = useShellStore((state) => state.refreshOrStop);
    const goHome = useShellStore((state) => state.goHome);
    const navigateTo = useShellStore((state) => state.navigateTo);

    const canGoBack = activeTab?.canGoBack ?? false;
    const canGoForward = activeTab?.canGoForward ?? false;
    const isLoading = activeTab?.isLoading ?? false;
    const currentUrl = activeTab?.url ?? "";

    const [urlInput, setUrlInput] = useState(currentUrl);
    const [isEditingUrl, setIsEditingUrl] = useState(false);

    useEffect(() => {
        if (isEditingUrl) {
            return;
        }

        setUrlInput(currentUrl);
    }, [currentUrl, isEditingUrl]);

    const submitUrl = () => {
        void navigateTo(urlInput);
        setIsEditingUrl(false);
    };

    return (
        <div tag="navigation-bar" className="navigation-bar-root">
            <NavIconButton title={t("nav.back")} onClick={goBack} disabled={!canGoBack}>
                <ArrowLeftIcon className="w-4 h-4" />
            </NavIconButton>

            <NavIconButton title={t("nav.forward")} onClick={goForward} disabled={!canGoForward}>
                <ArrowRightIcon className="w-4 h-4" />
            </NavIconButton>

            <NavIconButton
                title={isLoading ? t("nav.stop") : t("nav.refresh")}
                onClick={refreshOrStop}
            >
                {isLoading ? (
                    <XMarkIcon className="w-4 h-4" />
                ) : (
                    <ArrowPathIcon className="w-4 h-4" />
                )}
            </NavIconButton>

            <NavIconButton title={t("nav.home")} onClick={goHome}>
                <HomeIcon className="w-4 h-4" />
            </NavIconButton>

            <div tag="nav-location-shell" className="navigation-bar-location-shell">
                <LockClosedIcon className="navigation-bar-location-icon" />
                <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onFocus={() => setIsEditingUrl(true)}
                    onBlur={() => setIsEditingUrl(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            submitUrl();
                        }
                    }}
                    placeholder={t("nav.placeholder")}
                    spellCheck={false}
                    className="navigation-bar-location-input"
                />
            </div>
        </div>
    );
}

function NavIconButton({
    title,
    onClick,
    disabled = false,
    children,
}: {
    title: string;
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            title={title}
            aria-label={title}
            onClick={onClick}
            disabled={disabled}
            className={[
                "navigation-bar-icon-button",
                disabled
                    ? "navigation-bar-icon-button-disabled"
                    : "navigation-bar-icon-button-enabled",
            ].join(" ")}
        >
            {children}
        </button>
    );
}
