import { LlmFactory } from "./llm";
import { createLocalProvider } from "./llm/provider/local";

LlmFactory.create({
    createProviderOptions: {
        apiKey: "test-api-key",
        binaryDir:
            "D:/Projects/hyaenidae/.data/assets/backends/llama-b9016-bin-win-cuda-13.1-x64",
        model: {
            name: "gemma-4-E4B-it",
            path: "D:/Projects/hyaenidae/.data/assets/modules/gemma-4-E4B-it-GGUF/gemma-4-E4B-it-Q4_K_M.gguf",
        },
    },
    createProvider: createLocalProvider,
})
    .then((llm) => {
        console.log("LLM launcher created successfully");
    })
    .catch((err) => {
        console.error("Failed to create LLM launcher:", err);
    });

setTimeout(() => {
    console.log("Exiting main process...");
    process.exit(0);
}, 1000 * 60);
