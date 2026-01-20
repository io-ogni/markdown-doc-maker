import { MarkdownConverter } from '@/components/MarkdownConverter';

const Index = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Subtle background decoration */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <MarkdownConverter />

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Your documents are generated locally in your browser.
            <br />
            Nothing is stored on any server.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
