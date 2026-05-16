import "../../styles/pages.downloads.css";

import {
    ArrowDownTrayIcon,
    PauseIcon,
    PlayIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import type { DownloadEvent } from "@hyaenidae/bridge";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDownloadsStore } from "../../services/downloads.state";
import {
    cancelDownload,
    pauseDownload,
    resumeDownload,
} from "../../services/downloads";

function formatBytes(bytes: number) {
    if (bytes <= 0) {
        return "—";
    }

    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const digits = unitIndex === 0 ? 0 : 1;

    return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function DownloadItemRow({ item }: { item: DownloadEvent }) {
    const { t } = useTranslation();
    const isActive = item.type === "progressing" || item.type === "interrupted";
    const showProgress = item.type === "progressing" && !item.isPaused;
    const progress = Math.min(100, Math.max(0, item.progress));

    return (
        <li className="downloads-item">
            <div className="downloads-item-main">
                <span className="downloads-item-filename" title={item.filename}>
                    {item.filename}
                </span>

                <span className="downloads-item-meta">
                    {item.type === "completed"
                        ? t("downloads.completed")
                        : item.type === "cancelled"
                          ? t("downloads.cancelled")
                          : item.type === "interrupted"
                            ? t("downloads.interrupted")
                            : item.isPaused
                              ? t("downloads.paused")
                              : t("downloads.progress", {
                                    received: formatBytes(item.receivedBytes),
                                    total: formatBytes(item.totalBytes),
                                })}
                </span>

                {showProgress ? (
                    <div
                        className="downloads-item-progress"
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="downloads-item-progress-bar"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                ) : null}
            </div>

            {isActive ? (
                <div className="downloads-item-actions">
                    {item.type === "progressing" ? (
                        <button
                            type="button"
                            className="downloads-item-action"
                            title={
                                item.isPaused
                                    ? t("downloads.resume")
                                    : t("downloads.pause")
                            }
                            aria-label={
                                item.isPaused
                                    ? t("downloads.resume")
                                    : t("downloads.pause")
                            }
                            onClick={() => {
                                if (item.isPaused) {
                                    void resumeDownload(item.id);
                                    return;
                                }

                                void pauseDownload(item.id);
                            }}
                        >
                            {item.isPaused ? (
                                <PlayIcon className="downloads-item-action-icon" />
                            ) : (
                                <PauseIcon className="downloads-item-action-icon" />
                            )}
                        </button>
                    ) : null}

                    <button
                        type="button"
                        className="downloads-item-action downloads-item-action-cancel"
                        title={t("downloads.cancel")}
                        aria-label={t("downloads.cancel")}
                        onClick={() => {
                            void cancelDownload(item.id);
                        }}
                    >
                        <XMarkIcon className="downloads-item-action-icon" />
                    </button>
                </div>
            ) : null}
        </li>
    );
}

export default function DownloadsPage() {
    const { t } = useTranslation();
    const initializeRpc = useDownloadsStore((state) => state.initializeRpc);
    const downloads = useDownloadsStore((state) => state.downloads);

    useEffect(() => {
        document.title = `Hyaenidae - ${t("downloads.title")}`;

        void initializeRpc();
    }, [initializeRpc, t]);

    const items = [...downloads].reverse();

    return (
        <div className="downloads-page-root">
            <header className="downloads-page-header">
                <div className="downloads-page-heading">
                    <ArrowDownTrayIcon className="downloads-page-icon" />
                    <div>
                        <h1 className="downloads-page-title">
                            {t("downloads.title")}
                        </h1>
                        <p className="downloads-page-subtitle">
                            {t("downloads.subtitle")}
                        </p>
                    </div>
                </div>
            </header>

            {items.length === 0 ? (
                <p className="downloads-page-empty">{t("downloads.empty")}</p>
            ) : (
                <ul className="downloads-page-list">
                    {items.map((item) => (
                        <DownloadItemRow key={item.id} item={item} />
                    ))}
                </ul>
            )}
        </div>
    );
}
