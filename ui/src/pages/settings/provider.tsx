import "../../styles/pages.settings.provider-settings-section.css";

import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { createProviderSettings } from "../../services/settings";
import Card from "./components/card";
import FieldLabel from "./components/field-label";
import type { ApiProviderSettings, ApiProviderType } from "@hyaenidae/bridge";

const providerTypeOptions: ApiProviderType[] = ["openai", "google", "custom"];

const toNullableInputValue = (value: string) => (value === "" ? null : value);

const getProviderTitle = (
    provider: ApiProviderSettings,
    index: number,
    providerLabel: string,
) => provider.name?.trim() || `${providerLabel} ${index + 1}`;

const getProviderDescription = (
    provider: ApiProviderSettings,
    translate: (key: string) => string,
) =>
    provider.type === "custom"
        ? provider.baseUrl?.trim() ||
          translate("settings.providerBaseURLPlaceholder")
        : translate(`settings.providerTypes.${provider.type}`);

export default function ProviderSection({
    providers,
    onProvidersChange,
}: {
    providers: ApiProviderSettings[];
    onProvidersChange: (providers: ApiProviderSettings[]) => void;
}) {
    const { t } = useTranslation();

    const updateProvider = (
        id: string,
        patch: Partial<ApiProviderSettings>,
    ) => {
        onProvidersChange(
            providers.map((provider) =>
                provider.id === id ? { ...provider, ...patch } : provider,
            ),
        );
    };

    return (
        <Card
            title={t("settings.sections.providers.title")}
            description={t("settings.sections.providers.description")}
        >
            <div className="provider-settings-toolbar">
                <p className="provider-settings-hint">
                    {t("settings.providersHint")}
                </p>

                <button
                    type="button"
                    onClick={() =>
                        onProvidersChange([
                            ...providers,
                            createProviderSettings(),
                        ])
                    }
                    className="provider-settings-add-button"
                >
                    <PlusIcon className="provider-settings-add-icon" />
                    <span>{t("settings.addProvider")}</span>
                </button>
            </div>

            <div className="provider-settings-list">
                {providers.map((provider, index) => (
                    <EditableProviderCard
                        key={provider.id}
                        provider={provider}
                        index={index}
                        onRemove={() =>
                            onProvidersChange(
                                providers.filter(
                                    (item) => item.id !== provider.id,
                                ),
                            )
                        }
                        onUpdate={(patch) => updateProvider(provider.id, patch)}
                    />
                ))}
            </div>
        </Card>
    );
}

function EditableProviderCard({
    provider,
    index,
    onUpdate,
    onRemove,
}: {
    provider: ApiProviderSettings;
    index: number;
    onUpdate: (patch: Partial<ApiProviderSettings>) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const providerTitle = getProviderTitle(
        provider,
        index,
        t("settings.providerLabel"),
    );
    const providerDescription = getProviderDescription(provider, t);

    return (
        <div className="provider-settings-item">
            <div className="provider-settings-item-header">
                <div>
                    <div className="provider-settings-item-title">
                        {providerTitle}
                    </div>
                    <div className="provider-settings-item-description">
                        {providerDescription}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onRemove}
                    className="provider-settings-remove-button"
                    aria-label={t("settings.removeProvider")}
                >
                    <TrashIcon className="provider-settings-remove-icon" />
                </button>
            </div>

            <div className="provider-settings-fields">
                <ProviderTextField
                    label={t("settings.providerName")}
                    value={provider.name ?? null}
                    onChange={(value) => onUpdate({ name: value ?? undefined })}
                />

                <FieldLabel label={t("settings.providerType")}>
                    <select
                        value={provider.type}
                        onChange={(event) => {
                            const nextType = event.target
                                .value as ApiProviderType;
                            onUpdate({
                                type: nextType,
                                baseUrl:
                                    nextType === "custom"
                                        ? provider.baseUrl
                                        : undefined,
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
                    <ProviderTextField
                        label={t("settings.providerBaseURL")}
                        value={provider.baseUrl ?? null}
                        placeholder={t("settings.providerBaseURLPlaceholder")}
                        onChange={(value) =>
                            onUpdate({ baseUrl: value ?? undefined })
                        }
                    />
                ) : null}

                <ProviderTextField
                    label={t("settings.providerApiKey")}
                    value={provider.apiKey ?? null}
                    onChange={(value) =>
                        onUpdate({ apiKey: value ?? undefined })
                    }
                />
            </div>
        </div>
    );
}

function ProviderTextField({
    label,
    value,
    placeholder,
    onChange,
}: {
    label: string;
    value: string | null;
    placeholder?: string;
    onChange: (value: string | null) => void;
}) {
    return (
        <FieldLabel label={label}>
            <input
                value={value ?? ""}
                onChange={(event) =>
                    onChange(toNullableInputValue(event.target.value))
                }
                placeholder={placeholder}
                className="provider-settings-control"
            />
        </FieldLabel>
    );
}
