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

        set({ initialized: true });

        const downloads = await getDownloadItems();
        set({ downloads });

        onDownloadItemUpdated((event) => {
            set((state) => {
                const next = [...state.downloads];
                const index = next.findIndex((item) => item.id === event.id);

                if (index >= 0) {
                    next[index] = event;
                } else {
                    next.push(event);
                }

                return { downloads: next };
            });
        });
    },
}));
