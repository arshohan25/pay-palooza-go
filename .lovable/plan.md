

## Persist Admin Dashboard Active Tab Across Refreshes

### Problem
The admin dashboard resets to the "overview" tab on every page refresh because `activeTab` is initialized with a hardcoded `"overview"` string in `useState`.

### Solution
Use the URL hash (e.g. `#loans`, `#insurance_mgmt`) to persist the active tab. On load, read the hash; on tab change, update the hash. This also makes tabs shareable via URL.

### Changes

**File: `src/pages/AdminDashboard.tsx`**

1. Replace the `activeTab` state initialization:
   ```typescript
   // Before
   const [activeTab, setActiveTab] = useState("overview");
   
   // After — read from URL hash
   const getInitialTab = () => {
     const hash = window.location.hash.replace('#', '');
     const valid = NAV_ITEMS.some(item => item.id === hash);
     return valid ? hash : "overview";
   };
   const [activeTab, setActiveTab] = useState(getInitialTab);
   ```

2. Add an effect to sync the hash when `activeTab` changes:
   ```typescript
   useEffect(() => {
     window.location.hash = activeTab;
   }, [activeTab]);
   ```

3. Optionally listen for `hashchange` events (browser back/forward).

### Files Modified
1. `src/pages/AdminDashboard.tsx` — persist tab via URL hash

