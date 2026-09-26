import { markdownToSafeHtml } from './markdown';

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
  sup { font-size: 0.75em; vertical-align: super; line-height: 0; }
  .sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  .footnotes {
    font-size: 0.85em;
    color: #555;
    border-top: 1px solid #d8d3ca;
    margin-top: 2.5em;
    padding-top: 1em;
  }
  .footnotes ol { padding-left: 1.2em; }
  .footnotes li { margin: 0.4em 0; }
  .footnotes a { word-break: break-word; }
`;

// Resolves once the browser's print-to-PDF has been invoked; rejects when the
// environment can't print (typically in-app webviews like the LinkedIn or
// Instagram browsers, where window.print is missing or a no-op). The caller uses
// the rejection to guide the user to open the page in a real browser instead.
export function generateHTMLPrintPDF(markdown: string, filename: string): Promise<void> {
  const body = markdownToSafeHtml(markdown);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(filename)}</title>
    <style>${printCss}</style>
  </head>
  <body>${body}</body>
</html>`;

  return new Promise<void>((resolve, reject) => {
    // Render into a hidden iframe so we don't navigate away or flash a new tab.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    // Safety net: if onload never fires, don't hang the caller forever.
    const failTimer = setTimeout(() => { cleanup(); reject(new Error('PRINT_TIMEOUT')); }, 8000);

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win || typeof win.print !== 'function') {
        clearTimeout(failTimer);
        cleanup();
        reject(new Error('PRINT_UNAVAILABLE'));
        return;
      }
      // Give fonts/layout a tick, then invoke the browser's print-to-PDF.
      setTimeout(() => {
        try {
          win.focus();
          win.print();
          clearTimeout(failTimer);
          resolve();
        } catch (err) {
          clearTimeout(failTimer);
          reject(err instanceof Error ? err : new Error('PRINT_FAILED'));
        } finally {
          // Remove after the dialog has had time to grab the document.
          setTimeout(cleanup, 1000);
        }
      }, 150);
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) { clearTimeout(failTimer); cleanup(); reject(new Error('PRINT_UNAVAILABLE')); return; }
    doc.open();
    doc.write(html);
    doc.close();
  });
}
