import "../../styles/pages.settings.css";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncButton from "../../components/async-button";
import Banner from "./banner";
import LocalModelsSection from "./local-models-section";
import ProviderSettingsSection from "./provider-settings-section";
import SettingsSidebar, { type SettingsSection } from "./settings-sidebar";
import {
    DEFAULT_SETTINGS,
    SETTINGS_ERROR_CODE,
    createLocalRunnerSettings,
    useSettingsStore,
    type AppSettings,
    type SettingsErrorCode,
} from "../../services/settings";

type SectionId = "providers" | "local-models";

const SETTINGS_ERROR_TRANSLATION_KEYS: Record<SettingsErrorCode, string> = {
    [SETTINGS_ERROR_CODE.LOAD_FAILED]: "settings.loadFailed",
    [SETTINGS_ERROR_CODE.SAVE_FAILED]: "settings.saveFailed",
};

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
    const errorText =
        error?.message ?? (error?.code ? t(SETTINGS_ERROR_TRANSLATION_KEYS[error.code]) : null);

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
        <div className="settings-page-root">
            <div className="settings-page-layout">
                <SettingsSidebar
                    title={t("settings.title")}
                    subtitle={t("settings.subtitle")}
                    sections={sections}
                    activeSection={activeSection}
                    onSectionChange={(sectionId) => setActiveSection(sectionId as SectionId)}
                />

                <section className="settings-page-content">
                    {isLoading ? <Banner tone="neutral">{t("settings.loading")}</Banner> : null}
                    {errorText ? <Banner tone="danger">{errorText}</Banner> : null}

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

                    <div className="settings-page-actions">
                        <button
                            type="button"
                            onClick={() => setDraft(cloneSettings(settings))}
                            className="settings-page-reset-button"
                        >
                            {t("settings.reset")}
                        </button>

                        <AsyncButton
                            onClick={() => save(draft)}
                            loading={isSaving}
                            loadingContent={t("settings.saving")}
                            className="settings-page-save-button"
                        >
                            {t("settings.save")}
                        </AsyncButton>
                    </div>
                </section>
            </div>
        </div>
    );
}
