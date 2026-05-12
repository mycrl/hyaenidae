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
import { useShellStore } from "../../../state/shell";

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

    return (
        <div className="h-12 border-b border-slate-200 bg-white px-2 flex items-center gap-1">
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

            <div className="flex-1 mx-2 px-3 h-9 rounded-xl border border-slate-200 bg-slate-100 focus-within:bg-white focus-within:border-blue-500 transition-colors flex items-center gap-2">
                <LockClosedIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onFocus={() => setIsEditingUrl(true)}
                    onBlur={() => setIsEditingUrl(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            navigateTo(urlInput);
                            setIsEditingUrl(false);
                        }
                    }}
                    placeholder={t("nav.placeholder")}
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400"
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
                "w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0",
                disabled
                    ? "text-slate-300 cursor-default"
                    : "text-slate-600 hover:bg-slate-100 active:bg-slate-200",
            ].join(" ")}
        >
            {children}
        </button>
    );
}
