import "../../../styles/pages.settings.local-models-section.css";

import {
    ArrowPathIcon,
    MagnifyingGlassIcon,
    PlayIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import type { StartRunnerOptions, AppSettings, LocalRunnerSettings } from "@hyaenidae/bridge";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncButton from "../../../components/async-button";
import {
    getLocalModelFiles,
    getLocalModels,
    getRunnerStatus,
    getRunners,
    removeLocalModel,
    startRunner,
    stopRunner,
} from "../../../services/model";
import { useSettingsStore } from "../../../services/settings.state";
import Card from "../components/card";
import FieldLabel from "../components/field-label";
import SearchDialog from "./search-dialog";

export default function LocalModelSection({
    settings,
    onSettingsChange,
    onError,
}: {
    settings: AppSettings;
    onSettingsChange: (settings: Partial<AppSettings>) => void;
    onError: (error: unknown, fallbackMessage: string) => void;
}) {
    const { t } = useTranslation();
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [localModels, setLocalModels] = useState<string[]>([]);

    const reloadLocalModels = async () => {
        try {
            setLocalModels(await getLocalModels());
        } catch (error) {
            onError(error, t("settings.localModels.failed"));
        }
    };

    const removeLocalModelAndReload = async (model: string) => {
        try {
            await removeLocalModel(model);
            await reloadLocalModels();
        } catch (error) {
            onError(error, t("settings.localModels.deleteFailed"));
        }
    };

    useEffect(() => {
        void reloadLocalModels();
    }, []);

    return (
        <div className="local-models-section-root">
            <RunnerSection
                models={localModels}
                settings={settings}
                onSettingsChange={onSettingsChange}
                onError={onError}
            />
            <InstalledModelsSection
                models={localModels}
                reloadLocalModels={reloadLocalModels}
                onOpenSearch={() => setIsSearchDialogOpen(true)}
                removeModel={removeLocalModelAndReload}
            />
            <SearchDialog
                open={isSearchDialogOpen}
                onClose={() => setIsSearchDialogOpen(false)}
                onDownloaded={() => reloadLocalModels()}
            />
        </div>
    );
}

function RunnerSection({
    models,
    settings,
    onSettingsChange,
    onError,
}: {
    models: string[];
    settings: AppSettings;
    onSettingsChange: (settings: Partial<AppSettings>) => void;
    onError: (error: unknown, fallbackMessage: string) => void;
}) {
    const { t } = useTranslation();
    const saveSettings = useSettingsStore((state) => state.save);
    const [isRunnerRunning, setIsRunnerRunning] = useState(false);
    const [runners, setRunners] = useState<string[]>([]);
    const [modelFiles, setModelFiles] = useState<string[]>([]);
    const [mmprojFiles, setMmprojFiles] = useState<string[]>([]);

    useEffect(() => {
        const loadRunnerState = async () => {
            try {
                const [running, availableRunners] = await Promise.all([
                    getRunnerStatus(),
                    getRunners(),
                ]);

                setIsRunnerRunning(running);
                setRunners(availableRunners);
            } catch (error) {
                onError(error, t("settings.localModels.runnerLoadFailed"));
            }
        };

        void loadRunnerState();
    }, [onError, settings.localRunner, settings.providers, t]);

    useEffect(() => {
        const loadFiles = async () => {
            if (!settings.localRunner.model) {
                setModelFiles([]);
                setMmprojFiles([]);
                return;
            }

            const modelName = settings.localRunner.model;

            try {
                const files = (await getLocalModelFiles(modelName)).map((item) => item.path);

                setModelFiles(files.filter((item) => !item.startsWith("mmproj")));
                setMmprojFiles(files.filter((item) => item.startsWith("mmproj")));
            } catch (error) {
                onError(error, t("settings.localModels.modelFilesLoadFailed"));
            }
        };

        void loadFiles();
    }, [onError, settings.localRunner.model, t]);

    const updateLocalRunner = (key: keyof LocalRunnerSettings, value: string) => {
        onSettingsChange({
            localRunner: {
                ...settings.localRunner,
                [key]: value === "" ? null : value,
            },
        });
    };

    const runnerFields: Array<{
        key: keyof LocalRunnerSettings;
        label: string;
        defaultValue: string;
        values: string[];
    }> = [
        {
            label: t("settings.localModels.runnerLabel"),
            defaultValue: t("settings.localModels.selectRunner"),
            key: "runner",
            values: runners,
        },
        {
            label: t("settings.localModels.runnerModelLabel"),
            defaultValue: t("settings.localModels.selectModel"),
            key: "model",
            values: models,
        },
        {
            label: t("settings.localModels.runnerModelFileLabel"),
            defaultValue: t("settings.localModels.selectModelFile"),
            key: "modelFile",
            values: modelFiles,
        },
        {
            label: t("settings.localModels.runnerMmprojLabel"),
            defaultValue: t("settings.localModels.selectMmproj"),
            key: "mmprojFile",
            values: mmprojFiles,
        },
    ];

    const clearLocalRunnerSelection = () => {
        onSettingsChange({
            localRunner: {
                runner: null,
                model: null,
                modelFile: null,
                mmprojFile: null,
            },
        });
    };

    const startLocalRunner = async () => {
        try {
            const { baseUrl, apiKey } = await startRunner(
                settings.localRunner as StartRunnerOptions,
            );
            const providers = settings.providers.map((provider) =>
                provider.type === "local-runner" ? { ...provider, baseUrl, apiKey } : provider,
            );

            setIsRunnerRunning(true);
            onSettingsChange({ providers });
            await saveSettings({ providers });
        } catch (error) {
            onError(error, t("settings.localModels.startRunnerFailed"));
        }
    };

    const stopLocalRunner = async () => {
        try {
            await stopRunner();
            setIsRunnerRunning(false);
        } catch (error) {
            onError(error, t("settings.localModels.stopRunnerFailed"));
        }
    };

    return (
        <Card
            title={t("settings.localModels.runnerTitle")}
            description={t("settings.localModels.runnerDescription")}
        >
            <div className="local-models-runner-row">
                <div className="local-models-runner-status">
                    {isRunnerRunning
                        ? t("settings.localModels.runnerRunning")
                        : t("settings.localModels.runnerStopped")}
                </div>

                <div className="local-models-runner-actions">
                    <AsyncButton
                        onClick={clearLocalRunnerSelection}
                        icon={<ArrowPathIcon className="local-models-action-icon" />}
                        className="local-models-runner-refresh-button"
                    >
                        {t("settings.localModels.refresh")}
                    </AsyncButton>

                    <AsyncButton
                        onClick={stopLocalRunner}
                        disabled={!isRunnerRunning}
                        className="local-models-runner-stop-button"
                    >
                        {t("settings.localModels.stopRunner")}
                    </AsyncButton>
                </div>
            </div>

            <div className="local-models-runner-form">
                {runnerFields.map(({ key, label, values, defaultValue }) => (
                    <RunnerSelectField
                        key={key}
                        label={label}
                        value={settings.localRunner[key]}
                        values={values}
                        defaultValue={defaultValue}
                        onChange={(value) => updateLocalRunner(key, value)}
                    />
                ))}
            </div>

            {!isRunnerRunning ? (
                <div className="local-models-runner-submit">
                    <AsyncButton
                        onClick={startLocalRunner}
                        icon={<PlayIcon className="local-models-action-icon" />}
                        disabled={
                            !settings.localRunner.runner ||
                            !settings.localRunner.model ||
                            !settings.localRunner.modelFile ||
                            isRunnerRunning
                        }
                        className="local-models-runner-start-button"
                    >
                        {t("settings.localModels.startRunner")}
                    </AsyncButton>
                </div>
            ) : null}
        </Card>
    );
}

function RunnerSelectField({
    label,
    value,
    values,
    defaultValue,
    onChange,
}: {
    label: string;
    value: string | null;
    values: string[];
    defaultValue: string;
    onChange: (value: string) => void;
}) {
    return (
        <FieldLabel label={label}>
            <select
                className="local-models-select"
                value={value ?? ""}
                onChange={({ target: { value: nextValue } }) => onChange(nextValue)}
            >
                <option value="">{defaultValue}</option>
                {values.map((optionValue) => (
                    <option key={optionValue} value={optionValue}>
                        {optionValue}
                    </option>
                ))}
            </select>
        </FieldLabel>
    );
}

function InstalledModelsSection({
    models,
    reloadLocalModels,
    removeModel,
    onOpenSearch,
}: {
    models: string[];
    reloadLocalModels: () => Promise<void>;
    removeModel: (model: string) => Promise<void>;
    onOpenSearch: () => void;
}) {
    const { t } = useTranslation();

    return (
        <Card
            title={t("settings.localModels.installedTitle")}
            description={t("settings.localModels.installedDescription")}
        >
            <div className="local-models-installed-toolbar">
                <button
                    type="button"
                    onClick={onOpenSearch}
                    className="local-models-open-search-button"
                >
                    <MagnifyingGlassIcon className="local-models-action-icon" />
                    <span>{t("settings.localModels.openSearch")}</span>
                </button>

                <AsyncButton onClick={reloadLocalModels} className="local-models-refresh-button">
                    {t("settings.localModels.refreshLocal")}
                </AsyncButton>
            </div>

            <div className="local-models-installed-list">
                {models.length === 0 ? (
                    <div className="local-models-empty">
                        {t("settings.localModels.noInstalled")}
                    </div>
                ) : null}

                {models.map((model) => (
                    <div key={model} className="local-models-item">
                        <div className="local-models-item-body">
                            <div className="local-models-item-title">{model}</div>
                        </div>

                        <AsyncButton
                            onClick={() => removeModel(model)}
                            icon={<TrashIcon className="local-models-action-icon" />}
                            className="local-models-delete-button"
                        >
                            {t("settings.localModels.delete")}
                        </AsyncButton>
                    </div>
                ))}
            </div>
        </Card>
    );
}
