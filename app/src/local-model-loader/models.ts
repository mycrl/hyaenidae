import { listModels, downloadFile, listFiles } from "@huggingface/hub";
import { pipeline } from "node:stream/promises";
import { stat, mkdir, readdir, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { CONFIG } from "../config";

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

/**
 * Search Hugging Face for downloadable GGUF models and keep the payload shape
 * aligned with the UI-facing model list.
 */
export async function searchModels(query: string, limit: number = 20) {
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
export async function getModelFiles(modelName: string) {
    let files: ModelFileInfo[] = [];

    for await (const { type, size, path } of listFiles({
        repo: {
            type: "model",
            name: modelName,
        },
    })) {
        if (type === "file" && path.endsWith(".gguf")) {
            if (path.startsWith("mmproj-")) {
                files.push({ type: "mmproj", size, path });
            } else {
                files.push({ type: "model", size, path });
            }
        }
    }

    return files;
}

/**
 * Download the selected model artifact, and optionally its mmproj companion,
 * into the local resources model cache.
 */
export async function downloadModel({
    name,
    modelPath,
    mmprojPath,
}: {
    name: string;
    modelPath: string;
    mmprojPath?: string;
}) {
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

    await Promise.all(
        [modelPath, ...(mmprojPath ? [mmprojPath] : [])].map(async (item) => {
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

            await pipeline(response.stream(), createWriteStream(path.join(localModelDir, item)));
        }),
    );
}

/**
 * Enumerate locally cached models using the on-disk owner/repo directory
 * layout.
 */
export async function getLocalModels(): Promise<string[]> {
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
 * Remove the cached directory for a single model repo.
 */
export async function removeLocalModel(name: string) {
    const [username, model] = name.split("/") as [string, string];
    if (!username || !model) {
        throw new Error(`Invalid model name: ${name}`);
    }

    await rm(path.join(CONFIG.resourcesDir, `./models/${username}/${model}`), {
        recursive: true,
        force: true,
    });
}
