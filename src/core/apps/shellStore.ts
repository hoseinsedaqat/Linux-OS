import { create } from 'zustand';

export type ShellOverlay = 'appmenu' | 'quick' | 'notifications' | 'calendar' | 'power' | 'overview' | 'shortcuts' | 'tour' | 'whatsnew' | null;

interface ShellState {
  overlay: ShellOverlay;
  showDesktop: boolean;
  /** The Ctrl+K command palette is a separate layer from the panels. */
  paletteOpen: boolean;
  setPalette: (value: boolean) => void;
  togglePalette: () => void;
  openOverlay: (overlay: Exclude<ShellOverlay, null>) => void;
  closeOverlays: () => void;
  toggleOverlay: (overlay: Exclude<ShellOverlay, null>) => void;
  setShowDesktop: (value: boolean) => void;
}

export const useShell = create<ShellState>((set, get) => ({
  overlay: null,
  showDesktop: false,
  paletteOpen: false,
  setPalette: (value) => set({ paletteOpen: value }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
  openOverlay: (overlay) => set({ overlay, paletteOpen: false }),
  closeOverlays: () => set({ overlay: null }),
  toggleOverlay: (overlay) =>
    set({ overlay: get().overlay === overlay ? null : overlay, paletteOpen: false }),
  setShowDesktop: (value) => set({ showDesktop: value }),
}));
