

## Fix Shop Chat + Floating Merchant Chat Button

### Problem
1. The "Chat with Seller" button in the product page bottom bar still causes errors for some users
2. User wants the chat button as a **floating action button (FAB)** on bottom-right, not in the bottom bar
3. Need clear separation: **Shop Chat = User→Vendor** (product context), **Inbox Chat = User→User** (general P2P)
4. Merchant dashboard needs a **floating chat FAB** with unread badge for managing customer inquiries

### Changes

#### 1. `src/pages/ProductDetailPage.tsx` — Move chat to floating FAB

**Remove** the chat `Button` from the fixed bottom bar (lines 520-524). The bottom bar keeps only "Add to Cart" and "Buy Now" with equal space.

**Add** a floating action button before the bottom bar:
```text
Position: fixed bottom-20 right-4 z-[60]
Style: w-12 h-12 rounded-full bg-primary shadow-lg
Icon: MessageCircle (white)
Online dot: absolute -top-0.5 -right-0.5 green pulse
Loading: Loader2 spinner when chattingWithMerchant
Hidden when: merchantUserId === user?.id (own store)
onClick: handleChatWithMerchant (same existing logic)
```

#### 2. `src/pages/MerchantDashboard.tsx` — Add floating chat FAB

Add a floating chat button at `fixed bottom-6 right-4 z-[60]`:
- Round circle with `MessageCircle` icon
- Red badge showing `totalUnread` count when > 0
- On click: `navigate("/?tab=inbox")`
- Always visible on merchant dashboard

#### 3. No backend or database changes needed

The existing `use-chat.ts` hook, `createDirectConversation`, `InboxPage`, and tab-based routing (`/?tab=inbox&conv=`) are all working correctly. The navigation fix from the previous edit is already in place (line 114 of ProductDetailPage already has `/?tab=inbox`).

### Chat Flow Rules (already implemented, no changes needed)
- **Shop Chat (User→Vendor)**: FAB on product page → creates direct conversation with merchant → sends product inquiry card → opens in Inbox tab
- **Inbox Chat (User→User)**: Started from Inbox tab search by phone number → general P2P messaging

### Files changed
- `src/pages/ProductDetailPage.tsx` — Extract chat button from bottom bar into floating FAB
- `src/pages/MerchantDashboard.tsx` — Add floating chat FAB with unread badge

