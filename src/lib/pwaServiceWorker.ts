export type InstallServiceWorkerStatus = "ready" | "blocked" | "unsupported" | "failed";

export interface InstallServiceWorkerResult {
  status: InstallServiceWorkerStatus;
  message: string;
}

const APP_SW_PATH = "/sw.js";

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const isPreviewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

const isAppWorker = (registration: ServiceWorkerRegistration) => {
  const worker = registration.active ?? registration.installing ?? registration.waiting;
  return worker?.scriptURL ? new URL(worker.scriptURL).pathname === APP_SW_PATH : false;
};

async function unregisterAppWorkers() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(isAppWorker).map((registration) => registration.unregister()));
  } catch {
    // Ignore cleanup errors — install UI should still render.
  }
}

function blockReason(): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "Browser runtime is unavailable.";
  if (!("serviceWorker" in navigator)) return "This browser does not support install service workers.";
  if (!import.meta.env.PROD) return "Install prompts are available only from the published app.";
  if (isInIframe()) return "Open the install link in a normal browser tab — embedded previews cannot install apps.";
  if (isPreviewHost(window.location.hostname)) return "Open the published app link — Lovable preview links cannot install apps.";
  if (new URL(window.location.href).searchParams.get("sw") === "off") return "Install service worker is disabled for this tab.";
  return null;
}

export function getInstallServiceWorkerBlockReason() {
  return blockReason();
}

export async function ensureInstallServiceWorker(): Promise<InstallServiceWorkerResult> {
  const reason = blockReason();
  if (reason) {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      await unregisterAppWorkers();
    }
    return { status: reason.includes("does not support") ? "unsupported" : "blocked", message: reason };
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existing = registrations.find(isAppWorker);
    const registration = existing ?? (await navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" }));
    await registration.update().catch(() => undefined);
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => window.setTimeout(resolve, 3000)),
    ]);
    return { status: "ready", message: "Install service worker is ready." };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Could not prepare the install service worker.",
    };
  }
}
