import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import AsyncButton from "../../../components/AsyncButton.tsx";
import {
    LOCAL_MODEL_SEARCH_ERROR_CODE,
    type LocalModelSearchErrorCode,
    useLocalModelSearchStore,
} from "../../../state/local-model-search";

const LOCAL_MODEL_SEARCH_ERROR_TRANSLATION_KEYS: Record<LocalModelSearchErrorCode, string> = {
    [LOCAL_MODEL_SEARCH_ERROR_CODE.SEARCH_FAILED]: "settings.localModels.failed",
};

export default function LocalModelSearchDialog({
    open,
    onClose,
    onDownloaded,
}: {
    open: boolean;
    onClose: () => void;
    onDownloaded?: () => void;
}) {
    const { t } = useTranslation();
    const formatSizeInMb = (size: number) => `${(size / (1024 * 1024)).toFixed(2)} MB`;
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
    const getDownloadKey = (modelName: string, filePath: string) => `${modelName}:${filePath}`;
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

    const canRender = useMemo(() => open && typeof document !== "undefined", [open]);

    useEffect(() => {
        if (!open || completedVersion === handledCompletedVersionRef.current) {
            return;
        }

        handledCompletedVersionRef.current = completedVersion;

        onDownloaded?.();
    }, [completedVersion, onDownloaded, open]);

    if (!canRender) {
        return null;
    }

    return createPortal(
        <div
            tag="model-search-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
        >
            <div
                tag="model-search-panel"
                className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
                <div
                    tag="model-search-header"
                    className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"
                >
                    <div tag="model-search-title">
                        <h3 className="text-base font-semibold text-slate-900">
                            {t("settings.localModels.searchDialogTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            {t("settings.localModels.searchDialogDescription")}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>

                <div tag="model-search-body" className="flex-1 overflow-y-auto p-5">
                    <div tag="model-search-toolbar" className="mb-4 flex items-center gap-2">
                        <div
                            tag="model-search-input-shell"
                            className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-500 focus-within:bg-white"
                        >
                            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        void search();
                                    }
                                }}
                                placeholder={t("settings.localModels.searchPlaceholder")}
                                className="w-full bg-transparent text-[13px] outline-none"
                            />
                        </div>

                        <AsyncButton
                            onClick={() => search()}
                            loading={searchLoading}
                            loadingContent={t("settings.loading")}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-[13px] text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {t("settings.localModels.search")}
                        </AsyncButton>
                    </div>

                    {searchLoading ? (
                        <div
                            tag="model-search-loading"
                            className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600"
                        >
                            {t("settings.loading")}
                        </div>
                    ) : null}

                    {errorText ? (
                        <div
                            tag="model-search-error"
                            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
                        >
                            {errorText}
                        </div>
                    ) : null}

                    <div tag="model-search-results" className="space-y-2">
                        {results.length === 0 ? (
                            <div
                                tag="model-search-empty"
                                className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-[13px] text-slate-500"
                            >
                                {query.trim()
                                    ? t("settings.localModels.noSearchResults")
                                    : t("settings.localModels.searchDialogEmpty")}
                            </div>
                        ) : null}

                        {results.map((model) => {
                            return (
                                <details
                                    key={model.id}
                                    className="rounded-xl border border-slate-200 bg-white p-3"
                                >
                                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-medium text-slate-900">
                                                {model.name}
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-slate-500">
                                                {model.author} · {model.downloads} downloads ·{" "}
                                                {model.files.length} files
                                            </div>
                                            {model.tags.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {model.tags.map((tag) => (
                                                        <span
                                                            key={`${model.id}:${tag}`}
                                                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            <span className="text-[11px] text-slate-500">
                                                {t("settings.localModels.chooseFiles")}
                                            </span>
                                        </div>
                                    </summary>

                                    <div tag="model-search-file-list" className="mt-3 space-y-1">
                                        {model.files.map((file) => {
                                            const downloadKey = getDownloadKey(
                                                model.name,
                                                file.path,
                                            );
                                            const downloadState = downloadStates[downloadKey];
                                            const isDownloading =
                                                downloadState !== undefined &&
                                                downloadState.progress < 1;
                                            const progressPercent = Math.round(
                                                Math.min(downloadState?.progress ?? 0, 1) * 100,
                                            );

                                            return (
                                                <div
                                                    tag="model-search-file-item"
                                                    key={`${model.id}:${file.path}`}
                                                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2 text-[12px] text-slate-600"
                                                >
                                                    <div
                                                        tag="model-search-file-details"
                                                        className="min-w-0"
                                                    >
                                                        <div
                                                            tag="model-search-file-name"
                                                            className="truncate text-slate-900"
                                                        >
                                                            {file.path}
                                                        </div>
                                                        <div
                                                            tag="model-search-file-meta"
                                                            className="text-[11px] text-slate-500"
                                                        >
                                                            {file.type} ·{" "}
                                                            {formatSizeInMb(file.size)}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void downloadModel(model, file)
                                                        }
                                                        disabled={isDownloading}
                                                        className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700"
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
                            );
                        })}
                    </div>
                </div>

                <div
                    tag="model-search-footer"
                    className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4"
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        {t("settings.localModels.searchDialogClose")}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
