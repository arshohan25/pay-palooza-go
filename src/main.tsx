// ── Cache version gate — clears stale localStorage/sessionStorage ──
const CACHE_VERSION = "2";
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

// Register service worker after page becomes interactive (non-blocking)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
}
