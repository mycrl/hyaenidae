import { readdir } from "node:fs/promises";
import path from "node:path";
import { Loader } from "./loader";
import { LocalModelsManager } from "./models";
import { ProgramSettings } from "../settings";

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
export class ModelRunnerController {
    /**
     * The currently active Loader instance. Null means no model is running.
     */
    private runner: Loader | null = null;

    /**
     * @param runnersDir Root path where runner binary directories live. Defaults
     * to `resources/runners`.
     */
    constructor(
        private readonly runnersDir = path.join(
            ProgramSettings.resourcesDir,
            "./runners",
        ),
    ) {}

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
    get isRunning() {
        return this.runner !== null;
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
        const { modelPath, mmprojPath } = await LocalModelsManager.resolvePaths(
            options.model,
            options.modelFile,
            options.mmprojFile,
        );

        this.runner = await Loader.create({
            apiKey: ProgramSettings.defaultLocalApiKey,
            binaryDir: path.join(
                ProgramSettings.resourcesDir,
                `./runners/${options.runner}`,
            ),
            model: {
                path: modelPath,
                mmproj: mmprojPath,
            } as any,
        });

        console.info(
            `Started loader for model ${options.model} using runner ${options.runner}, listening at ${this.runner.baseUrl}`,
        );

        for (const event of ["error", "exit"] as const) {
            this.runner.on(event, (param: any) => {
                console.error(`Loader ${event} event:`, param);

                this.runner = null;
            });
        }

        return {
            baseUrl: this.runner.baseUrl,
            apiKey: ProgramSettings.defaultLocalApiKey,
        };
    }

    /**
     * Stop the currently running Loader (if any) and clear the internal
     * reference.
     */
    async stop() {
        if (this.runner) {
            await this.runner.shutdown();

            this.runner = null;

            console.info(`Stopped loader and cleared runner state`);
        }
    }
}
