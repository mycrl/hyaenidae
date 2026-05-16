import "../../styles/pages.settings.css";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncButton from "../../components/async-button";
import { DEFAULT_SETTINGS, cloneSettings } from "../../services/settings";
import { useSettingsStore } from "../../services/settings.state";
import LocalModelSection from "./local-model";
import ProviderSection from "./provider";
import BrowserSection from "./browser";
import Sidebar, { type SettingsSection } from "./components/sidebar";
import type { AppSettings } from "@hyaenidae/bridge";

type SectionId = "providers" | "local-models" | "browser";

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
    error instanceof Error && error.message.trim()
        ? error.message
        : fallbackMessage;

export default function SettingsPage() {
    const { t } = useTranslation();
    const initializeRpc = useSettingsStore((state) => state.initializeRpc);
    const settings = useSettingsStore((state) => state.settings);
    const save = useSettingsStore((state) => state.save);
    const [activeSection, setActiveSection] = useState<SectionId>("providers");
    const [draft, setDraft] = useState<AppSettings>(() =>
        cloneSettings(DEFAULT_SETTINGS),
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const applyDraftPatch = (patch: Partial<AppSettings>) => {
        setDraft((current) => ({
            ...current,
            ...patch,
        }));
    };

    const resetDraft = () => {
        setDraft(cloneSettings(settings));
    };

    const reportError = (error: unknown, fallbackMessage: string) => {
        setErrorMessage(getErrorMessage(error, fallbackMessage));
    };

    useEffect(() => {
        document.title = `Hyaenidae - ${t("settings.title")}`;

        void initializeRpc().catch((error) => {
            reportError(error, t("settings.loadFailed"));
        });
    }, [initializeRpc, t]);

    useEffect(() => {
        setDraft(cloneSettings(settings));
        setErrorMessage(null);
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
            {
                id: "browser",
                title: t("settings.sections.browser.title"),
                description: t("settings.sections.browser.description"),
            },
        ],
        [t],
    );

    return (
        <div className="settings-page-root">
            <div className="settings-page-layout">
                <Sidebar
                    title={t("settings.title")}
                    subtitle={t("settings.subtitle")}
                    sections={sections}
                    activeSection={activeSection}
                    onSectionChange={(sectionId) =>
                        setActiveSection(sectionId as SectionId)
                    }
                />

                <section className="settings-page-content">
                    {errorMessage ? (
                        <div
                            className="settings-page-error-banner"
                            role="alert"
                        >
                            <div className="settings-page-error-copy">
                                <div className="settings-page-error-title">
                                    {t("settings.errorTitle")}
                                </div>
                                <div className="settings-page-error-message">
                                    {errorMessage}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setErrorMessage(null)}
                                aria-label={t("settings.dismissError")}
                                className="settings-page-error-dismiss"
                            >
                                <XMarkIcon className="settings-page-error-dismiss-icon" />
                            </button>
                        </div>
                    ) : null}

                    {activeSection === "providers" ? (
                        <ProviderSection
                            providers={draft.providers}
                            onProvidersChange={(providers) =>
                                applyDraftPatch({ providers })
                            }
                        />
                    ) : null}

                    {activeSection === "local-models" ? (
                        <LocalModelSection
                            settings={draft}
                            onSettingsChange={applyDraftPatch}
                            onError={reportError}
                        />
                    ) : null}

                    {activeSection === "browser" ? (
                        <BrowserSection
                            settings={draft}
                            onSettingsChange={applyDraftPatch}
                        />
                    ) : null}

                    <div className="settings-page-actions">
                        <button
                            type="button"
                            onClick={resetDraft}
                            className="settings-page-reset-button"
                        >
                            {t("settings.reset")}
                        </button>

                        <AsyncButton
                            onClick={() =>
                                save(draft).catch((error) => {
                                    reportError(
                                        error,
                                        t("settings.saveFailed"),
                                    );
                                })
                            }
                            // loading={isSaving}
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
