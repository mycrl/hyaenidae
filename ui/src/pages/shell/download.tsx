import "../../styles/pages.shell.download.css";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { useShellStore } from "../../services/shell.state";

export function DownloadIndicator() {
    const createTab = useShellStore((state) => state.createTab);
    const isDownloading = useShellStore((state) => state.isDownloading);
    const { t } = useTranslation();

    const openDownloadsTab = () => {
        void createTab(CONFIG.downloadsUrl);
    };

    return (
        <button
            type="button"
            className={
                "tab-bar-download-button" +
                (isDownloading ? " downloading" : "")
            }
            title={t("downloads.open")}
            aria-label={t("downloads.open")}
            onClick={openDownloadsTab}
        >
            <ArrowDownTrayIcon className="tab-bar-download-icon" />
        </button>
    );
}
