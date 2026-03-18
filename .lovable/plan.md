

## Show Merchant Online/Offline Status on Product Detail Page

### Approach
Use the existing `useOnlinePresence` hook to check if the merchant is online, and display a green/gray dot indicator next to the vendor name in the vendor row.

### Changes

**File: `src/pages/ProductDetailPage.tsx`**

1. Import `useOnlinePresence` from `@/hooks/use-online-presence`
2. Call `useOnlinePresence(user?.id ?? null)` to join the presence channel and get `isOnline`
3. In the vendor row (line ~310-313), add a status dot next to the store icon or vendor name:
   - Green pulsing dot + "Online" text when `isOnline(product.merchants.user_id)` is true
   - Gray dot + "Offline" text when false
4. The dot will be a small `span` with conditional `bg-green-500 animate-pulse` or `bg-muted-foreground/40` classes

This is a minimal change — the presence hook already handles all the realtime tracking and visibility state. No new files or database changes needed.

### Files
- **Modified**: `src/pages/ProductDetailPage.tsx` — import presence hook, add online/offline indicator in vendor row

