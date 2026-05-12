import { ChildProcessWithoutNullStreams, spawn as spawnSubProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export const DEFAULT_LOAD_TIMEOUT_MS = 15000;

export interface LocalLlmLoaderOptions {
    // API key for llama-server authentication
    apiKey: string;
    // Directory containing llama-server binary and metadata
    binaryDir: string;
    // Path to the LLM model file (e.g. .gguf)
    model: {
        path: string;
        mmproj?: string;
    };
    // Optional timeout for loader to start and emit 'listening' event
    // (default: DEFAULT_LOAD_TIMEOUT_MS)
    loadTimeoutMs?: number;
}

export interface LocalLlmLoaderFromResourcesOptions {
    apiKey: string;
    resourceDir?: string;
    model: {
        path: string;
        mmproj?: string;
    };
    loadTimeoutMs?: number;
}

export class LocalLlmLoader extends EventEmitter {
    private subProcess: ChildProcessWithoutNullStreams;
    private port?: number;

    constructor(options: LocalLlmLoaderOptions) {
        super();

        this.subProcess = spawnSubProcess(
            "llama-server",
            [
                "-m",
                options.model.path,
                ...(options.model.mmproj ? ["--mmproj", options.model.mmproj] : []),
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
                    if (lineBuffer.includes("main: server is listening on http://127.0.0.1:")) {
                        this.port = Number(lineBuffer.trim().split("127.0.0.1:")[1]!);

                        this.emit("listening");
                    }

                    lineBuffer = "";
                } else {
                    lineBuffer += char;
                }
            }
        });
    }

    get baseUrl() {
        return `http://127.0.0.1:${this.port}/v1`;
    }

    /**
     * Shuts down the llama-server subprocess.
     */
    async shutdown() {
        this.subProcess.kill();
    }

    /**
     * Creates a LocalLlmLoader instance and waits for it server to start listening.
     */
    static create(options: LocalLlmLoaderOptions) {
        return new Promise<LocalLlmLoader>((resolve, reject) => {
            const loader = new LocalLlmLoader(options);

            // Set up a timeout to reject the promise if the loader doesn't
            // emit 'listening' within the specified time
            const timer = setTimeout(() => {
                reject(new Error("LlmLauncher timed out while waiting for listening event"));
            }, options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS);

            loader.once("listening", () => {
                clearTimeout(timer);

                resolve(loader);
            });

            loader.once("error", (err) => {
                clearTimeout(timer);

                reject(err);
            });
        });
    }
}
