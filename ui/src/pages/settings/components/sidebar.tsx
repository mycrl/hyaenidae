import "../../../styles/pages.settings.settings-sidebar.css";

export interface SettingsSection {
    id: string;
    title: string;
    description: string;
}

export default function Sidebar({
    title,
    subtitle,
    sections,
    activeSection,
    onSectionChange,
}: {
    title: string;
    subtitle: string;
    sections: SettingsSection[];
    activeSection: string;
    onSectionChange: (sectionId: string) => void;
}) {
    return (
        <aside tag="settings-sidebar" className="settings-sidebar-root">
            <div tag="settings-sidebar-header" className="settings-sidebar-header">
                <h1 className="settings-sidebar-title">{title}</h1>
                <p className="settings-sidebar-subtitle">{subtitle}</p>
            </div>

            <div tag="settings-sidebar-list" className="settings-sidebar-list">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => onSectionChange(section.id)}
                        className={[
                            "settings-sidebar-item",
                            activeSection === section.id
                                ? "settings-sidebar-item-active"
                                : "settings-sidebar-item-inactive",
                        ].join(" ")}
                    >
                        <div className="settings-sidebar-item-title">{section.title}</div>
                        <div className="settings-sidebar-item-description">
                            {section.description}
                        </div>
                    </button>
                ))}
            </div>
        </aside>
    );
}
