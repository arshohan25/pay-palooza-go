

## Fix Chat Navigation + Floating Merchant Chat Button

### Problem
1. Clicking "Chat" on product page still shows "Page not found" (user may be on cached/old version, but the code fix is already in place at line 114)
2. User wants the merchant chat button as a **floating button** on bottom-right, not embedded in the bottom action bar
3. User wants clear separation: **Shop chat = user→vendor**, **Inbox chat = user→user**

### Changes

#### 1. ProductDetailPage.tsx — Move chat to floating button
- Remove the `MessageCircle` button from the fixed bottom bar (line 520-524)
- Add a floating action button (FAB) positioned `fixed bottom-20 right-4` (above the bottom bar) with a chat icon, merchant online indicator dot, and pulse animation
- The FAB calls the same `handleChatWithMerchant` logic
- Hide FAB if the product belongs to the current user (`product.merchants?.user_id === user?.id`)

#### 2. Bottom bar simplification
- The bottom bar keeps only "Add to Cart" and "Buy Now" buttons, giving them more space

#### 3. No changes to InboxPage
- The Inbox already handles user-to-user P2P chat correctly
- Product inquiry messages from shop will continue to appear in the inbox with the product card bubble — this is expected behavior since the conversation thread lives in the same messaging system

### Technical detail
- The floating button will use `z-[60]` to sit above the bottom bar (`z-50`)
- Online status dot (green pulse) shown on the FAB when merchant is online
- Loading spinner replaces icon while `chattingWithMerchant` is true

