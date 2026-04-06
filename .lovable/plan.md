

# Remove All Old Local Cache on App Start

## What Changes

Add a **cache version** mechanism in `src/main.tsx` that clears all legacy localStorage and sessionStorage keys when the app loads. This ensures stale data from previous versions doesn't cause issues.

## Technical Details

### 1. `src/main.tsx` — Add cache purge logic before React renders

Add a cache version constant (e.g. `CACHE_VERSION = "2"`). On load, check `localStorage.getItem("app_cache_version")`. If it differs from the current version (or is missing), clear all localStorage and sessionStorage, then set the new version key.

This removes all legacy keys like:
- `mfs_*` (balance cache, user name, phone, photo, device fingerprint, lock attempts, etc.)
- `easypay_*` (cart, recently viewed, pinned chats)
- `splashDone`, `shop_wishlist`, `ezypay_phone_contacts`
- `chunk_reload`, `festival_*`, `dismissed_announcements`

After clearing, the app starts fresh — auth state comes from Supabase (not localStorage), balance fetches from DB, profile fetches from DB, etc.

### 2. Logic

```typescript
const CACHE_VERSION = "2";
const storedVersion = localStorage.getItem("app_cache_version");
if (storedVersion !== CACHE_VERSION) {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("app_cache_version", CACHE_VERSION);
}
```

This runs synchronously before `createRoot`, so the app always starts with clean state. Future version bumps just increment the constant.

## Files Changed

- `src/main.tsx` — Add cache version check + clear before React renders

