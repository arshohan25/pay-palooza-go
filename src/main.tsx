import { captureInstallPrompt } from "./lib/installPromptStore";
import { cleanupCacheRecoveryParams, clearPreviewCacheArtifacts, syncClientCacheVersion } from "./lib/cacheReset";

// Capture before React renders so the event is never lost
captureInstallPrompt();

import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Global: pressing Enter on any input blurs it (dismisses mobile keyboard)
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    e.target instanceof HTMLInputElement &&
    e.target.type !== "submit"
  ) {
    e.target.blur();
  }
});

async function bootstrap() {
  // Only run cache sync on published builds, never in preview (prevents refresh loops)
  const isPreview =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");

  if (!isPreview) {
    await syncClientCacheVersion();
  }
  cleanupCacheRecoveryParams();

  createRoot(document.getElementById("root")!).render(<App />);

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");

  if ("serviceWorker" in navigator && !isInIframe && !isPreviewHost) {
    const registerServiceWorker = () => navigator.serviceWorker.register("/sw.js", { scope: "/" });

    if (document.readyState === "complete") {
      void registerServiceWorker();
    } else {
      window.addEventListener("load", () => {
        void registerServiceWorker();
      }, { once: true });
    }
  } else if (isInIframe || isPreviewHost) {
    void clearPreviewCacheArtifacts();
  }
}

void bootstrap();
