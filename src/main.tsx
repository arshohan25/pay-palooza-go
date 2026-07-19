import { captureInstallPrompt } from "./lib/installPromptStore";
import { cleanupCacheRecoveryParams, clearPreviewCacheArtifacts, syncClientCacheVersion } from "./lib/cacheReset";
import { captureAppRoleFromUrl } from "./lib/appRole";
import { purgeInvalidStoredAuthSession } from "./lib/authSessionRecovery";
import { installRealtimeAuthGuard } from "./lib/realtimeManager";

// Purge corrupt persisted auth before React/Supabase initialize.
purgeInvalidStoredAuthSession();
// Capture before React renders so the event is never lost
captureInstallPrompt();
// Tear down realtime channels on sign-out / user switch to prevent leaks.
installRealtimeAuthGuard();


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
  try {
    // One-time automatic purge whenever stored cache version is older than CACHE_VERSION.
    await syncClientCacheVersion();
    cleanupCacheRecoveryParams();
  } catch {
    // Cache recovery must never block app rendering.
  }

  // Persist ?app=<role> after cache recovery so version cleanup doesn't wipe it.
  captureAppRoleFromUrl();

  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

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

  if (isInIframe || isPreviewHost) {
    void clearPreviewCacheArtifacts();
  }
}

void bootstrap();
