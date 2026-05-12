import { ChildProcessWithoutNullStreams, spawn as spawnSubProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export const DEFAULT_LOAD_TIMEOUT_MS = 15000;

export interface LoaderOptions {
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
    // Optional callback to receive real-time logs from llama-server output
    onLogs?: (logs: string) => void;
}

export class Loader extends EventEmitter {
    private subProcess: ChildProcessWithoutNullStreams;
    private port?: number;

    constructor(options: LoaderOptions) {
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

                    if (options.onLogs) {
                        options.onLogs(lineBuffer);
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
     * Creates a Loader instance and waits for it server to start listening.
     */
    static create(options: LoaderOptions) {
        return new Promise<Loader>((resolve, reject) => {
            const runner = new Loader(options);

            // Set up a timeout to reject the promise if the loader doesn't
            // emit 'listening' within the specified time
            const timer = setTimeout(() => {
                reject(new Error("LlmLauncher timed out while waiting for listening event"));
            }, options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS);

            runner.once("listening", () => {
                clearTimeout(timer);

                resolve(runner);
            });

            runner.once("error", (err) => {
                clearTimeout(timer);

                reject(err);
            });
        });
    }
}
