import type { ReactNode } from "react";

export default function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-700">{label}</span>
            {children}
        </label>
    );
}
