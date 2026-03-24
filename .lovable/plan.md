

## Plan: Show Greeting + Name in Dashboard Header

### What Changes

Replace the static "Dashboard" label in the admin dashboard header with a time-based greeting and the logged-in user's name (e.g., "Good Morning, Arif").

### Implementation

**File: `src/pages/AdminDashboard.tsx`**

1. Import `useProfile` hook (already exists at `@/hooks/use-profile`)
2. Add a greeting helper that returns "Good Morning", "Good Afternoon", or "Good Evening" based on current hour
3. Modify the two places where the header label is rendered (line 1009 for desktop, line 1096 for mobile):
   - When `activeTab === "overview"`: show `"{Greeting}, {Name}"` instead of "Dashboard"
   - For all other tabs: keep the existing label behavior unchanged

### Technical Details

- The `useProfile` hook returns `{ profile }` which contains `profile?.name`
- Fallback to "Admin" if no name is available
- Greeting logic: hour < 12 → Morning, hour < 17 → Afternoon, else → Evening
- Both desktop (`hidden lg:block`) and mobile header locations will be updated

### Files Modified
- `src/pages/AdminDashboard.tsx`

