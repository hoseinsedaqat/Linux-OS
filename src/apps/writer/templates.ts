export interface WriterTemplate {
  id: string;
  name: string;
  description: string;
  /** Right-to-left documents get `dir="rtl"` in the editor. */
  rtl?: boolean;
  html: string;
}

/**
 * Document templates.
 *
 * They are plain HTML that lands in the editor, so everything they contain is
 * editable, printable and exportable like any other document — no placeholder
 * machinery that only half works.
 */
export const WRITER_TEMPLATES: WriterTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'An empty A4 page with the default style.',
    html: '<p><br></p>',
  },
  {
    id: 'letter',
    name: 'Formal letter',
    description: 'Sender block, date, salutation and signature line.',
    html: `<p style="text-align:right">NOVA Studio<br>12 Harbour Street<br>Amsterdam, NL</p>
<p><br></p>
<p>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<p><br></p>
<p>Dear …</p>
<p><br></p>
<p>Thank you for your time. I am writing about …</p>
<p><br></p>
<p>Kind regards,<br><strong>Your name</strong></p>`,
  },
  {
    id: 'report',
    name: 'Project report',
    description: 'Title, summary, sections and a results table.',
    html: `<h1>Project report</h1>
<p><em>Prepared for … · ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</em></p>
<h2>Summary</h2>
<p>One paragraph that explains the problem, the approach and the outcome.</p>
<h2>Scope</h2>
<ul><li>What was included</li><li>What was explicitly left out</li></ul>
<h2>Results</h2>
<table style="border-collapse:collapse;width:100%"><tbody>
<tr><th style="border:1px solid #ccc;padding:6px">Metric</th><th style="border:1px solid #ccc;padding:6px">Target</th><th style="border:1px solid #ccc;padding:6px">Actual</th></tr>
<tr><td style="border:1px solid #ccc;padding:6px">&nbsp;</td><td style="border:1px solid #ccc;padding:6px">&nbsp;</td><td style="border:1px solid #ccc;padding:6px">&nbsp;</td></tr>
</tbody></table>
<h2>Next steps</h2>
<ol><li>…</li><li>…</li></ol>`,
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Attendees, agenda, decisions and action items.',
    html: `<h1>Meeting notes</h1>
<p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}<br>
<strong>Attendees:</strong> </p>
<h2>Agenda</h2>
<ol><li>…</li><li>…</li></ol>
<h2>Decisions</h2>
<ul><li>…</li></ul>
<h2>Action items</h2>
<ul><li>[ ] Owner — task — due date</li></ul>`,
  },
  {
    id: 'persian-letter',
    name: 'نامه فارسی',
    description: 'Persian letter with right-to-left layout.',
    rtl: true,
    html: `<div dir="rtl" style="text-align:right;line-height:2">
<p>بسم‌الله الرحمن الرحیم</p>
<p><strong>موضوع:</strong> …</p>
<p>با سلام و احترام،</p>
<p>بدین‌وسیله به استحضار می‌رساند که …</p>
<p>با تشکر و احترام،<br><strong>نام و نام خانوادگی</strong></p>
</div>`,
  },
];
