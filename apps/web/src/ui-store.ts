import { create } from 'zustand';

// UI-only state: no song, playback position, rate, loop or server facts here.
export const useUiStore = create<{ showSnapshot: boolean; toggleSnapshot(): void }>((set) => ({
  showSnapshot: false,
  toggleSnapshot: () => set((state) => ({ showSnapshot: !state.showSnapshot })),
}));
