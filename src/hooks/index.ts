import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '@/core/themes/settingsStore';
import { computeMetrics, type Metrics } from '@/core/window-manager/metrics';

/** Live viewport + work area (respects the panel position/size settings). */
export function useDesktopMetrics(panelVisible = true): Metrics {
  const panelPosition = useSettings((s) => s.panelPosition);
  const panelSize = useSettings((s) => s.panelSize);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const settings = useSettings.getState();

  return useMemo(
    () =>
      computeMetrics(viewport.width, viewport.height, { ...settings, panelPosition, panelSize }, panelVisible),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport.width, viewport.height, panelPosition, panelSize, panelVisible, settings.panelAutoHide],
  );
}

/** A ticking clock, optionally limited to minute precision for cheap renders. */
export function useClock(withSeconds = false): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), withSeconds ? 1000 : 15_000);
    return () => window.clearInterval(interval);
  }, [withSeconds]);
  return now;
}

export function useOutsideClick<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: () => void,
  active = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!active) return;
    const listener = (event: MouseEvent | TouchEvent) => {
      const element = ref.current;
      if (!element || element.contains(event.target as Node)) return;
      handlerRef.current();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [active, ref]);
}

export function useEscape(handler: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handler();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [active, handler]);
}

/** Session uptime in seconds since the desktop was mounted. */
export function useUptime(): number {
  const startedAt = useRef(Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);
  return seconds;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Store a click-away + escape close pair for popovers. */
export function usePopover(initial = false) {
  const [open, setOpen] = useState(initial);
  const ref = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(ref, close, open);
  useEscape(close, open);
  return { open, setOpen, ref, close, toggle: () => setOpen((value) => !value) };
}
