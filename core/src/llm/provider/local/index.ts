import { LlmProvider } from "../..";
import {
    ChildProcessWithoutNullStreams,
    spawn as spawnSubProcess,
} from "node:child_process";
import { EventEmitter } from "node:events";

export const DEFAULT_LAUNCH_TIMEOUT_MS = 15000;

/**
 * llm launcher options
 */
export interface LocalLlmProviderOptions {
    // API key for llama-server authentication
    apiKey: string;
    // Directory containing llama-server binary and metadata
    binaryDir: string;
    // Path to the LLM model file (e.g. .gguf)
    model: {
        name: string;
        path: string;
        mmproj?: string;
    };
    // Optional timeout for launcher to start and emit 'listening' event
    // (default: DEFAULT_LAUNCH_TIMEOUT_MS)
    launchTimeoutMs?: number;
}

/**
 * LocalLlmProvider is responsible for managing the lifecycle of a llama-server
 * subprocess.
 */
export class LocalLlmProvider extends EventEmitter implements LlmProvider {
    private subProcess: ChildProcessWithoutNullStreams;
    private port?: number;

    constructor(private readonly options: LocalLlmProviderOptions) {
        super();

        this.subProcess = spawnSubProcess(
            "llama-server",
            [
                "-m",
                options.model.path,
                ...(options.model.mmproj
                    ? ["--mmproj", options.model.mmproj]
                    : []),
                "--host",
                "127.0.0.1",
                "--port",
                "0",
                "--no-webui",
                "--api-key",
                options.apiKey,
            ],
            {
                cwd: options.binaryDir,
                env: {
                    ...process.env,
                    PATH: `${options.binaryDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`,
                },
            },
        );

        this.subProcess.on("error", (err) => {
            this.emit("error", err);
        });

        this.subProcess.on("exit", (code, signal) => {
            this.emit("exit", { code, signal });
        });

        let lineBuffer = "";
        this.subProcess.stderr.on("data", (data) => {
            for (const char of data.toString()) {
                if (char === "\n") {
                    // Check if the line contains the "server is listening"
                    // message
                    if (
                        lineBuffer.includes(
                            "main: server is listening on http://127.0.0.1:",
                        )
                    ) {
                        this.port = Number(
                            lineBuffer.trim().split("127.0.0.1:")[1]!,
                        );

                        this.emit("listening");
                    }

                    lineBuffer = "";
                } else {
                    lineBuffer += char;
                }
            }
        });
    }

    getModelName(): string {
        return this.options.model.name;
    }

    getBaseUrl() {
        return `http://127.0.0.1:${this.port}/v1`;
    }

    /**
     * Shuts down the llama-server subprocess.
     */
    async shutdown() {
        this.subProcess.kill();
    }
}

/**
 * Creates a LocalLlmProvider instance and waits for it server to start listening.
 */
export async function createLocalProvider(options: LocalLlmProviderOptions) {
    return new Promise<LocalLlmProvider>((resolve, reject) => {
        const launcher = new LocalLlmProvider(options);

        // Set up a timeout to reject the promise if the launcher doesn't
        // emit 'listening' within the specified time
        const timer = setTimeout(() => {
            reject(
                new Error(
                    "LlmLauncher timed out while waiting for listening event",
                ),
            );
        }, options.launchTimeoutMs ?? DEFAULT_LAUNCH_TIMEOUT_MS);

        launcher.once("listening", () => {
            clearTimeout(timer);

            resolve(launcher);
        });

        launcher.once("error", (err) => {
            clearTimeout(timer);

            reject(err);
        });
    });
}
