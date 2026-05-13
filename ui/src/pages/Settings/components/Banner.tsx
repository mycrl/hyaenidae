import type { ReactNode } from "react";

export default function Banner({
    tone,
    children,
}: {
    tone: "neutral" | "danger";
    children: ReactNode;
}) {
    return (
        <div
            tag="settings-banner"
            className={[
                "mb-3 rounded-lg border px-3 py-2 text-[13px]",
                tone === "danger"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200 bg-white text-slate-600",
            ].join(" ")}
        >
            {children}
        </div>
    );
}
