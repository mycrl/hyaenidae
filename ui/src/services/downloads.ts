import type { DownloadEvent } from "@hyaenidae/bridge";

export const getDownloadItems = async () => {
    return await hyaenidae.bridge.request("download:get-items");
};

export const onDownloadItemUpdated = (
    handler: (event: DownloadEvent) => Promise<void> | void,
) => {
    hyaenidae.bridge.on("download:item-updated", async (event) => {
        await handler(event);
    });
};

export const pauseDownload = async (id: number) => {
    await hyaenidae.bridge.request("download:pause", id);
};

export const resumeDownload = async (id: number) => {
    await hyaenidae.bridge.request("download:resume", id);
};

export const cancelDownload = async (id: number) => {
    await hyaenidae.bridge.request("download:cancel", id);
};

export const onDownloadProgressingChanged = (
    handler: (progressing: boolean) => Promise<void> | void,
) => {
    hyaenidae.bridge.on("download:progressing-changed", async (progressing) => {
        await handler(progressing);
    });
};
