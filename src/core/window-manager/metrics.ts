import { useSettings } from '@/core/themes/settingsStore';
import type { PanelPosition, SettingsState, WindowRect } from '@/types';

export interface Metrics {
  viewportWidth: number;
  viewportHeight: number;
  panelThickness: number;
  workArea: WindowRect;
  isMobile: boolean;
}

export const MOBILE_BREAKPOINT = 820;

export function panelThickness(settings: SettingsState): number {
  if (settings.panelPosition === 'left' || settings.panelPosition === 'right') return 88;
  switch (settings.panelSize) {
    case 'compact':
      return 44;
    case 'large':
      return 62;
    default:
      return 54;
  }
}

export function computeMetrics(
  viewportWidth: number,
  viewportHeight: number,
  settings: SettingsState,
  panelVisible = true,
): Metrics {
  const thickness = panelVisible ? panelThickness(settings) : 0;
  const isMobile = viewportWidth <= MOBILE_BREAKPOINT;
  const effectivePosition: PanelPosition = isMobile ? 'bottom' : settings.panelPosition;
  const bottom = effectivePosition === 'bottom' ? thickness : 0;
  const top = effectivePosition === 'top' ? thickness : 0;
  const left = effectivePosition === 'left' ? thickness : 0;
  const right = effectivePosition === 'right' ? thickness : 0;

  return {
    viewportWidth,
    viewportHeight,
    panelThickness: thickness,
    isMobile,
    workArea: {
      x: left,
      y: top,
      width: Math.max(240, viewportWidth - left - right),
      height: Math.max(200, viewportHeight - top - bottom),
    },
  };
}

/* The desktop canvas can be smaller than the browser window when the user
 * picks a "virtual resolution" — the window layer lives inside that canvas,
 * so all window maths use these metrics. */
let activeMetrics: Metrics | null = null;

export function setActiveMetrics(metrics: Metrics | null): void {
  activeMetrics = metrics;
}

export function currentMetrics(): Metrics {
  if (activeMetrics) return activeMetrics;
  const settings = useSettings.getState();
  const width = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const height = typeof window === 'undefined' ? 900 : window.innerHeight;
  return computeMetrics(width, height, settings);
}

type PanelSide = 'top' | 'bottom' | 'left' | 'right';

export function panelSide(settings: SettingsState, isMobile: boolean): PanelSide {
  return isMobile ? 'bottom' : (settings.panelPosition as PanelSide);
}

/** Clamp a window rectangle so it stays reachable inside the work area. */
export function clampRect(rect: WindowRect, workArea: WindowRect, minWidth = 260, minHeight = 180): WindowRect {
  const width = Math.min(Math.max(rect.width, minWidth), workArea.width);
  const height = Math.min(Math.max(rect.height, minHeight), workArea.height);
  const minVisibleX = workArea.x - width + 140;
  const maxX = workArea.x + workArea.width - 140;
  const x = Math.min(Math.max(rect.x, minVisibleX), maxX);
  const y = Math.min(Math.max(rect.y, workArea.y), workArea.y + workArea.height - 40);
  return { x, y, width, height };
}
