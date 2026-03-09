

## Fix Install Button Not Working

### Root Cause

The install button relies on the browser's `beforeinstallprompt` event to capture a deferred prompt. There are two problems:

1. **The `beforeinstallprompt` event fires early** — typically before the user navigates to `/install/:role`. By the time the RoleInstallPage mounts and registers its listener, the event has already fired and been consumed by the VitePWA service worker or the `InstallPrompt` component (which also listens for the same event and calls `e.preventDefault()`).

2. **Manifest swap timing** — The page swaps the manifest `<link>` after mount, but the browser may have already evaluated installability using the default manifest. The `beforeinstallprompt` event won't re-fire just because the manifest href changed.

### Fix Plan

**1. Remove competing listener in `InstallPrompt.tsx`**
- The `InstallPrompt` component globally captures `beforeinstallprompt` and prevents it from reaching the role install page. When the user is on `/install/*`, `InstallPrompt` should not intercept the event.

**2. Store the deferred prompt globally** so any page can use it:
- Create a small global store (`src/lib/installPromptStore.ts`) that captures the `beforeinstallprompt` event once at app startup and exposes it.
- Both `InstallPrompt.tsx` and `RoleInstallPage.tsx` consume from this store instead of independently listening.

**3. Wire up the install page to use the global store**
- `RoleInstallPage` reads the deferred prompt from the store. The install button calls `prompt()` on it.
- After manifest swap, if the prompt is available, show the install button immediately.

### Files to Change

| File | Change |
|---|---|
| `src/lib/installPromptStore.ts` | **New** — global capture of `beforeinstallprompt` event, exports `getInstallPrompt()`, `onPromptAvailable(cb)`, and `clearPrompt()` |
| `src/main.tsx` | Register the global `beforeinstallprompt` listener at app boot (before React renders) |
| `src/pages/RoleInstallPage.tsx` | Use the global store instead of local `addEventListener`. Remove local `beforeinstallprompt` listener |
| `src/components/InstallPrompt.tsx` | Use the global store. Skip showing the banner when on `/install/*` routes |

### How the Global Store Works

```text
main.tsx (app boot)
  └─ captures beforeinstallprompt → stores in installPromptStore
       ├─ InstallPrompt reads it (skips on /install/* routes)
       └─ RoleInstallPage reads it (always available)
```

This ensures the deferred prompt is never lost, regardless of which component mounts first.

