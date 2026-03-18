

## Problem

The "Chat" button on the product detail page navigates to `/inbox?conv={convId}`, but `/inbox` is not a registered route in `App.tsx`. The Inbox is rendered as a tab inside the Index page (when `activeTab === "inbox"`), not as a standalone page.

This same bug affects `MerchantDashboard.tsx` which also navigates to `/inbox`.

## Solution

Two navigation calls need to be fixed to use the tab-based routing pattern instead of a standalone `/inbox` route.

### 1. ProductDetailPage.tsx (line ~114)

Change:
```ts
navigate(`/inbox?conv=${convId}`);
```
To:
```ts
navigate(`/?tab=inbox&conv=${convId}`);
```

### 2. MerchantDashboard.tsx (line ~687)

Change:
```ts
onClick: () => navigate("/inbox")
```
To:
```ts
onClick: () => navigate("/?tab=inbox")
```

### 3. Index.tsx — Read URL params to set active tab and pass conv ID

The Index page needs to:
- Read `tab` search param on mount and set `activeTab` accordingly
- Read `conv` search param and pass it to `InboxPage` so it auto-opens the conversation

This requires adding a `useSearchParams` or `useLocation` hook to Index.tsx to parse the URL, then setting `activeTab` to the `tab` param value and forwarding `conv` to InboxPage.

### Files changed
- `src/pages/ProductDetailPage.tsx` — fix navigate path
- `src/pages/MerchantDashboard.tsx` — fix navigate path  
- `src/pages/Index.tsx` — read `tab` and `conv` URL params, set active tab, pass conv to InboxPage

