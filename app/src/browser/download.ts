import { session } from "electron";

export class Downloader {
    constructor() {
        /**
         * Handle download events from any tab's web contents session and
         * forward them to the shell
         */
        session.defaultSession.on("will-download", (_, item) => {
            for (const event of ["updated", "done"]) {
                item.on(event as any, (_, type) => {
                    // this.shell.bridge.send("shell:download-event", {
                    //     type,
                    //     url: item.getURL(),
                    //     path: item.getSavePath(),
                    //     filename: item.getFilename(),
                    //     totalBytes: item.getTotalBytes(),
                    //     receivedBytes: item.getReceivedBytes(),
                    //     canResume: item.canResume(),
                    //     bytesPerSecond: item.getReceivedBytes(),
                    //     progress: item.getPercentComplete(),
                    // });
                });
            }
        });
    }
}
