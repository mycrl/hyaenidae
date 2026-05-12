import { readdir } from "node:fs/promises";
import path from "node:path";
import { CONFIG } from "../config";
import { Loader } from "./loader";
import { LocalModelsManager } from "./models";

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
    private loader: Loader | null = null;

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
    get isRuning() {
        return this.loader !== null;
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
    async start(model: string, runner: string) {
        const { modelPath, mmprojPath } = await LocalModelsManager.getLocalModelPaths(model);

        this.loader = await Loader.create({
            apiKey: CONFIG.defaultLocalApiKey,
            binaryDir: path.join(CONFIG.resourcesDir, `./runners/${runner}`),
            model: {
                path: modelPath,
                mmproj: mmprojPath,
            } as any,
        });

        console.info(
            `Started loader for model ${model} using runner ${runner}, listening at ${this.loader.baseUrl}`,
        );

        for (const event of ["error", "exit"] as const) {
            this.loader.on(event, (param: any) => {
                console.error(`Loader ${event} event:`, param);

                this.loader = null;
            });
        }

        return {
            baseUrl: this.loader.baseUrl,
            apiKey: CONFIG.defaultLocalApiKey,
        };
    }

    /**
     * Stop the currently running Loader (if any) and clear the internal
     * reference.
     */
    async stop() {
        if (this.loader) {
            await this.loader.shutdown();

            this.loader = null;

            console.info(`Stopped loader and cleared runner state`);
        }
    }
}
