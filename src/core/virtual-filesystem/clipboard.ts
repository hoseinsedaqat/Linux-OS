import { create } from 'zustand';

export type ClipboardMode = 'copy' | 'cut';

interface ClipboardState {
  ids: string[];
  mode: ClipboardMode;
  sourceParent: string | null;
  set: (ids: string[], mode: ClipboardMode, sourceParent: string | null) => void;
  clear: () => void;
}

/** Shared clipboard for the Files app (in-memory, never touches the OS clipboard). */
export const useFileClipboard = create<ClipboardState>((set) => ({
  ids: [],
  mode: 'copy',
  sourceParent: null,
  set: (ids, mode, sourceParent) => set({ ids, mode, sourceParent }),
  clear: () => set({ ids: [], mode: 'copy', sourceParent: null }),
}));
