interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let deferredPromptManifestHref: string | null = null;
let installed = false;
const listeners: Array<(prompt: BeforeInstallPromptEvent) => void> = [];

function readActiveManifestHref() {
  if (typeof document === "undefined") return null;
  return document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null;
}

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    deferredPromptManifestHref = readActiveManifestHref();
    listeners.forEach((cb) => cb(deferredPrompt!));
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    deferredPromptManifestHref = null;
  });
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function getInstallPromptManifestHref() {
  return deferredPromptManifestHref;
}

export function getInstallPromptForManifest(manifestHref: string) {
  if (!deferredPrompt) return null;
  return deferredPromptManifestHref === manifestHref ? deferredPrompt : null;
}

export function isAppInstalled() {
  return installed || window.matchMedia("(display-mode: standalone)").matches;
}

export function onPromptAvailable(cb: (prompt: BeforeInstallPromptEvent) => void) {
  listeners.push(cb);
  if (deferredPrompt) cb(deferredPrompt);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function clearPrompt() {
  deferredPrompt = null;
  deferredPromptManifestHref = null;
}
