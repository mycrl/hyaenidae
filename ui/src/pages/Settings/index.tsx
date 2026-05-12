import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Banner from "./components/Banner";
import LocalModelsSection from "./components/LocalModelsSection";
import ProviderSettingsSection from "./components/ProviderSettingsSection";
import SettingsSidebar, { type SettingsSection } from "./components/SettingsSidebar";
import {
    DEFAULT_SETTINGS,
    createLocalRunnerSettings,
    useSettingsStore,
    type AppSettings,
} from "../../state/settings";

type SectionId = "providers" | "local-models";

const cloneSettings = (settings: AppSettings): AppSettings => ({
    schemaVersion: settings.schemaVersion,
    providers: settings.providers.map((provider) => ({ ...provider })),
    localRunner: settings.localRunner ?? createLocalRunnerSettings(),
});

export default function SettingsPage() {
    const { t } = useTranslation();
    const initializeRpc = useSettingsStore((state) => state.initializeRpc);
    const settings = useSettingsStore((state) => state.settings);
    const isLoading = useSettingsStore((state) => state.isLoading);
    const isSaving = useSettingsStore((state) => state.isSaving);
    const error = useSettingsStore((state) => state.error);
    const save = useSettingsStore((state) => state.save);

    const [activeSection, setActiveSection] = useState<SectionId>("providers");
    const [draft, setDraft] = useState<AppSettings>(() => cloneSettings(DEFAULT_SETTINGS));

    useEffect(() => {
        document.title = `Hyaenidae - ${t("settings.title")}`;
        void initializeRpc();
    }, [initializeRpc, t]);

    useEffect(() => {
        setDraft(cloneSettings(settings));
    }, [settings]);

    const sections = useMemo<SettingsSection[]>(
        () => [
            {
                id: "providers",
                title: t("settings.sections.providers.title"),
                description: t("settings.sections.providers.description"),
            },
            {
                id: "local-models",
                title: t("settings.sections.localModels.title"),
                description: t("settings.sections.localModels.description"),
            },
        ],
        [t],
    );

    return (
        <div className="h-screen min-h-screen overflow-hidden bg-slate-50">
            <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)]">
                <SettingsSidebar
                    title={t("settings.title")}
                    subtitle={t("settings.subtitle")}
                    sections={sections}
                    activeSection={activeSection}
                    onSectionChange={(sectionId) => setActiveSection(sectionId as SectionId)}
                />

                <section className="min-w-0 overflow-y-auto p-4">
                    {isLoading ? <Banner tone="neutral">{t("settings.loading")}</Banner> : null}
                    {error ? <Banner tone="danger">{error}</Banner> : null}

                    {activeSection === "providers" ? (
                        <ProviderSettingsSection
                            providers={draft.providers}
                            onProvidersChange={(providers) =>
                                setDraft((current) => ({
                                    ...current,
                                    providers,
                                }))
                            }
                        />
                    ) : null}

                    {activeSection === "local-models" ? (
                        <LocalModelsSection
                            localRunner={draft.localRunner}
                            providers={draft.providers}
                            onLocalRunnerChange={(localRunner) =>
                                setDraft((current) => ({
                                    ...current,
                                    localRunner,
                                }))
                            }
                            onProvidersChange={(providers) =>
                                setDraft((current) => ({
                                    ...current,
                                    providers,
                                }))
                            }
                        />
                    ) : null}

                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setDraft(cloneSettings(settings))}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            {t("settings.reset")}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                void save(draft);
                            }}
                            disabled={isSaving}
                            className="h-9 rounded-lg bg-blue-600 px-3 text-[13px] text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {isSaving ? t("settings.saving") : t("settings.save")}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
