import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Self-hosted fonts (no third-party requests — keeps the privacy claim airtight & GDPR-clean)
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
