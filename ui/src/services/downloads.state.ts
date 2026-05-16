import { create } from "zustand";
import type { DownloadEvent } from "@hyaenidae/bridge";
import { getDownloadItems, onDownloadItemUpdated } from "./downloads";

interface DownloadsState {
    downloads: DownloadEvent[];
    initialized: boolean;
    initializeRpc: () => Promise<void>;
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
    downloads: [],
    initialized: false,
    initializeRpc: async () => {
        if (get().initialized) {
            return;
        }

        set({
            initialized: true,
            downloads: await getDownloadItems(),
        });

        onDownloadItemUpdated((event) => {
            set((state) => {
                const downloads = [...state.downloads];
                const index = downloads.findIndex(
                    (item) => item.id === event.id,
                );

                if (index >= 0) {
                    downloads[index] = event;
                } else {
                    downloads.push(event);
                }

                return { downloads };
            });
        });
    },
}));
