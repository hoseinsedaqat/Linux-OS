import { Modal } from '@/components/common/Modal';
import { useT } from '@/core/localization/i18n';
import { notify } from '@/core/notifications/notificationsStore';

interface ShortcutsSheetProps {
  open: boolean;
  onClose: () => void;
}

const GROUPS: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: 'Shell',
    rows: [
      ['Ctrl + K', 'Open the command palette'],
      ['Ctrl + Alt + T', 'Open a terminal'],
      ['Ctrl + Alt + L', 'Lock the screen'],
      ['Ctrl + Alt + ↑', 'Show all windows'],
      ['Ctrl + Alt + ← / →', 'Switch workspace'],
      ['Shift + ?', 'This shortcut list'],
    ],
  },
  {
    title: 'Windows',
    rows: [
      ['Super + ← / →', 'Tile the active window to a half'],
      ['Super + ↑', 'Maximize the active window'],
      ['Super + ↓', 'Restore or minimize'],
      ['Alt + Tab', 'Cycle through open windows'],
      ['Double-click a title bar', 'Maximize / restore'],
      ['Drag to a screen corner', 'Snap to a quarter'],
    ],
  },
  {
    title: 'Applications',
    rows: [
      ['Ctrl + S', 'Save the current document'],
      ['Ctrl + P', 'Print preview where supported'],
      ['Ctrl + F', 'Search inside the current app'],
      ['Esc', 'Close a dialog or overlay'],
    ],
  },
];

/** A single, honest list of the shortcuts the shell actually implements. */
export function ShortcutsSheet({ open, onClose }: ShortcutsSheetProps) {
  const t = useT();
  return (
    <Modal open={open} title={t('Keyboard shortcuts')} onClose={onClose}>
      <div className="shortcuts-sheet">
        {GROUPS.map((group) => (
          <section key={group.title} className="shortcuts-sheet__group">
            <h3>{t(group.title)}</h3>
            <dl>
              {group.rows.map(([keys, label]) => (
                <div key={keys} className="shortcuts-sheet__row">
                  <dt>
                    {keys.split(' + ').map((key, index) => (
                      <span key={`${key}-${index}`}>
                        <span className="kbd">{key}</span>
                        {index < keys.split(' + ').length - 1 ? ' + ' : ''}
                      </span>
                    ))}
                  </dt>
                  <dd>{t(label)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="shortcuts-sheet__hint">
          {t('Shortcuts only act inside NOVA — the real operating system keeps its own shortcuts.')}
        </p>
      </div>
    </Modal>
  );
}

/** Announce the sheet from non-React callers (settings, welcome app). */
export function announceShortcutSheet(): void {
  notify('Keyboard shortcuts', { body: 'Shift + ? opens the full list.', kind: 'info' });
}
