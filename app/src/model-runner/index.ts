import { readdir } from "node:fs/promises";
import path from "node:path";
import { CONFIG } from "../config";
import { Loader } from "./loader";
import { LocalModelsManager } from "./models";

export interface StartRunnerOptions {
    model: string;
    modelFile: string;
    mmprojFile?: string;
    runner: string;
}

/**
 * Manage local model runners (runners) and control their lifecycle.
 *
 * Responsible for listing available runners, starting a runner for a
 * specified model, and stopping the running loader instance.
 */
export class ModelRunnerCounter {
    /**
     * The currently active Loader instance. Null means no model is running.
     */
    private runner: { loader: Loader; options: StartRunnerOptions } | null = null;

    /**
     * @param runnersDir Root path where runner binary directories live. Defaults
     * to `resources/runners`.
     */
    constructor(private readonly runnersDir = path.join(CONFIG.resourcesDir, "./runners")) {}

    /**
     * List available runner directories.
     * @returns Promise<string[]> - list of runner directory names
     */
    getRunners() {
        return readdir(this.runnersDir);
    }

    /**
     * Whether a Loader instance is currently running.
     */
    get runnerOptions() {
        return this.runner?.options || null;
    }

    /**
     * Start a runner for the specified model:
     * - Resolve local model paths (including optional mmproj)
     * - Create and start a Loader using the specified runner binary directory
     *
     * @param model Model identifier in `owner/repo` form
     * @param runner Runner name corresponding to a subdirectory in resources
     * @returns Connection info object containing `baseUrl` and `apiKey`
     */
    async start(options: StartRunnerOptions) {
        const { modelPath, mmprojPath } = await LocalModelsManager.getLocalModelPaths(
            options.model,
            options.modelFile,
            options.mmprojFile,
        );

        const loader = await Loader.create({
            apiKey: CONFIG.defaultLocalApiKey,
            binaryDir: path.join(CONFIG.resourcesDir, `./runners/${options.runner}`),
            model: {
                path: modelPath,
                mmproj: mmprojPath,
            } as any,
        });

        console.info(
            `Started loader for model ${options.model} using runner ${options.runner}, listening at ${loader.baseUrl}`,
        );

        this.runner = { loader, options };

        for (const event of ["error", "exit"] as const) {
            loader.on(event, (param: any) => {
                console.error(`Loader ${event} event:`, param);

                this.runner = null;
            });
        }

        return {
            baseUrl: loader.baseUrl,
            apiKey: CONFIG.defaultLocalApiKey,
        };
    }

    /**
     * Stop the currently running Loader (if any) and clear the internal
     * reference.
     */
    async stop() {
        if (this.runner) {
            await this.runner.loader.shutdown();

            this.runner = null;

            console.info(`Stopped loader and cleared runner state`);
        }
    }
}
