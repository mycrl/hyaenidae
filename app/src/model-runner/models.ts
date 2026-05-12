import { listModels, downloadFile, listFiles } from "@huggingface/hub";
import { pipeline } from "node:stream/promises";
import { stat, mkdir, readdir, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { CONFIG } from "../config";
import { Transform } from "node:stream";

/**
 * Model metadata returned from Hugging Face for the search result list.
 */
export interface ModelInfo {
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
export interface ModelFileInfo {
    type: "model" | "mmproj";
    size: number;
    path: string;
}

const isGgufFile = (filePath: string) => filePath.toLowerCase().endsWith(".gguf");

const isMmprojFile = (filePath: string) => path.basename(filePath).toLowerCase().includes("mmproj");

const classifyModelFile = (filePath: string): ModelFileInfo["type"] =>
    isMmprojFile(filePath) ? "mmproj" : "model";

export class LocalModelsManager {
    /**
     * Search Hugging Face for downloadable GGUF models and keep the payload shape
     * aligned with the UI-facing model list.
     */
    static async searchModels(query: string, limit: number = 20) {
        let models: ModelInfo[] = [];

        for await (const model of listModels({
            search: { query, tags: ["gguf"] },
            additionalFields: ["tags", "author"],
            sort: "downloads",
            limit,
        })) {
            models.push(model as unknown as ModelInfo);
        }

        return models;
    }

    /**
     * Inspect a model repository and collect GGUF files, splitting the main model
     * file from the optional mmproj companion file by name.
     */
    static async getModelFiles(name: string) {
        let files: ModelFileInfo[] = [];

        for await (const { type, size, path } of listFiles({
            repo: {
                type: "model",
                name,
            },
        })) {
            if (type === "file" && isGgufFile(path)) {
                files.push({ type: classifyModelFile(path), size, path });
            }
        }

        return files;
    }

    /**
     * Enumerate downloaded GGUF files for a cached repository.
     */
    static async getLocalModelFiles(name: string): Promise<ModelFileInfo[]> {
        const localModelDir = path.join(CONFIG.resourcesDir, `./models/${name}`);
        const files = await readdir(localModelDir);

        return Promise.all(
            files
                .filter((file) => isGgufFile(file))
                .sort((left, right) => left.localeCompare(right))
                .map(async (file) => {
                    const filePath = path.join(localModelDir, file);
                    const fileStat = await stat(filePath);

                    return {
                        type: classifyModelFile(file),
                        size: fileStat.size,
                        path: file,
                    } satisfies ModelFileInfo;
                }),
        );
    }

    /**
     * Download the selected model artifact, and optionally its mmproj companion,
     * into the local resources model cache.
     */
    static async downloadModel(
        { name, files }: { name: string; files: ModelFileInfo[] },
        onProgress?: (progress: number) => void,
    ) {
        const [username, model] = name.split("/") as [string, string];
        if (!username || !model) {
            throw new Error(`Invalid model name: ${name}`);
        }

        const localModelDir = path.join(CONFIG.resourcesDir, `./models/${username}/${model}`);

        if (
            !(await stat(localModelDir)
                .then(() => true)
                .catch(() => false))
        ) {
            await mkdir(localModelDir, { recursive: true });
        }

        let currentSize = 0;
        const countSize = files.reduce((acc, file) => acc + file.size, 0);

        await Promise.all(
            files.map(async ({ path: item }) => {
                const response = await downloadFile({
                    repo: {
                        type: "model",
                        name,
                    },
                    path: item,
                });

                if (!response) {
                    throw new Error(`File ${item} not found in model ${name}`);
                }

                const targetPath = path.join(localModelDir, item);

                await mkdir(path.dirname(targetPath), { recursive: true });

                await pipeline(
                    response.stream(),
                    new Transform({
                        transform(chunk, _, callback) {
                            if (onProgress && countSize > 0) {
                                currentSize += chunk.length;
                                onProgress(currentSize / countSize);
                            }

                            callback(null, chunk);
                        },
                    }),
                    createWriteStream(targetPath),
                );
            }),
        );
    }

    /**
     * Enumerate locally cached models using the on-disk owner/repo directory
     * layout.
     */
    static async getLocalModels(): Promise<string[]> {
        let models: string[] = [];

        const localModelsDir = path.join(CONFIG.resourcesDir, `./models`);

        for (const username of await readdir(localModelsDir)) {
            for (const model of await readdir(path.join(localModelsDir, username))) {
                models.push(`${username}/${model}`);
            }
        }

        return models;
    }

    /**
     * Given a locally cached model name, return the file paths for the model
     * and its optional mmproj file. These can be used directly as loader inputs
     * without redownloading from Hugging Face.
     */
    static async getLocalModelPaths(name: string, modelFile?: string, mmprojFile?: string) {
        const localModelDir = path.join(CONFIG.resourcesDir, `./models/${name}`);

        const files = await this.getLocalModelFiles(name);
        const modelFiles = files.filter((file) => file.type === "model");
        const mmprojFiles = files.filter((file) => file.type === "mmproj");
        const selectedModelFile =
            modelFile && modelFiles.some((file) => file.path === modelFile)
                ? modelFile
                : modelFiles[0]?.path;

        if (!selectedModelFile) {
            throw new Error(`Model files not found for ${name}`);
        }

        const selectedMmprojFile =
            mmprojFile && mmprojFiles.some((file) => file.path === mmprojFile)
                ? mmprojFile
                : mmprojFiles.length === 1
                  ? mmprojFiles[0]!.path
                  : undefined;

        return {
            modelPath: path.join(localModelDir, selectedModelFile),
            mmprojPath: selectedMmprojFile
                ? path.join(localModelDir, selectedMmprojFile)
                : undefined,
        };
    }

    /**
     * Remove the cached directory for a single model repo.
     */
    static async removeLocalModel(name: string) {
        const [username, model] = name.split("/") as [string, string];
        if (!username || !model) {
            throw new Error(`Invalid model name: ${name}`);
        }

        await rm(path.join(CONFIG.resourcesDir, `./models/${username}/${model}`), {
            recursive: true,
            force: true,
        });
    }
}
