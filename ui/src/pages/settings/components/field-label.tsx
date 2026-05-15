import "../../../styles/pages.settings.field-label.css";

import type { ReactNode } from "react";

export default function FieldLabel({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <label className={`field-label-root ${className ?? ""}`}>
            <span className="field-label-text">{label}</span>
            {children}
        </label>
    );
}
