import { useEffect } from 'react';
import { useWindows } from '@/core/window-manager/windowsStore';
import { clampRect, type Metrics } from '@/core/window-manager/metrics';
import { WindowFrame } from './WindowFrame';
import type { WindowInstance } from '@/types';

interface WindowManagerProps {
  metrics: Metrics;
}

export function WindowManager({ metrics }: WindowManagerProps) {
  const windows = useWindows((state) => state.windows);
  const workspace = useWindows((state) => state.workspace);
  const updateRect = useWindows((state) => state.updateRect);

  // Keep every window inside the work area when the canvas/panel changes.
  useEffect(() => {
    const { workArea } = metrics;
    useWindows.getState().windows.forEach((win: WindowInstance) => {
      if (win.maximized) {
        if (
          win.x !== workArea.x ||
          win.y !== workArea.y ||
          win.width !== workArea.width ||
          win.height !== workArea.height
        ) {
          updateRect(win.id, {
            x: workArea.x,
            y: workArea.y,
            width: workArea.width,
            height: workArea.height,
          });
        }
        return;
      }
      const clamped = clampRect(
        { x: win.x, y: win.y, width: win.width, height: win.height },
        workArea,
        260,
        160,
      );
      if (clamped.x !== win.x || clamped.y !== win.y || clamped.width !== win.width || clamped.height !== win.height) {
        updateRect(win.id, clamped);
      }
    });
  }, [metrics, updateRect]);

  return (
    <div className="window-layer" data-workspace={workspace}>
      {windows.map((win) => (
        <WindowFrame key={win.id} win={win} />
      ))}
    </div>
  );
}
