import { create } from "zustand";

interface GlobalErrorState {
    message: string | null;
    showError: (message: string) => void;
    clearError: () => void;
}

export const useGlobalErrorStore = create<GlobalErrorState>((set) => ({
    message: null,
    showError: (message) => set({ message }),
    clearError: () => set({ message: null }),
}));
