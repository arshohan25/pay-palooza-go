

## Add "Chat with Merchant" on Product Detail Page

### Problem
Buyers have no way to contact the vendor directly from the product page to ask questions before purchasing.

### Solution
Add a "Chat" button in the vendor row on the product detail page. Tapping it creates (or opens) a direct conversation with the merchant and navigates to the Inbox page with that conversation active. The product name/link is sent as the first message for context.

### Changes

**File: `src/pages/ProductDetailPage.tsx`**

1. Import `MessageCircle` from lucide-react and `useChat` hook
2. Extract `merchant_user_id` from the already-fetched `product.merchants.user_id`
3. Add a "Chat" button next to "Visit Store" in the vendor row (lines 270-286)
4. On click:
   - Guard: require auth (show toast if not logged in)
   - Guard: prevent chatting with yourself (if buyer is the merchant)
   - Call `createDirectConversation(merchantUserId)` to get/create a conversation
   - Send an automatic context message: "Hi, I'm interested in [Product Name] (৳price)"
   - Navigate to `/inbox` (the chat page will show the new conversation)

The existing `createDirectConversation` RPC handles deduplication — if a conversation already exists, it returns the existing one.

### Files
- **Modified**: `src/pages/ProductDetailPage.tsx` — add Chat button in vendor row

