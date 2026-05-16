import { DownloadItem, session } from "electron";
import type { Browser } from ".";
import { DownloadEvent, DownloadEventType } from "@hyaenidae/bridge";

export type Item = {
    id: number;
} & DownloadItem;

const downloadItemIntoEvent = (item: Item): DownloadEvent => ({
    id: item.id,
    type: item.getState() as DownloadEventType,
    url: item.getURL(),
    path: item.getSavePath(),
    filename: item.getFilename(),
    totalBytes: item.getTotalBytes(),
    receivedBytes: item.getReceivedBytes(),
    canResume: item.canResume(),
    isPaused: item.isPaused(),
    bytesPerSecond: item.getReceivedBytes(),
    progress: item.getPercentComplete(),
});

/**
 * Class responsible for managing downloads initiated from any browser tab,
 * tracking their progress, and communicating updates to the shell for display
 * in the downloads UI. It listens for download events from the Electron session
 * and maintains a list of active downloads, allowing the user to pause, resume,
 * or cancel them as needed.
 */
export class DownloadController {
    private countor = 0;
    private items: Item[] = [];

    constructor(private readonly browser: Browser) {
        /**
         * Handle download events from any tab's web contents session and
         * forward them to the shell
         */
        session.defaultSession.on("will-download", (_, it) => {
            const id = this.countor++;
            const item = Object.assign(it, { id }) as Item;

            // Add the new download item to the list and notify the shell
            {
                this.items.push(item);

                this.browser
                    .getShellBridge()
                    .send("shell:download-event", downloadItemIntoEvent(item));
            }

            for (const event of ["updated", "done"]) {
                item.on(event as any, () => {
                    this.browser
                        .getShellBridge()
                        .send(
                            "shell:download-event",
                            downloadItemIntoEvent(item),
                        );

                    /**
                     * Remove the item from the list when the download is
                     * completed, cancelled or interrupted
                     */
                    if (event == "done") {
                        const index = this.items.findIndex((i) => i.id === id);
                        if (index !== -1) {
                            this.items.splice(index, 1);
                        }
                    }
                });
            }
        });
    }

    /**
     * Returns the list of current download items with their details, to be sent
     * to the shell for display in the downloads UI.
     */
    getItems() {
        return this.items.map((item) => downloadItemIntoEvent(item));
    }

    /**
     * Cancels the download with the given ID, if it exists.
     */
    cancel(id: number) {
        this.items.find((i) => i.id === id)?.cancel();
    }

    /**
     * Resumes the download with the given ID if it's paused and can be resumed.
     */
    resume(id: number) {
        const item = this.items.find((i) => i.id === id);
        if (item && item.canResume()) {
            item.resume();
        }
    }

    /**
     * Pauses the download with the given ID if it's currently in progress.
     */
    pause(id: number) {
        const item = this.items.find((i) => i.id === id);
        if (item && !item.isPaused()) {
            item.pause();
        }
    }
}
