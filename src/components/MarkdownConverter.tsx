import { useState } from 'react';
import { FileText, FileDown, Type, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { generateWordDocument, generatePDFDocument } from '@/lib/documentGenerator';
import { toast } from 'sonner';

const MAX_CHARS = 200000;

export function MarkdownConverter() {
  const [filename, setFilename] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'docx'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  const charCount = markdown.length;
  const charPercentage = (charCount / MAX_CHARS) * 100;

  const handleGenerate = async () => {
    if (!filename.trim()) {
      toast.error('Please enter a filename');
      return;
    }

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
    // Allow paste but truncate to MAX_CHARS
    setMarkdown(value.slice(0, MAX_CHARS));
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-card rounded-2xl shadow-card p-8 md:p-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-secondary mb-4">
            <FileText className="w-7 h-7 text-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Markdown to Document
          </h1>
          <p className="text-muted-foreground">
            Convert your markdown to beautifully formatted PDF or Word files
          </p>
        </div>

        {/* Filename Input */}
        <div className="space-y-3">
          <Label htmlFor="filename" className="text-sm font-medium flex items-center gap-2">
            <Type className="w-4 h-4" />
            Document Name
          </Label>
          <Input
            id="filename"
            type="text"
            placeholder="my-document"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="h-12 text-base bg-editor border-editor-border focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            Output Format
          </Label>
          <RadioGroup
            value={outputFormat}
            onValueChange={(value) => setOutputFormat(value as 'pdf' | 'docx')}
            className="flex gap-4"
          >
            <div className="flex-1">
              <Label
                htmlFor="pdf"
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  outputFormat === 'pdf'
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <RadioGroupItem value="pdf" id="pdf" className="sr-only" />
                <span className="font-medium">PDF</span>
                <span className="text-xs text-muted-foreground">.pdf</span>
              </Label>
            </div>
            <div className="flex-1">
              <Label
                htmlFor="docx"
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  outputFormat === 'docx'
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <RadioGroupItem value="docx" id="docx" className="sr-only" />
                <span className="font-medium">Word</span>
                <span className="text-xs text-muted-foreground">.docx</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Markdown Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="markdown" className="text-sm font-medium flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Markdown Content
            </Label>
            <span
              className={`text-xs font-mono ${
                charPercentage > 90 ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <Textarea
            id="markdown"
            placeholder={`# Your Title

## Introduction
Write your content here using **markdown** syntax.

### Features
- Easy to use
- Supports headings, lists, and more
- *Italic* and **bold** text

> This is a quote

\`\`\`
Code blocks are supported too
\`\`\``}
            value={markdown}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            className="min-h-[300px] font-mono text-sm bg-editor border-editor-border focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-y leading-relaxed"
          />
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

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !filename.trim() || !markdown.trim()}
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
  );
}
