import type { ModelFileInfo, ModelInfo } from "@hyaenidae/bridge";
import { create } from "zustand";

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
    code: (typeof LOCAL_MODEL_SEARCH_ERROR_CODE)[keyof typeof LOCAL_MODEL_SEARCH_ERROR_CODE] | null;
    message: string | null;
}

export type LocalModelSearchErrorCode = NonNullable<LocalModelSearchErrorState["code"]>;

interface LocalModelSearchStoreState {
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

const getDownloadKey = (modelName: string, filePath: string) => `${modelName}:${filePath}`;

export const useLocalModelSearchStore = create<LocalModelSearchStoreState>((set, get) => ({
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

        hyaenidae.bridge.on("model:download-progress", ({ name, path, progress }) => {
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
                set((current) => ({ completedVersion: current.completedVersion + 1 }));

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

        hyaenidae.bridge.on("model:download-fail", ({ name, path, error }) => {
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
            const result = await hyaenidae.bridge.request("model:search", {
                query: trimmed,
                limit: 10,
            });
            const models = Array.isArray(result.models) ? result.models : [];
            const enriched = await Promise.all(
                models.map(async (model: ModelInfo) => {
                    const filesResult = await hyaenidae.bridge.request("model:get-files", {
                        model: model.name,
                    });
                    const files = Array.isArray(filesResult.files) ? filesResult.files : [];
                    return { ...model, files } satisfies LocalModelSearchResult;
                }),
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

        hyaenidae.bridge.send("model:download", {
            name: model.name,
            files: [file],
        });
    },
}));
