import type {
    ModelFileInfo,
    ModelInfo,
    StartRunnerOptions,
} from "@hyaenidae/bridge";

export const onModelDownloadProgress = (
    handler: (payload: {
        name: string;
        path: string;
        progress: number;
    }) => void,
) => {
    hyaenidae.bridge.on("model:download-progress", handler);
};

export const onModelDownloadFail = (
    handler: (payload: { name: string; path: string; error: string }) => void,
) => {
    hyaenidae.bridge.on("model:download-failed", handler);
};

export const searchModels = async (
    query: string,
    limit = 10,
): Promise<ModelInfo[]> => {
    const models = await hyaenidae.bridge.request("model:search", {
        query,
        limit,
    });

    return Array.isArray(models) ? models : [];
};

export const getModelFiles = async (
    model: string,
): Promise<ModelFileInfo[]> => {
    const files = await hyaenidae.bridge.request("model:get-files", model);

    return Array.isArray(files) ? files : [];
};

export const downloadModelFile = (name: string, file: ModelFileInfo) => {
    hyaenidae.bridge.send("model:download", {
        name,
        files: [file],
    });
};

export const getLocalModels = async (): Promise<string[]> => {
    const models = await hyaenidae.bridge.request("model:get-local-models");

    return Array.isArray(models) ? models : [];
};

export const getLocalModelFiles = async (
    model: string,
): Promise<ModelFileInfo[]> => {
    const files = await hyaenidae.bridge.request(
        "model:get-local-model-files",
        model,
    );

    return Array.isArray(files) ? files : [];
};

export const removeLocalModel = async (model: string) => {
    await hyaenidae.bridge.request("model:remove-local-model", model);
};

export const getRunners = async (): Promise<string[]> => {
    const runners = await hyaenidae.bridge.request("model:get-runners");

    return Array.isArray(runners) ? runners : [];
};

export const getRunnerStatus = async (): Promise<boolean> => {
    return (await hyaenidae.bridge.request("model:get-runner-status")) === true;
};

export const startRunner = async (options: StartRunnerOptions) => {
    return await hyaenidae.bridge.request("model:start-runner", options, {
        timeout: 60000,
    });
};

export const stopRunner = async () => {
    await hyaenidae.bridge.request("model:stop-runner");
};
