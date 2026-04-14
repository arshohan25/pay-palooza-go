// ── Cache version gate — clears stale localStorage/sessionStorage ──
const CACHE_VERSION = "5";
const storedVersion = localStorage.getItem("app_cache_version");
if (storedVersion !== CACHE_VERSION) {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("app_cache_version", CACHE_VERSION);
}

import { captureInstallPrompt } from "./lib/installPromptStore";

// Capture before React renders so the event is never lost
captureInstallPrompt();

import { createRoot } from "react-dom/client";
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

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if ("serviceWorker" in navigator && !isInIframe && !isPreviewHost) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
} else if (isInIframe || isPreviewHost) {
  // Unregister any stale service workers in preview contexts
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}
