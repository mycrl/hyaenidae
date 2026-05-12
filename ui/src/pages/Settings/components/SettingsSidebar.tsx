export interface SettingsSection {
    id: string;
    title: string;
    description: string;
}

export default function SettingsSidebar({
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
        <aside className="border-r border-slate-200 bg-white p-3">
            <div className="mb-3">
                <h1 className="text-base font-semibold text-slate-900">{title}</h1>
                <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
            </div>

            <div className="space-y-1.5">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => onSectionChange(section.id)}
                        className={[
                            "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                            activeSection === section.id
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white",
                        ].join(" ")}
                    >
                        <div className="text-sm font-medium">{section.title}</div>
                        <div className="mt-0.5 text-xs leading-4.5 text-slate-500">
                            {section.description}
                        </div>
                    </button>
                ))}
            </div>
        </aside>
    );
}
