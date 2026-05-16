import { WebContents } from "electron";

export class WebContentsDebugger {
    constructor(private readonly webContents: WebContents) {}

    async sendCommand(method: string, commandParams?: Record<string, unknown>) {
        const shouldDetach = !this.webContents.debugger.isAttached();

        if (shouldDetach) {
            this.webContents.debugger.attach("1.3");
        }

        try {
            return await this.webContents.debugger.sendCommand(method, commandParams);
        } finally {
            if (shouldDetach && this.webContents.debugger.isAttached()) {
                this.webContents.debugger.detach();
            }
        }
    }
}
