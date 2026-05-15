import "../../../styles/pages.settings.local-model-search-dialog.css";

import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import AsyncButton from "../../../components/async-button";
import {
    LOCAL_MODEL_SEARCH_ERROR_CODE,
    type LocalModelSearchErrorCode,
    useLocalModelSearchStore,
} from "../../../services/local-model-search.state";

const LOCAL_MODEL_SEARCH_ERROR_TRANSLATION_KEYS: Record<LocalModelSearchErrorCode, string> = {
    [LOCAL_MODEL_SEARCH_ERROR_CODE.SEARCH_FAILED]: "settings.localModels.failed",
};

const formatSizeInMb = (size: number) => `${(size / (1024 * 1024)).toFixed(2)} MB`;

export default function SearchDialog({
    open,
    onClose,
    onDownloaded,
}: {
    open: boolean;
    onClose: () => void;
    onDownloaded?: () => void;
}) {
    const { t } = useTranslation();
    const initialized = useLocalModelSearchStore((state) => state.initialized);
    const query = useLocalModelSearchStore((state) => state.query);
    const searchLoading = useLocalModelSearchStore((state) => state.searchLoading);
    const results = useLocalModelSearchStore((state) => state.results);
    const error = useLocalModelSearchStore((state) => state.error);
    const downloadStates = useLocalModelSearchStore((state) => state.downloadStates);
    const completedVersion = useLocalModelSearchStore((state) => state.completedVersion);
    const initializeRpc = useLocalModelSearchStore((state) => state.initializeRpc);
    const setQuery = useLocalModelSearchStore((state) => state.setQuery);
    const search = useLocalModelSearchStore((state) => state.search);
    const downloadModel = useLocalModelSearchStore((state) => state.downloadModel);
    const handledCompletedVersionRef = useRef(completedVersion);
    const errorText =
        error?.message ??
        (error?.code ? t(LOCAL_MODEL_SEARCH_ERROR_TRANSLATION_KEYS[error.code]) : null);

    useEffect(() => {
        if (!initialized) {
            initializeRpc();
        }
    }, [initializeRpc, initialized]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open]);

    useEffect(() => {
        if (!open || completedVersion === handledCompletedVersionRef.current) {
            return;
        }

        handledCompletedVersionRef.current = completedVersion;
        onDownloaded?.();
    }, [completedVersion, onDownloaded, open]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="model-search-overlay">
            <div className="model-search-panel">
                <div className="model-search-header">
                    <div>
                        <h3 className="model-search-heading">
                            {t("settings.localModels.searchDialogTitle")}
                        </h3>
                        <p className="model-search-description">
                            {t("settings.localModels.searchDialogDescription")}
                        </p>
                    </div>

                    <button type="button" onClick={onClose} className="model-search-close-button">
                        <XMarkIcon className="model-search-close-icon" />
                    </button>
                </div>

                <div className="model-search-body">
                    <div className="model-search-toolbar">
                        <div className="model-search-input-shell">
                            <MagnifyingGlassIcon className="model-search-input-icon" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        void search();
                                    }
                                }}
                                placeholder={t("settings.localModels.searchPlaceholder")}
                                className="model-search-input"
                            />
                        </div>

                        <AsyncButton
                            onClick={() => search()}
                            loading={searchLoading}
                            loadingContent={t("settings.loading")}
                            className="model-search-submit-button"
                        >
                            {t("settings.localModels.search")}
                        </AsyncButton>
                    </div>

                    {searchLoading ? (
                        <div className="model-search-loading">{t("settings.loading")}</div>
                    ) : null}
                    {errorText ? <div className="model-search-error">{errorText}</div> : null}

                    <div className="model-search-results">
                        {results.length === 0 ? (
                            <div className="model-search-empty">
                                {query.trim()
                                    ? t("settings.localModels.noSearchResults")
                                    : t("settings.localModels.searchDialogEmpty")}
                            </div>
                        ) : null}

                        {results.map((model) => (
                            <details key={model.id} className="model-search-result-card">
                                <summary className="model-search-result-summary">
                                    <div className="model-search-result-main">
                                        <div className="model-search-result-title">
                                            {model.name}
                                        </div>
                                        <div className="model-search-result-meta">
                                            {model.author} · {model.downloads} downloads ·{" "}
                                            {model.files.length} files
                                        </div>
                                        {model.tags.length > 0 ? (
                                            <div className="model-search-result-tags">
                                                {model.tags.map((tag) => (
                                                    <span
                                                        key={`${model.id}:${tag}`}
                                                        className="model-search-result-tag"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="model-search-result-side">
                                        <span className="model-search-result-side-text">
                                            {t("settings.localModels.chooseFiles")}
                                        </span>
                                    </div>
                                </summary>

                                <div className="model-search-file-list">
                                    {model.files.map((file) => {
                                        const downloadKey = `${model.name}:${file.path}`;
                                        const downloadState = downloadStates[downloadKey];
                                        const isDownloading =
                                            downloadState !== undefined &&
                                            downloadState.progress < 1;
                                        const progressPercent = Math.round(
                                            Math.min(downloadState?.progress ?? 0, 1) * 100,
                                        );

                                        return (
                                            <div
                                                key={`${model.id}:${file.path}`}
                                                className="model-search-file-item"
                                            >
                                                <div className="model-search-file-details">
                                                    <div className="model-search-file-name">
                                                        {file.path}
                                                    </div>
                                                    <div className="model-search-file-meta">
                                                        {file.type} · {formatSizeInMb(file.size)}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => void downloadModel(model, file)}
                                                    disabled={isDownloading}
                                                    className="model-search-file-action"
                                                >
                                                    {isDownloading
                                                        ? `${progressPercent}%`
                                                        : t("settings.localModels.download")}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
