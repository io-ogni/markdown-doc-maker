import { useState, useRef, useCallback } from 'react';
import { FileText, FileDown, Type, Hash, Upload, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { generateWordDocument, generatePDFDocument } from '@/lib/documentGenerator';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { toast } from 'sonner';

const MAX_CHARS = 200000;

export function MarkdownConverter() {
  const [filename, setFilename] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'docx'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = markdown.length;
  const charPercentage = (charCount / MAX_CHARS) * 100;

  const handleGenerate = async () => {
    if (!markdown.trim()) {
      toast.error('Please enter some markdown content');
      return;
    }

    setIsGenerating(true);

    try {
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_\s]/g, '').trim() || 'document';

      if (outputFormat === 'pdf') {
        await generatePDFDocument(markdown, sanitizedFilename);
        toast.success('PDF downloaded successfully!');
      } else {
        await generateWordDocument(markdown, sanitizedFilename);
        toast.success('Word document downloaded successfully!');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate document. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkdownChange = (value: string) => {
    setMarkdown(value.slice(0, MAX_CHARS));
  };

  const readFile = useCallback((file: File) => {
    if (!file.name.match(/\.(md|markdown|txt|text)$/i)) {
      toast.error('Please drop a Markdown (.md) or text file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setMarkdown(content.slice(0, MAX_CHARS));
        // Auto-set filename from file name if empty
        if (!filename.trim()) {
          const baseName = file.name.replace(/\.(md|markdown|txt|text)$/i, '');
          setFilename(baseName);
        }
        toast.success(`Loaded "${file.name}"`);
      }
    };
    reader.readAsText(file);
  }, [filename]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
  }, [readFile]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="bg-card rounded-2xl shadow-card p-8 md:p-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-secondary mb-4">
            <FileText className="w-7 h-7 text-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Private Markdown to PDF &amp; Word Converter
          </h1>
          <p className="text-muted-foreground">
            Convert Markdown to beautifully formatted PDF or Word files — entirely in your browser. Nothing is uploaded, nothing leaves your device.
          </p>
        </div>

        {/* Filename Input */}
        <div className="space-y-3">
          <Label htmlFor="filename" className="text-sm font-medium flex items-center gap-2">
            <Type className="w-4 h-4" />
            Document Name
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="filename"
            type="text"
            placeholder="document"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="h-12 text-base bg-editor border-editor-border focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>

        {/* Markdown Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="markdown" className="text-sm font-medium flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Markdown Content
            </Label>
            <div className="flex items-center gap-3">
              {/* File upload button */}
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Upload .md
                <input
                  type="file"
                  accept=".md,.markdown,.txt,.text"
                  onChange={handleFileInput}
                  className="sr-only"
                />
              </label>
              {/* Preview toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-8 px-3 text-xs gap-1.5"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? 'Hide Preview' : 'Preview'}
              </Button>
              <span
                className={`text-xs font-mono ${
                  charPercentage > 90 ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
            </div>
          </div>

          <div className={`grid gap-4 ${showPreview && markdown.trim() ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Editor */}
            <div
              className="relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Textarea
                ref={textareaRef}
                id="markdown"
                placeholder={`# Your Title

## Introduction
Write your content here using **markdown** syntax.

### Features
- Easy to use
- Supports headings, lists, and more
  - Nested items too
- *Italic*, **bold**, and ~~strikethrough~~

> This is a quote

---

![Alt text](image-url)

\`\`\`
Code blocks are supported too
\`\`\``}
                value={markdown}
                onChange={(e) => handleMarkdownChange(e.target.value)}
                className="min-h-[300px] font-mono text-sm bg-editor border-editor-border focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-y leading-relaxed"
              />
              {/* Drag overlay */}
              {isDragging && (
                <div className="absolute inset-0 rounded-xl border-2 border-dashed border-accent bg-accent/10 flex items-center justify-center z-10 pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-accent">
                    <Upload className="w-8 h-8" />
                    <span className="text-sm font-medium">Drop your .md file here</span>
                  </div>
                </div>
              )}
            </div>

            {/* Live preview */}
            {showPreview && markdown.trim() && (
              <div className="min-h-[300px] max-h-[500px] overflow-y-auto rounded-xl border border-border bg-background p-4">
                <MarkdownPreview markdown={markdown} />
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                charPercentage > 90
                  ? 'bg-destructive'
                  : charPercentage > 70
                  ? 'bg-accent'
                  : 'bg-success'
              }`}
              style={{ width: `${Math.min(charPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Format + Generate */}
        <div className="space-y-4 pt-2 border-t border-border">
          {/* Format toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Label className="text-sm font-medium flex items-center gap-2 shrink-0">
              <FileDown className="w-4 h-4" />
              Save as
            </Label>
            <div
              role="radiogroup"
              aria-label="Output format"
              className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted flex-1"
            >
              {([
                { value: 'pdf', label: 'PDF', ext: '.pdf' },
                { value: 'docx', label: 'Word', ext: '.docx' },
              ] as const).map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  role="radio"
                  aria-checked={outputFormat === fmt.value}
                  onClick={() => setOutputFormat(fmt.value)}
                  className={`flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium transition-all ${
                    outputFormat === fmt.value
                      ? 'bg-card text-foreground shadow-sm ring-1 ring-accent/40'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  {fmt.label}
                  <span className="text-xs text-muted-foreground">{fmt.ext}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
          onClick={handleGenerate}
          disabled={isGenerating || !markdown.trim()}
          className="w-full h-14 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all disabled:opacity-50"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <FileDown className="w-5 h-5" />
              Generate & Download {outputFormat.toUpperCase()}
            </span>
          )}
          </Button>
        </div>
      </div>
    </div>
  );
}
