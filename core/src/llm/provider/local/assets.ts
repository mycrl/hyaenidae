import { Octokit } from "@octokit/rest";
import { readFile, writeFile } from "node:fs/promises";

export async function getLastRelease() {
    const lastReleaseResult = await new Octokit().rest.repos.getLatestRelease({
        owner: "ggml-org",
        repo: "llama.cpp",
    });

    if (lastReleaseResult.status !== 200) {
        throw new Error(
            `Failed to fetch latest release metadata: ${lastReleaseResult.status}`,
        );
    }

    return lastReleaseResult.data;
}

export interface Metadata {
    assets: {
        version: string;
        updated_at: string;
        name: string;
        tags: string[];
    }[];
}

export class MetadataManager {
    static METADATA_FILE = "metadata.json";

    static async read(binaryDir: string): Promise<Metadata> {
        try {
            return JSON.parse(
                await readFile(
                    `${binaryDir}/${MetadataManager.METADATA_FILE}`,
                    "utf-8",
                ),
            );
        } catch {
            return { assets: [] };
        }
    }

    static async write(metadata: Metadata, binaryDir: string) {
        await writeFile(
            `${binaryDir}/${MetadataManager.METADATA_FILE}`,
            JSON.stringify(metadata, null, 4),
            "utf-8",
        );
    }
}

export interface AssetsManagerOptions {
    cacheDir: string;
    binaryDir: string;
}

export class AssetsManager {
    constructor(
        private readonly metadata: Metadata,
        private readonly options: AssetsManagerOptions,
    ) {}
}

export class AssetsManagerFactory {
    static async create(options: AssetsManagerOptions) {
        return new AssetsManager(
            await MetadataManager.read(options.binaryDir),
            options,
        );
    }
}
