import type { ModelFileInfo, ModelInfo } from "@hyaenidae/bridge";
import { create } from "zustand";
import {
    downloadModelFile,
    getModelFiles,
    onModelDownloadFail,
    onModelDownloadProgress,
    searchModels,
} from "./model";

export type LocalModelSearchResult = ModelInfo & {
    files: ModelFileInfo[];
};

interface DownloadState {
    progress: number;
    error?: string;
}

export const LOCAL_MODEL_SEARCH_ERROR_CODE = {
    SEARCH_FAILED: "search_failed",
} as const;

export interface LocalModelSearchErrorState {
    code:
        | (typeof LOCAL_MODEL_SEARCH_ERROR_CODE)[keyof typeof LOCAL_MODEL_SEARCH_ERROR_CODE]
        | null;
    message: string | null;
}

export type LocalModelSearchErrorCode = NonNullable<
    LocalModelSearchErrorState["code"]
>;

interface LocalModelSearchState {
    initialized: boolean;
    query: string;
    searchLoading: boolean;
    results: LocalModelSearchResult[];
    error: LocalModelSearchErrorState | null;
    downloadStates: Record<string, DownloadState>;
    completedVersion: number;
    initializeRpc: () => void;
    setQuery: (query: string) => void;
    search: () => Promise<void>;
    downloadModel: (model: LocalModelSearchResult, file: ModelFileInfo) => void;
}

const completedDownloads = new Set<string>();

const getDownloadKey = (modelName: string, filePath: string) =>
    `${modelName}:${filePath}`;

export const useLocalModelSearchStore = create<LocalModelSearchState>(
    (set, get) => ({
        initialized: false,
        query: "",
        searchLoading: false,
        results: [],
        error: null,
        downloadStates: {},
        completedVersion: 0,
        initializeRpc: () => {
            if (get().initialized) {
                return;
            }

            onModelDownloadProgress(({ name, path, progress }) => {
                const key = getDownloadKey(name, path);

                set((current) => ({
                    downloadStates: {
                        ...current.downloadStates,
                        [key]: {
                            progress,
                            error: undefined,
                        },
                    },
                }));

                if (progress >= 1 && !completedDownloads.has(key)) {
                    completedDownloads.add(key);
                    set((current) => ({
                        completedVersion: current.completedVersion + 1,
                    }));

                    window.setTimeout(() => {
                        completedDownloads.delete(key);
                        set((current) => {
                            const next = { ...current.downloadStates };
                            delete next[key];

                            return { downloadStates: next };
                        });
                    }, 600);
                }
            });

            onModelDownloadFail(({ name, path, error }) => {
                const key = getDownloadKey(name, path);
                completedDownloads.delete(key);

                set((current) => ({
                    downloadStates: {
                        ...current.downloadStates,
                        [key]: {
                            progress: 0,
                            error,
                        },
                    },
                }));
            });

            set({ initialized: true });
        },
        setQuery: (query) => set({ query }),
        search: async () => {
            const trimmed = get().query.trim();
            if (!trimmed) {
                set({ results: [], error: null });
                return;
            }

            set({ searchLoading: true, error: null });
            try {
                const models = await searchModels(trimmed, 10);
                const enriched = await Promise.all(
                    models.map(async (model) => ({
                        ...model,
                        files: await getModelFiles(model.name),
                    })),
                );

                set({ results: enriched, searchLoading: false, error: null });
            } catch (error) {
                set({
                    searchLoading: false,
                    error:
                        error instanceof Error
                            ? {
                                  code: null,
                                  message: error.message,
                              }
                            : {
                                  code: LOCAL_MODEL_SEARCH_ERROR_CODE.SEARCH_FAILED,
                                  message: null,
                              },
                });
            }
        },
        downloadModel: (model, file) => {
            const key = getDownloadKey(model.name, file.path);
            completedDownloads.delete(key);

            set((current) => ({
                downloadStates: {
                    ...current.downloadStates,
                    [key]: {
                        progress: 0,
                    },
                },
            }));

            downloadModelFile(model.name, file);
        },
    }),
);
