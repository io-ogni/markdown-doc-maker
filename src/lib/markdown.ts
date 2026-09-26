import { marked } from 'marked';
import footnote from 'marked-footnote';
import DOMPurify from 'dompurify';

// Single source of truth for Markdown → HTML, shared by the live preview and the
// HTML print-to-PDF export so the two can never drift apart.
//
// Configured once at module load. `marked.use` is global and cumulative, so it
// must run exactly once — importing this module guarantees that.
marked.use(footnote());
marked.setOptions({ breaks: true, gfm: true });

// Any link that opens a new tab gets rel="noopener noreferrer" so a target page
// can't reach back into this one (tab-nabbing) or read the referrer.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof Element && node.tagName === 'A' && node.hasAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Parse Markdown to HTML and sanitize it. Pasted Markdown can carry raw HTML
 * (e.g. <img onerror> / <script>) that would otherwise run in the page and could
 * phone home — which would break the "nothing leaves your device" promise. Every
 * render path must go through here.
 */
export function markdownToSafeHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown) as string;
  return DOMPurify.sanitize(rawHtml);
}
