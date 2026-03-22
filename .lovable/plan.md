

## Persist Admin Dashboard Tab via URL Hash

### Problem
`activeTab` resets to `"overview"` on every page refresh because it's hardcoded in `useState("overview")`.

### Solution
Sync `activeTab` with `window.location.hash` so the current tab survives reloads and supports browser back/forward.

### Changes — `src/pages/AdminDashboard.tsx`

1. **Initialize from hash** (line 352):
   ```typescript
   const [activeTab, setActiveTab] = useState(() => {
     const hash = window.location.hash.replace('#', '');
     return NAV_ITEMS.some(i => i.id === hash) ? hash : "overview";
   });
   ```

2. **Sync hash on tab change** — add a `useEffect`:
   ```typescript
   useEffect(() => {
     window.location.hash = activeTab;
   }, [activeTab]);
   ```

3. **Listen for browser back/forward** — add a `hashchange` listener:
   ```typescript
   useEffect(() => {
     const onHash = () => {
       const hash = window.location.hash.replace('#', '');
       if (NAV_ITEMS.some(i => i.id === hash)) setActiveTab(hash);
     };
     window.addEventListener('hashchange', onHash);
     return () => window.removeEventListener('hashchange', onHash);
   }, []);
   ```

### Files Modified
1. `src/pages/AdminDashboard.tsx` — 3 small edits (state init + 2 effects)

