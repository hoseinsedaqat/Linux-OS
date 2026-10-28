import { notifyError } from '@/core/notifications/notificationsStore';

/**
 * Open a printable document in a new tab. Browsers may block pop-ups; we
 * surface a clear message instead of silently doing nothing.
 */
export function openPrintWindow(title: string, bodyHtml: string, orientation: 'portrait' | 'landscape' = 'portrait'): boolean {
  const win = window.open('', '_blank', 'width=900,height=1000,noopener,noreferrer');
  if (!win) {
    notifyError('Print window blocked', 'Allow pop-ups for this site to print or save as PDF.', 'writer');
    return false;
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeTitle(title)}</title>
  <style>
    @page { size: A4 ${orientation}; margin: 18mm; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; font-size: 12pt; }
    h1,h2,h3 { line-height: 1.25; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #bbb; padding: 6px 8px; }
    img { max-width: 100%; }
    a { color: #0a58ca; }
  </style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* the user can print manually from the new tab */
    }
  }, 400);
  return true;
}

function escapeTitle(title: string): string {
  return title.replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char] ?? char);
}
