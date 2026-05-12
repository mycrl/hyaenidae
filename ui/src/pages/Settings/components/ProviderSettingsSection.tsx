import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import {
    createLocalRunnerProvider,
    createProviderSettings,
    type ApiProviderSettings,
    type ApiProviderType,
} from "../../../state/settings";
import FieldLabel from "./FieldLabel";
import SettingsCard from "./SettingsCard";

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
            <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] leading-5 text-slate-600">
                    {t("settings.providersHint")}
                </p>

                <button
                    type="button"
                    onClick={addProvider}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span>{t("settings.addProvider")}</span>
                </button>
            </div>

            <div className="space-y-3">
                <LocalRunnerProviderCard provider={localRunnerProvider} />

                {editableProviders.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[13px] text-slate-500">
                        {t("settings.noProviders")}
                    </div>
                ) : null}

                {editableProviders.map((provider, index) => (
                    <div
                        key={provider.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[13px] font-medium text-slate-900">
                                    {provider.name || `${t("settings.providerLabel")} ${index + 1}`}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {provider.type === "custom"
                                        ? provider.baseUrl ||
                                          t("settings.providerBaseURLPlaceholder")
                                        : t(`settings.providerTypes.${provider.type}`)}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => removeProvider(provider.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                aria-label={t("settings.removeProvider")}
                            >
                                <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <FieldLabel label={t("settings.providerName")}>
                                <input
                                    value={provider.name}
                                    onChange={(event) =>
                                        updateProvider(provider.id, { name: event.target.value })
                                    }
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
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
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
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
                                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
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
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
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
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <div className="text-[13px] font-medium text-slate-900">
                        {provider.name || t("settings.localRunnerProvider.title")}
                    </div>
                    <div className="text-[11px] text-slate-500">
                        {t("settings.localRunnerProvider.description")}
                    </div>
                </div>

                <div className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {t(`settings.providerTypes.${provider.type}`)}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-1">
                <FieldLabel label={t("settings.providerName")}>
                    <input
                        value={provider.name}
                        readOnly
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none"
                    />
                </FieldLabel>
            </div>
        </div>
    );
}
