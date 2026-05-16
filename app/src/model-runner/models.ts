import { listModels, downloadFile, listFiles } from "@huggingface/hub";
import { stat, mkdir, readdir, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import path from "node:path";
import { CONFIG } from "../config";

/**
 * Model metadata returned from Hugging Face for the search result list.
 */
export interface Model {
    id: string;
    name: string;
    downloads: number;
    updatedAt: string;
    links: number;
    task?: string;
    author: string;
    tags: string[];
}

/**
 * A downloadable file inside a model repository, classified by its role.
 */
export interface File {
    type: "model" | "mmproj";
    size: number;
    path: string;
}

/**
 * Heuristic to identify GGUF files by extension, case-insensitive.
 */
const isGgufFile = (filePath: string) =>
    filePath.toLowerCase().endsWith(".gguf");

/**
 * Heuristic to identify mmproj files by name, case-insensitive, allowing
 * for flexible naming conventions but ensuring the key substring is present.
 */
const isMmprojFile = (filePath: string) =>
    path.basename(filePath).toLowerCase().includes("mmproj");

/**
 * Classify a file as either the main model file or an optional mmproj companion
 * based on its name. This allows for flexible naming conventions while still
 * distinguishing the primary model artifact from additional metadata files.
 */
const classifyModelFile = (filePath: string): File["type"] =>
    isMmprojFile(filePath) ? "mmproj" : "model";

/**
 * Utility to collect all items from an async iterable into an array. This
 * is used to gather results from the Hugging Face Hub API, which may return
 * paginated async iterables for models and files.
 */
const collectAsyncIterator = async <T>(
    iter: AsyncIterable<T>,
): Promise<T[]> => {
    const results: T[] = [];

    for await (const item of iter) {
        results.push(item);
    }

    return results;
};

export namespace RemoteModelsManager {
    type DownloadProgress = {
        path: string;
        progress: number;
    };

    /**
     * Search Hugging Face for downloadable GGUF models and keep the payload shape
     * aligned with the UI-facing model list.
     */
    export const search = async (query: string, limit: number = 20) => {
        return (await collectAsyncIterator(
            listModels({
                search: { query, tags: ["gguf"] },
                additionalFields: ["tags", "author"],
                sort: "downloads",
                limit,
            }),
        )) as unknown as Model[];
    };

    /**
     * Inspect a model repository and collect GGUF files, splitting the main model
     * file from the optional mmproj companion file by name.
     */
    export const getFiles = async (name: string) => {
        return (await collectAsyncIterator(
            listFiles({
                repo: {
                    type: "model",
                    name,
                },
            }),
        ).then((items) =>
            items.filter(
                (item) => item.type === "file" && isGgufFile(item.path),
            ),
        )) as unknown as File[];
    };

    /**
     * Download the selected model artifact, and optionally its mmproj companion,
     * into the local resources model cache.
     */
    export const download = async (
        { name, files }: { name: string; files: File[] },
        onProgress?: (update: DownloadProgress) => void,
    ) => {
        const [username, model] = name.split("/") as [string, string];
        if (!username || !model) {
            throw new Error(`Invalid model name: ${name}`);
        }

        const modelDir = path.join(
            CONFIG.resourcesDir,
            `./models/${username}/${model}`,
        );

        // Ensure the local model directory exists before downloading files into
        // it. This prevents potential race conditions where multiple files are
        // being downloaded in parallel into the same directory.
        if (
            !(await stat(modelDir)
                .then(() => true)
                .catch(() => false))
        ) {
            await mkdir(modelDir, { recursive: true });
        }

        await Promise.all(
            files.map(async ({ path: item, size }) => {
                try {
                    const response = await downloadFile({
                        repo: {
                            type: "model",
                            name,
                        },
                        path: item,
                    });

                    if (!response) {
                        const error = new Error(
                            `File ${item} not found in model ${name}`,
                        ) as Error & {
                            path?: string;
                        };
                        error.path = item;
                        throw error;
                    }

                    let downloadedSize = 0;

                    await pipeline(
                        response.stream(),
                        // Track progress for the current file so the UI can key
                        // updates by the actual artifact path.
                        new Transform({
                            transform(chunk, _, callback) {
                                if (onProgress && size > 0) {
                                    downloadedSize += chunk.length;

                                    onProgress({
                                        path: item,
                                        progress: Math.min(
                                            downloadedSize / size,
                                            1,
                                        ),
                                    });
                                }

                                callback(null, chunk);
                            },
                        }),
                        createWriteStream(path.join(modelDir, item)),
                    );

                    onProgress?.({
                        path: item,
                        progress: 1,
                    });
                } catch (error) {
                    if (error instanceof Error) {
                        const fileError = error as Error & { path?: string };
                        fileError.path ??= item;
                        throw fileError;
                    }

                    const fileError = new Error(
                        "Failed to download model file.",
                    ) as Error & {
                        path?: string;
                    };
                    fileError.path = item;
                    throw fileError;
                }
            }),
        );
    };
}

export namespace LocalModelsManager {
    /**
     * Enumerate locally cached models using the on-disk owner/repo directory
     * layout.
     */
    export const list = async (): Promise<string[]> => {
        let models: string[] = [];

        const modelsDir = path.join(CONFIG.resourcesDir, `./models`);

        for (const username of await readdir(modelsDir)) {
            for (const model of await readdir(path.join(modelsDir, username))) {
                models.push(`${username}/${model}`);
            }
        }

        return models;
    };

    /**
     * Enumerate downloaded GGUF files for a cached repository.
     */
    export const getFiles = async (name: string): Promise<File[]> => {
        const modelDir = path.join(CONFIG.resourcesDir, `./models/${name}`);

        return (await readdir(modelDir))
            .filter(isGgufFile)
            .sort((left, right) => left.localeCompare(right))
            .map((path) => {
                return {
                    type: classifyModelFile(path),
                    path,
                    // The file size is not critical for local files since they
                    // are already downloaded, and obtaining it would require
                    // additional fs.stat calls. We can set it to 0 or omit it
                    // since the local file management logic does not rely on
                    // the size.
                    size: 0,
                } satisfies File;
            });
    };

    /**
     * Given a locally cached model name, return the file paths for the model
     * and its optional mmproj file. These can be used directly as loader inputs
     * without redownloading from Hugging Face.
     */
    export const resolvePaths = async (
        name: string,
        modelFile: string,
        mmprojFile?: string,
    ) => {
        const modelDir = path.join(CONFIG.resourcesDir, `./models/${name}`);

        return {
            modelPath: path.join(modelDir, modelFile),
            mmprojPath: mmprojFile
                ? path.join(modelDir, mmprojFile)
                : undefined,
        };
    };

    /**
     * Remove the cached directory for a single model repo.
     */
    export const remove = async (name: string) => {
        await rm(path.join(CONFIG.resourcesDir, `./models/${name}`), {
            recursive: true,
            force: true,
        });
    };
}
