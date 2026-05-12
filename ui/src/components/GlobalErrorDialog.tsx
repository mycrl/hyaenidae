import { XMarkIcon } from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalErrorStore } from "../state/global-error";

export default function GlobalErrorDialog() {
    const { t } = useTranslation();
    const message = useGlobalErrorStore((state) => state.message);
    const clearError = useGlobalErrorStore((state) => state.clearError);
    const canRender = useMemo(() => Boolean(message) && typeof document !== "undefined", [message]);

    if (!canRender || !message) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">
                            {t("common.errorTitle")}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={clearError}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-5 py-4 text-[13px] text-red-700">{message}</div>

                <div className="flex items-center justify-end border-t border-slate-200 px-5 py-4">
                    <button
                        type="button"
                        onClick={clearError}
                        className="h-9 rounded-lg bg-red-600 px-3 text-[13px] text-white transition-colors hover:bg-red-700"
                    >
                        {t("common.dismiss")}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
