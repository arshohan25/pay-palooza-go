

## Fix: Infinite Loading on Orders Pages When Not Authenticated

### Problem
`CustomerOrdersPage` and `OrderDetailPage` both initialize `loading = true` and only set it to `false` inside a `useEffect` that exits early when `user` is null. This means unauthenticated visitors see skeleton loaders forever.

### Solution
In both components, add an early exit from loading state when `useAuth()` finishes loading with no user. Two changes per file:

**1. `src/pages/CustomerOrdersPage.tsx`**
- Import `loading` from `useAuth()` as `authLoading`
- Add a second `useEffect`: when `authLoading` is false and `user` is null, set `loading(false)`
- In the render, when `!loading && !user`, show a "Please log in to see orders" message instead of empty state

**2. `src/pages/OrderDetailPage.tsx`**
- Same pattern: detect when auth is done but no user, and show "Please log in" instead of infinite skeletons

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/CustomerOrdersPage.tsx` | Add auth-loading guard, show login prompt |
| `src/pages/OrderDetailPage.tsx` | Add auth-loading guard, show login prompt |

Both are small edits (add ~8 lines each). No new files needed.

