import { captureInstallPrompt } from "./lib/installPromptStore";

// Capture before React renders so the event is never lost
captureInstallPrompt();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";


createRoot(document.getElementById("root")!).render(<App />);
