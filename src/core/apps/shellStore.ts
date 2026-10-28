import { create } from 'zustand';

export type ShellOverlay = 'appmenu' | 'quick' | 'notifications' | 'calendar' | 'power' | null;

interface ShellState {
  overlay: ShellOverlay;
  showDesktop: boolean;
  openOverlay: (overlay: Exclude<ShellOverlay, null>) => void;
  closeOverlays: () => void;
  toggleOverlay: (overlay: Exclude<ShellOverlay, null>) => void;
  setShowDesktop: (value: boolean) => void;
}

export const useShell = create<ShellState>((set, get) => ({
  overlay: null,
  showDesktop: false,
  openOverlay: (overlay) => set({ overlay }),
  closeOverlays: () => set({ overlay: null }),
  toggleOverlay: (overlay) => set({ overlay: get().overlay === overlay ? null : overlay }),
  setShowDesktop: (value) => set({ showDesktop: value }),
}));
