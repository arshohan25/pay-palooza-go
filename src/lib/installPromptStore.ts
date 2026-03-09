interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners: Array<(prompt: BeforeInstallPromptEvent) => void> = [];

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((cb) => cb(deferredPrompt!));
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
  });
}

export function getInstallPrompt() {
  return deferredPrompt;
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
}
