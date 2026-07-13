# Markdown to Document Converter

Convert Markdown into cleanly formatted **PDF** or **Word (.docx)** files, entirely in your browser.

- **Private by design** — parsing and document generation run locally in your browser. Nothing is uploaded, stored, tracked, or logged.
- **Free** — no account, no limits.
- Built with jsPDF, docx, and file-saver (all MIT licensed).

## Development

Requires Node.js (or Bun).

```sh
npm install
npm run dev      # http://localhost:8080
npm run build    # outputs static site to dist/
npm run preview  # serve the production build locally
```

## Deployment

Static single-page app hosted on **GitHub Pages**, auto-deployed on every push to `main` via `.github/workflows/deploy-pages.yml` (`vite build` → `dist/`, with `index.html` copied to `404.html` for SPA routing).

The custom domain is set in `public/CNAME`. DNS lives at **Strato**: the subdomain is a `CNAME` record pointing to `io-ogni.github.io`, with "Enforce HTTPS" enabled in the repo's Pages settings.

## Tech stack

Vite · React · TypeScript · Tailwind CSS · shadcn/ui

## License

See [LICENSE](./LICENSE).

© Ioana Ognibeni. All rights reserved.
