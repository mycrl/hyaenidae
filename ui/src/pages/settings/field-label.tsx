import "../../styles/pages.settings.field-label.css";

import type { ReactNode } from "react";

export default function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="field-label-root">
            <span className="field-label-text">{label}</span>
            {children}
        </label>
    );
}
