import "../../../styles/pages.settings.settings-card.css";

import type { ReactNode } from "react";

export default function Card({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section tag="settings-card" className="settings-card-root">
            <div tag="settings-card-header" className="settings-card-header">
                <h2 className="settings-card-title">{title}</h2>
                <p className="settings-card-description">{description}</p>
            </div>

            <div tag="settings-card-body" className="settings-card-body">
                {children}
            </div>
        </section>
    );
}
