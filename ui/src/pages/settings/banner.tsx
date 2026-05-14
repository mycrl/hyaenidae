import "../../styles/pages.settings.banner.css";

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
                "settings-banner",
                tone === "danger" ? "settings-banner-danger" : "settings-banner-neutral",
            ].join(" ")}
        >
            {children}
        </div>
    );
}
