const CACHE_VERSION = "20";
const CACHE_VERSION_KEY = "app_cache_version";
const CACHE_RECOVERY_PARAM = "cache_recovery";
const CACHE_BUST_PARAM = "cache_bust";
const RETRY_DELAY_MS = 300;

const CHUNK_ERROR_SIGNATURES = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "chunkloaderror",
  "loading chunk",
  "unable to preload css",
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function clearRuntimeCaches() {
  try {
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }
  } catch {
    // Ignore cache storage failures
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Ignore service worker cleanup failures
  }
}

const PRESERVED_KEYS = [
  "mfs_ui_lang",
  "mfs_onboarding_completed",
  "mfs_has_authenticated",
];

export async function clearClientCache(version = CACHE_VERSION) {
  const preserved: Record<string, string> = {};
  try {
    for (const key of PRESERVED_KEYS) {
      const v = localStorage.getItem(key);
      if (v !== null) preserved[key] = v;
    }
  } catch {
    // Ignore storage failures
  }

  try {
    localStorage.clear();
  } catch {
    // Ignore storage failures
  }

  try {
    sessionStorage.clear();
  } catch {
    // Ignore storage failures
  }

  await clearRuntimeCaches();

  try {
    for (const [k, v] of Object.entries(preserved)) {
      localStorage.setItem(k, v);
    }
    localStorage.setItem(CACHE_VERSION_KEY, version);
  } catch {
    // Ignore storage failures
  }
}

export async function syncClientCacheVersion() {
  let storedVersion: string | null = null;
  try {
    storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  } catch {
    return false;
  }

  const current = Number(CACHE_VERSION);
  const stored = storedVersion === null ? NaN : Number(storedVersion);
  const isOlder = Number.isFinite(current) && (!Number.isFinite(stored) || stored < current);

  if (!isOlder && storedVersion === CACHE_VERSION) return false;
  if (!isOlder) {
    // Stored is newer or equal-but-non-numeric match already handled; nothing to do.
    return false;
  }

  await clearClientCache(CACHE_VERSION);
  return true;
}

export async function clearPreviewCacheArtifacts() {
  await clearRuntimeCaches();
}

export function cleanupCacheRecoveryParams() {
  const url = new URL(window.location.href);
  let hasChanges = false;

  [CACHE_RECOVERY_PARAM, CACHE_BUST_PARAM].forEach((param) => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      hasChanges = true;
    }
  });

  if (hasChanges) {
    window.history.replaceState(window.history.state, document.title, url.toString());
  }
}

function isChunkLoadError(error: unknown) {
  const message = String(error instanceof Error ? `${error.name} ${error.message}` : error).toLowerCase();
  return CHUNK_ERROR_SIGNATURES.some((signature) => message.includes(signature));
}

export async function recoverFromChunkLoadError(error: unknown) {
  if (!isChunkLoadError(error)) return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get(CACHE_RECOVERY_PARAM) === CACHE_VERSION) {
    return false;
  }

  await clearClientCache(CACHE_VERSION);
  url.searchParams.set(CACHE_RECOVERY_PARAM, CACHE_VERSION);
  url.searchParams.set(CACHE_BUST_PARAM, `${Date.now()}`);
  window.location.replace(url.toString());
  return true;
}

export async function retryLazyImport<T>(loader: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (retries > 0) {
      await wait(RETRY_DELAY_MS);
      return retryLazyImport(loader, retries - 1);
    }

    const recovered = await recoverFromChunkLoadError(error);
    if (recovered) {
      return new Promise<T>(() => undefined);
    }

    throw error;
  }
}