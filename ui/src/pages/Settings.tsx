import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../state/settings";
import {
    DEFAULT_SETTINGS,
    createProviderSettings,
    type ApiProviderType,
    type ApiProviderSettings,
    type AppSettings,
} from "../state/settings";

type SectionId = "providers" | "advanced";

const cloneSettings = (settings: AppSettings): AppSettings => ({
    schemaVersion: settings.schemaVersion,
    providers: settings.providers.map((provider) => ({ ...provider })),
    extra: { ...(settings.extra ?? {}) },
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
        document.title = "Hyaenidae - " + t("settings.title");

        void initializeRpc();
    }, [initializeRpc]);

    useEffect(() => {
        setDraft(cloneSettings(settings));
    }, [settings]);

    const sections = useMemo(
        () => [
            {
                id: "providers" as const,
                title: t("settings.sections.providers.title"),
                description: t("settings.sections.providers.description"),
            },
            {
                id: "advanced" as const,
                title: t("settings.sections.advanced.title"),
                description: t("settings.sections.advanced.description"),
            },
        ],
        [t],
    );

    const updateProvider = (id: string, patch: Partial<ApiProviderSettings>) => {
        setDraft((current) => ({
            ...current,
            providers: current.providers.map((provider) =>
                provider.id === id ? { ...provider, ...patch } : provider,
            ),
        }));
    };

    const addProvider = () => {
        const provider = createProviderSettings();
        setDraft((current) => ({
            ...current,
            providers: [...current.providers, provider],
        }));
    };

    const providerTypeOptions: ApiProviderType[] = ["openai", "google", "custom"];

    const removeProvider = (id: string) => {
        setDraft((current) => ({
            ...current,
            providers: current.providers.filter((provider) => provider.id !== id),
        }));
    };

    return (
        <div className="h-screen min-h-screen overflow-hidden bg-slate-50">
            <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)]">
                <aside className="border-r border-slate-200 bg-white p-3">
                    <div className="mb-3">
                        <h1 className="text-base font-semibold text-slate-900">
                            {t("settings.title")}
                        </h1>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            {t("settings.subtitle")}
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => setActiveSection(section.id)}
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

                <section className="min-w-0 overflow-y-auto p-4">
                    {isLoading ? <Banner tone="neutral">{t("settings.loading")}</Banner> : null}
                    {error ? <Banner tone="danger">{error}</Banner> : null}

                    {activeSection === "providers" ? (
                        <SettingsCard
                            title={t("settings.sections.providers.title")}
                            description={t("settings.sections.providers.description")}
                        >
                            <div className="flex items-center justify-between">
                                <p className="pr-4 text-[13px] leading-5 text-slate-600">
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
                                {draft.providers.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[13px] text-slate-500">
                                        {t("settings.noProviders")}
                                    </div>
                                ) : null}

                                {draft.providers.map((provider, index) => (
                                    <div
                                        key={provider.id}
                                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                                    >
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[13px] font-medium text-slate-900">
                                                    {provider.name ||
                                                        `${t("settings.providerLabel")} ${index + 1}`}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {provider.type === "custom"
                                                        ? provider.baseUrl ||
                                                          t("settings.providerBaseURLPlaceholder")
                                                        : t(
                                                              `settings.providerTypes.${provider.type}`,
                                                          )}
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
                                                        updateProvider(provider.id, {
                                                            name: event.target.value,
                                                        })
                                                    }
                                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
                                                />
                                            </FieldLabel>

                                            <FieldLabel label={t("settings.providerType")}>
                                                <select
                                                    value={provider.type}
                                                    onChange={(event) => {
                                                        const nextType = event.target
                                                            .value as ApiProviderType;
                                                        updateProvider(provider.id, {
                                                            type: nextType,
                                                            baseUrl:
                                                                nextType === "custom"
                                                                    ? provider.baseUrl
                                                                    : "",
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
                                                        placeholder={t(
                                                            "settings.providerBaseURLPlaceholder",
                                                        )}
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
                    ) : null}

                    {activeSection === "advanced" ? (
                        <SettingsCard
                            title={t("settings.sections.advanced.title")}
                            description={t("settings.sections.advanced.description")}
                        >
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-600">
                                {t("settings.advancedPlaceholder")}
                            </div>
                        </SettingsCard>
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

function SettingsCard({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-[11px] leading-4.5 text-slate-500">{description}</p>
            </div>

            <div className="space-y-3">{children}</div>
        </section>
    );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-700">{label}</span>
            {children}
        </label>
    );
}

function Banner({ tone, children }: { tone: "neutral" | "danger"; children: ReactNode }) {
    return (
        <div
            className={[
                "mb-3 rounded-lg border px-3 py-2 text-[13px]",
                tone === "danger"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200 bg-white text-slate-600",
            ].join(" ")}
        >
            {children}
        </div>
    );
}
