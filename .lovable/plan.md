

## Fix Chat Error + Add Floating Merchant Chat Button

### Problem
The chat navigation fix (`/?tab=inbox&conv=...`) is in the preview code but may not be deployed to the published URL yet. Additionally, the user wants the merchant chat button as a **floating button** on the bottom-right instead of in the bottom action bar.

### Changes

#### 1. `src/pages/ProductDetailPage.tsx` — Move chat to floating FAB

**Remove** the chat button from the fixed bottom bar (lines 520-524), keeping only "Add to Cart" and "Buy Now".

**Add** a floating action button (FAB) positioned `fixed bottom-20 right-4 z-[60]`:
- Round circle with `MessageCircle` icon
- Green pulsing dot when merchant is online
- Hidden when viewing own store (`merchantUserId === user?.id`)
- Shows `Loader2` spinner while `chattingWithMerchant` is true
- Calls the same `handleChatWithMerchant` function

```text
Bottom bar (simplified):
┌─────────────────────────────┐
│  [Add to Cart]  [Buy Now]   │
└─────────────────────────────┘

Floating button (bottom-right):
                          ● ← green dot
                        [💬] ← FAB
```

#### 2. No other file changes needed

- `Index.tsx` already reads `?tab=inbox` and sets the active tab correctly
- `handleChatWithMerchant` already navigates to `/?tab=inbox&conv=${convId}`
- `InboxPage` already parses the `conv` URL param to auto-open conversations

### Chat Flow Rules (already implemented)
- **Shop chat** (user → vendor): Initiated via the floating FAB on product pages, sends product inquiry metadata, opens in Inbox
- **Inbox chat** (user → user): P2P messaging initiated from the Inbox tab with phone number search

### Technical Notes
- FAB uses `z-[60]` to sit above the bottom bar (`z-50`)
- The published URL needs to be re-published to pick up the navigation fix

