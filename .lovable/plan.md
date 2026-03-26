

# Performance Optimization Plan

## Identified Issues

1. **Excessive `auth/v1/user` calls**: Network logs show 6+ duplicate auth user requests on a single page load. Every hook independently calls `supabase.auth.getSession()`, causing redundant network requests.

2. **Heavy animation library on critical path**: `framer-motion` is imported eagerly in Index.tsx, BalanceCard, QuickActions, TransactionList. AnimatePresence wraps tab transitions causing unnecessary re-renders.

3. **QuickActions imports @dnd-kit eagerly** (618 lines): Drag-and-drop library loads on every home page visit even when user isn't reordering.

4. **FestivalBodyEffect canvas animation**: Runs a full canvas animation with rockets/sparks on every page load when a festival theme is active, consuming CPU.

5. **Multiple realtime channels opened simultaneously**: account-lock, balance-realtime, txn-realtime all set up independently with separate auth checks.

6. **Embla carousel in PromoSlider**: Loaded eagerly with auto-play interval.

7. **TransactionList re-fetches on every `refreshKey` change** plus realtime — double-fetching pattern.

## Optimization Plan

### 1. Deduplicate auth calls with cached session
**File**: `src/hooks/use-auth.ts`
- Cache the session/user in a module-level variable so other hooks can import `getCachedUser()` synchronously instead of calling `supabase.auth.getSession()` repeatedly.
- Export a `getCachedSession()` helper.

**Files**: `src/hooks/use-transactions.ts`, `src/lib/balanceStore.ts`
- Replace `supabase.auth.getSession()` calls with `getCachedSession()` from use-auth.

### 2. Lazy-load @dnd-kit in QuickActions
**File**: `src/components/QuickActions.tsx`
- Split the DnD reorder mode into a separate lazy-loaded component. The default grid renders without importing @dnd-kit at all.
- Only import DndContext/SortableContext when user enters edit mode.

### 3. Simplify tab transitions
**File**: `src/pages/Index.tsx`
- Remove the `AnimatePresence mode="wait"` wrapper around `mainContent()` (lines 351-362). Use a simple CSS transition or no animation. This eliminates expensive exit/enter animations on every tab switch.

### 4. Throttle FestivalBodyEffect
**File**: `src/components/FestivalBodyEffect.tsx`
- Add a `sessionStorage` flag so the fireworks animation only plays once per session, not on every re-render/navigation.

### 5. Reduce redundant re-renders in BalanceCard
**File**: `src/components/BalanceCard.tsx`
- Wrap with `React.memo` to prevent re-renders from parent state changes (20+ state variables in Index).

### 6. Memoize mainContent in Index
**File**: `src/pages/Index.tsx`
- The `mainContent()` function is defined inline and recreated every render. Extract tab content into memoized components or use `useMemo` keyed on `activeTab` + `refreshKey`.

### 7. Reduce network waterfall
**File**: `src/pages/Index.tsx`
- The home tab loads AppHeader, PlatformBanner, FestivalOverlay, BalanceCard, QuickActions, PromoSlider, TransactionList — each triggering independent DB queries. Batch the critical ones (balance + transactions + profile) into a single RPC or parallel Promise.all.

## Summary of Changes
- **7 files modified**: use-auth.ts, use-transactions.ts, balanceStore.ts, QuickActions.tsx, Index.tsx, FestivalBodyEffect.tsx, BalanceCard.tsx
- **Expected impact**: ~50% fewer network requests on load, significantly reduced JS parse/execute time from lazy @dnd-kit, smoother tab switching, single-session fireworks

