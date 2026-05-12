import {
    ArrowPathIcon,
    MagnifyingGlassIcon,
    PlayIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import type { ModelFileInfo, StartRunnerOptions } from "@hyaenidae/bridge";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalErrorStore } from "../../../state/global-error";
import {
    useSettingsStore,
    type ApiProviderSettings,
    type AppSettings,
    type LocalRunnerSettings,
} from "../../../state/settings";
import FieldLabel from "./FieldLabel";
import LocalModelSearchDialog from "./LocalModelSearchDialog";
import SettingsCard from "./SettingsCard";

export default function LocalModelsSection({
    localRunner,
    providers,
    onLocalRunnerChange,
    onProvidersChange,
}: {
    localRunner: LocalRunnerSettings;
    providers: ApiProviderSettings[];
    onLocalRunnerChange: (localRunner: LocalRunnerSettings) => void;
    onProvidersChange: (providers: ApiProviderSettings[]) => void;
}) {
    const { t } = useTranslation();
    const showError = useGlobalErrorStore((state) => state.showError);
    const clearError = useGlobalErrorStore((state) => state.clearError);
    const saveSettings = useSettingsStore((state) => state.save);
    const [runnerLoading, setRunnerLoading] = useState(false);
    const [installedLoading, setInstalledLoading] = useState(false);
    const [runnerIds, setRunnerIds] = useState<string[]>([]);
    const [localModels, setLocalModels] = useState<string[]>([]);
    const [localModelFiles, setLocalModelFiles] = useState<ModelFileInfo[]>([]);
    const [isRunnerRunning, setIsRunnerRunning] = useState(false);
    const [selectedModelRepo, setSelectedModelRepo] = useState(localRunner.modelRepo);
    const [selectedModelFile, setSelectedModelFile] = useState(localRunner.modelFile);
    const [selectedMmprojFile, setSelectedMmprojFile] = useState(localRunner.mmprojFile);
    const [selectedRunnerId, setSelectedRunnerId] = useState(localRunner.runnerId);
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

    const modelFiles = localModelFiles.filter((file) => file.type === "model");
    const mmprojFiles = localModelFiles.filter((file) => file.type === "mmproj");

    const syncLocalRunnerProvider = async (
        patch: Partial<Pick<AppSettings["providers"][number], "baseUrl" | "apiKey">>,
    ) => {
        const nextProviders = providers.map((provider) =>
            provider.type === "local-runner"
                ? {
                      ...provider,
                      ...patch,
                  }
                : provider,
        );

        onProvidersChange(nextProviders);

        const nextSettings: AppSettings = {
            schemaVersion: 1,
            providers: nextProviders,
            localRunner: {
                runnerId: selectedRunnerId,
                modelRepo: selectedModelRepo,
                modelFile: selectedModelFile,
                mmprojFile: selectedMmprojFile,
            },
        };

        await saveSettings(nextSettings);
    };

    useEffect(() => {
        void refreshAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setSelectedModelRepo(localRunner.modelRepo);
        setSelectedModelFile(localRunner.modelFile);
        setSelectedMmprojFile(localRunner.mmprojFile);
        setSelectedRunnerId(localRunner.runnerId);
    }, [
        localRunner.mmprojFile,
        localRunner.modelFile,
        localRunner.modelRepo,
        localRunner.runnerId,
    ]);

    useEffect(() => {
        if (!selectedModelRepo) {
            setLocalModelFiles([]);
            return;
        }

        const loadLocalModelFiles = async () => {
            try {
                const result = await hyaenidae.bridge.request("model:get-local-model-files", {
                    model: selectedModelRepo,
                });

                setLocalModelFiles(Array.isArray(result.files) ? result.files : []);
            } catch (currentError) {
                setLocalModelFiles([]);
                showError(
                    currentError instanceof Error
                        ? currentError.message
                        : t("settings.localModels.failed"),
                );
            }
        };

        void loadLocalModelFiles();
    }, [selectedModelRepo, t]);

    useEffect(() => {
        if (selectedModelRepo && !localModels.includes(selectedModelRepo)) {
            setSelectedModelRepo("");
            setSelectedModelFile("");
            setSelectedMmprojFile("");
            onLocalRunnerChange({
                runnerId: selectedRunnerId,
                modelRepo: "",
                modelFile: "",
                mmprojFile: "",
            });
        }
    }, [localModels, onLocalRunnerChange, selectedModelRepo, selectedRunnerId]);

    useEffect(() => {
        if (selectedModelFile && !modelFiles.some((file) => file.path === selectedModelFile)) {
            setSelectedModelFile("");
            onLocalRunnerChange({
                runnerId: selectedRunnerId,
                modelRepo: selectedModelRepo,
                modelFile: "",
                mmprojFile: selectedMmprojFile,
            });
        }
    }, [
        modelFiles,
        onLocalRunnerChange,
        selectedModelFile,
        selectedModelRepo,
        selectedMmprojFile,
        selectedRunnerId,
    ]);

    useEffect(() => {
        if (selectedMmprojFile && !mmprojFiles.some((file) => file.path === selectedMmprojFile)) {
            setSelectedMmprojFile("");
            onLocalRunnerChange({
                runnerId: selectedRunnerId,
                modelRepo: selectedModelRepo,
                modelFile: selectedModelFile,
                mmprojFile: "",
            });
            return;
        }

        if (!selectedMmprojFile && mmprojFiles.length === 1) {
            const mmprojFile = mmprojFiles[0]!.path;
            setSelectedMmprojFile(mmprojFile);
            onLocalRunnerChange({
                runnerId: selectedRunnerId,
                modelRepo: selectedModelRepo,
                modelFile: selectedModelFile,
                mmprojFile,
            });
        }
    }, [
        mmprojFiles,
        onLocalRunnerChange,
        selectedMmprojFile,
        selectedModelFile,
        selectedModelRepo,
        selectedRunnerId,
    ]);

    useEffect(() => {
        if (!selectedRunnerId) {
            return;
        }

        if (!runnerIds.includes(selectedRunnerId)) {
            setSelectedRunnerId("");
            onLocalRunnerChange({
                runnerId: "",
                modelRepo: selectedModelRepo,
                modelFile: selectedModelFile,
                mmprojFile: selectedMmprojFile,
            });
        }
    }, [
        onLocalRunnerChange,
        runnerIds,
        selectedMmprojFile,
        selectedModelFile,
        selectedModelRepo,
        selectedRunnerId,
    ]);

    const refreshRunnerState = async () => {
        setRunnerLoading(true);
        clearError();
        try {
            const [runnerResult, statusResult] = await Promise.all([
                hyaenidae.bridge.request("model:get-runners"),
                hyaenidae.bridge.request("model:get-runner-status"),
            ]);
            const runnerOptions = statusResult.options as StartRunnerOptions | null;

            setRunnerIds(Array.isArray(runnerResult.runners) ? runnerResult.runners : []);
            setIsRunnerRunning(Boolean(runnerOptions));

            if (runnerOptions) {
                setSelectedRunnerId(runnerOptions.runner);
                setSelectedModelRepo(runnerOptions.model);
                setSelectedModelFile(runnerOptions.modelFile);
                setSelectedMmprojFile(runnerOptions.mmprojFile ?? "");
                onLocalRunnerChange({
                    runnerId: runnerOptions.runner,
                    modelRepo: runnerOptions.model,
                    modelFile: runnerOptions.modelFile,
                    mmprojFile: runnerOptions.mmprojFile ?? "",
                });
            }
        } catch (currentError) {
            showError(
                currentError instanceof Error
                    ? currentError.message
                    : t("settings.localModels.failed"),
            );
        } finally {
            setRunnerLoading(false);
        }
    };

    const refreshInstalledModels = async () => {
        setInstalledLoading(true);
        clearError();
        try {
            const localModelsResult = await hyaenidae.bridge.request("model:get-local-models");

            setLocalModels(Array.isArray(localModelsResult.models) ? localModelsResult.models : []);
        } catch (currentError) {
            showError(
                currentError instanceof Error
                    ? currentError.message
                    : t("settings.localModels.failed"),
            );
        } finally {
            setInstalledLoading(false);
        }
    };

    const refreshAll = async () => {
        await refreshInstalledModels();
        await refreshRunnerState();
    };

    const deleteModel = async (model: string) => {
        setInstalledLoading(true);
        clearError();
        try {
            await hyaenidae.bridge.request("model:remove-local-model", { model });
            await refreshInstalledModels();
        } catch (currentError) {
            showError(
                currentError instanceof Error
                    ? currentError.message
                    : t("settings.localModels.failed"),
            );
        } finally {
            setInstalledLoading(false);
        }
    };

    const startRunner = async () => {
        if (!selectedRunnerId || !selectedModelRepo || !selectedModelFile) {
            return;
        }

        setRunnerLoading(true);
        clearError();
        try {
            const runnerConnection = await hyaenidae.bridge.request(
                "model:start-runner",
                {
                    model: selectedModelRepo,
                    modelFile: selectedModelFile,
                    mmprojFile: selectedMmprojFile || undefined,
                    runner: selectedRunnerId,
                },
                {
                    timeout: 60000,
                },
            );
            await syncLocalRunnerProvider({
                baseUrl: runnerConnection.baseUrl,
                apiKey: runnerConnection.apiKey,
            });
            await refreshRunnerState();
        } catch (currentError) {
            showError(
                currentError instanceof Error
                    ? currentError.message
                    : t("settings.localModels.failed"),
            );
        } finally {
            setRunnerLoading(false);
        }
    };

    const stopRunner = async () => {
        setRunnerLoading(true);
        clearError();
        try {
            await hyaenidae.bridge.request("model:stop-runner");
            await syncLocalRunnerProvider({
                baseUrl: "",
                apiKey: "",
            });
            await refreshRunnerState();
        } catch (currentError) {
            showError(
                currentError instanceof Error
                    ? currentError.message
                    : t("settings.localModels.failed"),
            );
        } finally {
            setRunnerLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <SettingsCard
                title={t("settings.localModels.runnerTitle")}
                description={t("settings.localModels.runnerDescription")}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] text-slate-600">
                        {isRunnerRunning
                            ? t("settings.localModels.runnerRunning")
                            : t("settings.localModels.runnerStopped")}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void refreshRunnerState()}
                            disabled={runnerLoading}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700"
                        >
                            <ArrowPathIcon className="h-3.5 w-3.5" />
                            <span>{t("settings.localModels.refresh")}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => void stopRunner()}
                            disabled={!isRunnerRunning || runnerLoading}
                            className="h-8 rounded-lg border border-red-200 bg-red-50 px-3 text-[13px] text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            {t("settings.localModels.stopRunner")}
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FieldLabel label={t("settings.localModels.runnerLabel")}>
                        <select
                            value={selectedRunnerId}
                            onChange={(event) => {
                                const runnerId = event.target.value;
                                setSelectedRunnerId(runnerId);
                                onLocalRunnerChange({
                                    runnerId,
                                    modelRepo: selectedModelRepo,
                                    modelFile: selectedModelFile,
                                    mmprojFile: selectedMmprojFile,
                                });
                            }}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
                        >
                            <option value="">{t("settings.localModels.selectRunner")}</option>
                            {runnerIds.map((runnerId) => (
                                <option key={runnerId} value={runnerId}>
                                    {runnerId}
                                </option>
                            ))}
                        </select>
                    </FieldLabel>

                    <FieldLabel label={t("settings.localModels.runnerModelLabel")}>
                        <select
                            value={selectedModelRepo}
                            onChange={(event) => {
                                const modelRepo = event.target.value;
                                setSelectedModelRepo(modelRepo);
                                setSelectedModelFile("");
                                setSelectedMmprojFile("");
                                onLocalRunnerChange({
                                    runnerId: selectedRunnerId,
                                    modelRepo,
                                    modelFile: "",
                                    mmprojFile: "",
                                });
                            }}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
                        >
                            <option value="">{t("settings.localModels.selectModel")}</option>
                            {localModels.map((model) => (
                                <option key={model} value={model}>
                                    {model}
                                </option>
                            ))}
                        </select>
                    </FieldLabel>

                    <FieldLabel label={t("settings.localModels.runnerModelFileLabel")}>
                        <select
                            value={selectedModelFile}
                            onChange={(event) => {
                                const modelFile = event.target.value;
                                setSelectedModelFile(modelFile);
                                onLocalRunnerChange({
                                    runnerId: selectedRunnerId,
                                    modelRepo: selectedModelRepo,
                                    modelFile,
                                    mmprojFile: selectedMmprojFile,
                                });
                            }}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
                        >
                            <option value="">{t("settings.localModels.selectModelFile")}</option>
                            {modelFiles.map((file) => (
                                <option key={file.path} value={file.path}>
                                    {file.path}
                                </option>
                            ))}
                        </select>
                    </FieldLabel>

                    <FieldLabel label={t("settings.localModels.runnerMmprojLabel")}>
                        <select
                            value={selectedMmprojFile}
                            onChange={(event) => {
                                const mmprojFile = event.target.value;
                                setSelectedMmprojFile(mmprojFile);
                                onLocalRunnerChange({
                                    runnerId: selectedRunnerId,
                                    modelRepo: selectedModelRepo,
                                    modelFile: selectedModelFile,
                                    mmprojFile,
                                });
                            }}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500"
                        >
                            <option value="">{t("settings.localModels.selectMmproj")}</option>
                            {mmprojFiles.map((file) => (
                                <option key={file.path} value={file.path}>
                                    {file.path}
                                </option>
                            ))}
                        </select>
                    </FieldLabel>
                </div>

                {!isRunnerRunning ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => void startRunner()}
                            disabled={
                                !selectedRunnerId ||
                                !selectedModelRepo ||
                                !selectedModelFile ||
                                runnerLoading
                            }
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            <PlayIcon className="h-3.5 w-3.5" />
                            <span>{t("settings.localModels.startRunner")}</span>
                        </button>
                    </div>
                ) : null}
            </SettingsCard>

            <SettingsCard
                title={t("settings.localModels.installedTitle")}
                description={t("settings.localModels.installedDescription")}
            >
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setIsSearchDialogOpen(true)}
                        disabled={installedLoading}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] text-white transition-colors hover:bg-blue-700"
                    >
                        <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                        <span>{t("settings.localModels.openSearch")}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => void refreshInstalledModels()}
                        disabled={installedLoading}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        {t("settings.localModels.refreshLocal")}
                    </button>
                </div>

                {installedLoading ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
                        {t("settings.loading")}
                    </div>
                ) : null}

                <div className="space-y-2">
                    {localModels.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-[13px] text-slate-500">
                            {t("settings.localModels.noInstalled")}
                        </div>
                    ) : null}

                    {localModels.map((model) => (
                        <div
                            key={model}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                            <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-slate-900">
                                    {model}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void deleteModel(model)}
                                disabled={installedLoading}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[13px] text-red-700"
                            >
                                <TrashIcon className="h-3.5 w-3.5" />
                                <span>{t("settings.localModels.delete")}</span>
                            </button>
                        </div>
                    ))}
                </div>
            </SettingsCard>

            <LocalModelSearchDialog
                open={isSearchDialogOpen}
                onClose={() => setIsSearchDialogOpen(false)}
                onDownloaded={() => void refreshInstalledModels()}
            />
        </div>
    );
}
