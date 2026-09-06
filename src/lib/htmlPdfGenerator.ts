import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Prototype: HTML-based PDF export.
//
// Instead of hand-drawing the page with jsPDF, we render the *same* sanitized
// HTML the preview uses and hand it to the browser's own print-to-PDF pipeline.
// That gives true WYSIWYG (preview == PDF), full Unicode/CJK/emoji, real fonts,
// and selectable/searchable text — with zero extra dependencies.
//
// Trade-off vs the jsPDF path: this opens the browser's print dialog (the user
// picks "Save as PDF") rather than downloading a file directly.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// Print stylesheet — system fonts only (no CDN, keeps the privacy claim intact).
const printCss = `
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.4em 0 0.5em; font-weight: 600; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1.1em; }
  h5 { font-size: 1em; }
  h6 { font-size: 0.9em; color: #555; }
  p { margin: 0.6em 0; }
  a { color: #c2410c; text-decoration: underline; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  del { text-decoration: line-through; }
  ul, ol { margin: 0.6em 0; padding-left: 1.6em; }
  li { margin: 0.25em 0; }
  blockquote {
    margin: 1em 0;
    padding: 0.4em 1em;
    border-left: 3px solid #f97316;
    color: #444;
    background: #faf7f2;
  }
  code {
    font-family: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    font-size: 0.9em;
    background: #f4f1ec;
    padding: 0.15em 0.35em;
    border-radius: 3px;
  }
  pre {
    background: #f4f1ec;
    border: 1px solid #e5e0d8;
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  thead { display: table-header-group; } /* repeat header row on each page */
  tr { break-inside: avoid; } /* don't split a single row, but allow the table to flow across pages */
  th, td { border: 1px solid #d8d3ca; padding: 0.5em 0.75em; text-align: left; }
  th { background: #f4f1ec; font-weight: 600; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #d8d3ca; margin: 1.5em 0; }
`;

export function generateHTMLPrintPDF(markdown: string, filename: string): void {
  marked.setOptions({ breaks: true, gfm: true });
  const body = DOMPurify.sanitize(marked.parse(markdown) as string);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(filename)}</title>
    <style>${printCss}</style>
  </head>
  <body>${body}</body>
</html>`;

  // Render into a hidden iframe so we don't navigate away or flash a new tab.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    // Give fonts/layout a tick, then invoke the browser's print-to-PDF.
    setTimeout(() => {
      win.focus();
      win.print();
      // Remove after the dialog has had time to grab the document.
      setTimeout(cleanup, 1000);
    }, 150);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open();
  doc.write(html);
  doc.close();
}
