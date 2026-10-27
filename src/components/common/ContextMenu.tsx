import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

export interface MenuEntry {
  id: string;
  label?: string;
  icon?: LucideIcon;
  shortcut?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  heading?: string;
}

export interface MenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: MenuPosition | null;
  entries: MenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ position, entries, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [adjusted, setAdjusted] = useState<MenuPosition | null>(position);

  useLayoutEffect(() => {
    if (!position || !ref.current) {
      setAdjusted(position);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const pad = 8;
    let x = position.x;
    let y = position.y;
    if (x + rect.width > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - rect.width - pad);
    if (y + rect.height > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - rect.height - pad);
    setAdjusted({ x, y });
  }, [position, entries.length]);

  useEffect(() => {
    if (!position) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: MouseEvent) => {
      if (ref.current && event.target instanceof Node && ref.current.contains(event.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer, true);
      window.removeEventListener('blur', onClose);
    };
  }, [position, onClose]);

  if (!position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: (adjusted ?? position).x, top: (adjusted ?? position).y }}
      role="menu"
      onContextMenu={(event: ReactMouseEvent) => event.preventDefault()}
    >
      {entries.map((entry) => {
        if (entry.separator) return <div key={entry.id} className="context-menu__sep" />;
        if (entry.heading) return <div key={entry.id} className="context-menu__label">{entry.heading}</div>;
        const Icon = entry.icon;
        return (
          <button
            key={entry.id}
            className={`context-menu__item${entry.danger ? ' context-menu__item--danger' : ''}`}
            disabled={entry.disabled}
            onClick={() => {
              onClose();
              entry.onClick?.();
            }}
            role="menuitem"
          >
            <span className="context-menu__item-icon">{Icon ? <Icon size={14} strokeWidth={1.9} /> : null}</span>
            <span className="truncate">{entry.label}</span>
            {entry.shortcut && <span className="context-menu__shortcut">{entry.shortcut}</span>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** Convenience hook for showing a context menu from any component. */
export function useContextMenu() {
  const [state, setState] = useState<{ position: MenuPosition; entries: MenuEntry[] } | null>(null);
  const open = (event: { clientX: number; clientY: number; preventDefault?: () => void }, entries: MenuEntry[]) => {
    event.preventDefault?.();
    setState({ position: { x: event.clientX, y: event.clientY }, entries });
  };
  const close = () => setState(null);
  const node = <ContextMenu position={state?.position ?? null} entries={state?.entries ?? []} onClose={close} />;
  return { open, close, node, isOpen: Boolean(state) };
}
