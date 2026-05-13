import type { ReactNode } from "react";

export default function SettingsCard({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section
            tag="settings-card"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
            <div tag="settings-card-header" className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-[11px] leading-4.5 text-slate-500">{description}</p>
            </div>

            <div tag="settings-card-body" className="space-y-3">
                {children}
            </div>
        </section>
    );
}
