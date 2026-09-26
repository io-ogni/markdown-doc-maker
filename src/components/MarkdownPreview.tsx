import { useMemo } from 'react';
import { markdownToSafeHtml } from '@/lib/markdown';

interface MarkdownPreviewProps {
  markdown: string;
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    if (!markdown.trim()) return '';
    return markdownToSafeHtml(markdown);
  }, [markdown]);

  if (!markdown.trim()) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
        Preview will appear here…
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert 
        prose-headings:text-foreground prose-p:text-foreground/90 
        prose-strong:text-foreground prose-em:text-foreground/80
        prose-li:text-foreground/90 prose-blockquote:border-accent
        prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
        prose-pre:bg-muted prose-pre:border prose-pre:border-border
        prose-hr:border-border
        prose-a:text-accent prose-a:no-underline hover:prose-a:underline
        prose-img:rounded-lg prose-img:max-w-full
        prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-muted
        prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2
        overflow-y-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
