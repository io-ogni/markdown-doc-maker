import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { MarkdownConverter } from '@/components/MarkdownConverter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const licenses = [
  { name: 'jsPDF', url: 'https://github.com/parallax/jsPDF', license: 'MIT License' },
  { name: 'docx', url: 'https://github.com/dolanmilo/docx', license: 'MIT License' },
  { name: 'file-saver', url: 'https://github.com/eligrey/FileSaver.js', license: 'MIT License' },
];

const Index = () => {
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <MarkdownConverter />

        {/* Privacy shield button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setPrivacyOpen(true)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-xl border border-border hover:border-muted-foreground/30"
          >
            <ShieldCheck className="w-4 h-4 text-success" />
            Your file stays with you
          </button>
        </div>

        <footer className="mt-8 text-center text-sm text-muted-foreground space-y-2">
          <p>
            Your documents are generated locally in your browser.
            <br />
            Nothing is stored on any server.
          </p>
          <button
            onClick={() => setLicensesOpen(true)}
            className="text-xs text-muted-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Open Source Licenses
          </button>
        </footer>

        {/* Privacy dialog */}
        <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-success" />
                Your file stays with you
              </DialogTitle>
              <DialogDescription>
                Everything happens right here in your browser.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2 text-sm text-muted-foreground">
              <p>
                This app converts your Markdown entirely on your device. Your content is <span className="text-foreground font-medium">never uploaded</span> to any server.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span>All parsing and document generation runs locally in JavaScript</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span>No network requests are made with your content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span>No data is stored, tracked, or logged anywhere</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span>The generated file is saved directly to your device</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground/70">
                You can verify this by checking your browser's network tab — you'll see zero outgoing requests with your content.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Licenses dialog */}
        <Dialog open={licensesOpen} onOpenChange={setLicensesOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Open Source Licenses</DialogTitle>
              <DialogDescription>
                This application uses the following open source libraries:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-3 pt-2">
              {licenses.map((lib) => (
                <li key={lib.name} className="flex items-baseline gap-2 text-sm">
                  <a
                    href={lib.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-accent transition-colors underline underline-offset-2"
                  >
                    {lib.name}
                  </a>
                  <span className="text-muted-foreground">— {lib.license}</span>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
