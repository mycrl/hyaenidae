import "../../styles/pages.settings.provider-settings-section.css";

import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import {
    createLocalRunnerProvider,
    createProviderSettings,
    type ApiProviderSettings,
    type ApiProviderType,
} from "../../services/settings";
import FieldLabel from "./field-label";
import SettingsCard from "./settings-card";

const providerTypeOptions: ApiProviderType[] = ["openai", "google", "custom"];

export default function ProviderSettingsSection({
    providers,
    onProvidersChange,
}: {
    providers: ApiProviderSettings[];
    onProvidersChange: (providers: ApiProviderSettings[]) => void;
}) {
    const { t } = useTranslation();
    const localRunnerProvider =
        providers.find((provider) => provider.type === "local-runner") ??
        createLocalRunnerProvider();
    const editableProviders = providers.filter((provider) => provider.type !== "local-runner");

    const updateProvider = (id: string, patch: Partial<ApiProviderSettings>) => {
        onProvidersChange(
            providers.map((provider) =>
                provider.id === id ? { ...provider, ...patch } : provider,
            ),
        );
    };

    const addProvider = () => {
        onProvidersChange([...providers, createProviderSettings()]);
    };

    const removeProvider = (id: string) => {
        onProvidersChange(providers.filter((provider) => provider.id !== id));
    };

    return (
        <SettingsCard
            title={t("settings.sections.providers.title")}
            description={t("settings.sections.providers.description")}
        >
            <div tag="provider-settings-toolbar" className="provider-settings-toolbar">
                <p className="provider-settings-hint">{t("settings.providersHint")}</p>

                <button
                    type="button"
                    onClick={addProvider}
                    className="provider-settings-add-button"
                >
                    <PlusIcon className="provider-settings-add-icon" />
                    <span>{t("settings.addProvider")}</span>
                </button>
            </div>

            <div className="provider-settings-list">
                <LocalRunnerProviderCard provider={localRunnerProvider} />

                {editableProviders.length === 0 ? (
                    <div tag="provider-settings-empty" className="provider-settings-empty">
                        {t("settings.noProviders")}
                    </div>
                ) : null}

                {editableProviders.map((provider, index) => (
                    <div
                        tag="provider-settings-item"
                        key={provider.id}
                        className="provider-settings-item"
                    >
                        <div
                            tag="provider-settings-item-header"
                            className="provider-settings-item-header"
                        >
                            <div tag="provider-settings-item-title-group">
                                <div
                                    tag="provider-settings-item-title"
                                    className="provider-settings-item-title"
                                >
                                    {provider.name || `${t("settings.providerLabel")} ${index + 1}`}
                                </div>
                                <div
                                    tag="provider-settings-item-description"
                                    className="provider-settings-item-description"
                                >
                                    {provider.type === "custom"
                                        ? provider.baseUrl ||
                                          t("settings.providerBaseURLPlaceholder")
                                        : t(`settings.providerTypes.${provider.type}`)}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => removeProvider(provider.id)}
                                className="provider-settings-remove-button"
                                aria-label={t("settings.removeProvider")}
                            >
                                <TrashIcon className="provider-settings-remove-icon" />
                            </button>
                        </div>

                        <div tag="provider-settings-fields" className="provider-settings-fields">
                            <FieldLabel label={t("settings.providerName")}>
                                <input
                                    value={provider.name}
                                    onChange={(event) =>
                                        updateProvider(provider.id, { name: event.target.value })
                                    }
                                    className="provider-settings-control"
                                />
                            </FieldLabel>

                            <FieldLabel label={t("settings.providerType")}>
                                <select
                                    value={provider.type}
                                    onChange={(event) => {
                                        const nextType = event.target.value as ApiProviderType;
                                        updateProvider(provider.id, {
                                            type: nextType,
                                            baseUrl: nextType === "custom" ? provider.baseUrl : "",
                                        });
                                    }}
                                    className="provider-settings-control"
                                >
                                    {providerTypeOptions.map((type) => (
                                        <option key={type} value={type}>
                                            {t(`settings.providerTypes.${type}`)}
                                        </option>
                                    ))}
                                </select>
                            </FieldLabel>

                            {provider.type === "custom" ? (
                                <FieldLabel label={t("settings.providerBaseURL")}>
                                    <input
                                        value={provider.baseUrl}
                                        onChange={(event) =>
                                            updateProvider(provider.id, {
                                                baseUrl: event.target.value,
                                            })
                                        }
                                        placeholder={t("settings.providerBaseURLPlaceholder")}
                                        className="provider-settings-control"
                                    />
                                </FieldLabel>
                            ) : null}

                            <FieldLabel label={t("settings.providerApiKey")}>
                                <input
                                    value={provider.apiKey}
                                    onChange={(event) =>
                                        updateProvider(provider.id, {
                                            apiKey: event.target.value,
                                        })
                                    }
                                    className="provider-settings-control"
                                />
                            </FieldLabel>
                        </div>
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
}

function LocalRunnerProviderCard({ provider }: { provider: ApiProviderSettings }) {
    const { t } = useTranslation();

    return (
        <div tag="local-runner-provider-card" className="local-runner-provider-card">
            <div
                tag="local-runner-provider-card-header"
                className="local-runner-provider-card-header"
            >
                <div tag="local-runner-provider-card-title-group">
                    <div
                        tag="local-runner-provider-card-title"
                        className="local-runner-provider-card-title"
                    >
                        {provider.name || t("settings.localRunnerProvider.title")}
                    </div>
                    <div
                        tag="local-runner-provider-card-description"
                        className="local-runner-provider-card-description"
                    >
                        {t("settings.localRunnerProvider.description")}
                    </div>
                </div>

                <div
                    tag="local-runner-provider-card-badge"
                    className="local-runner-provider-card-badge"
                >
                    {t(`settings.providerTypes.${provider.type}`)}
                </div>
            </div>

            <div
                tag="local-runner-provider-card-fields"
                className="local-runner-provider-card-fields"
            >
                <FieldLabel label={t("settings.providerName")}>
                    <input
                        value={provider.name}
                        readOnly
                        className="provider-settings-control-readonly"
                    />
                </FieldLabel>
            </div>
        </div>
    );
}
