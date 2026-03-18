

## Plan: Complete Chat System — Shop Chat + Inbox Chat + Merchant FAB

This is a large feature set. The plan is organized into phases for clarity.

---

### Phase 1: Fix "Product not found" for unauthenticated users

**Root cause**: The `merchants` table only has a SELECT policy for `authenticated` role. The product page query uses `merchants!inner(...)`, so unauthenticated users get no results.

**Fix**: Add a public SELECT policy on the `merchants` table via migration:
```sql
CREATE POLICY "Public can read merchants for shop"
ON public.merchants FOR SELECT TO public USING (true);
```

---

### Phase 2: Product Page — Move Chat to Floating FAB

**File**: `src/pages/ProductDetailPage.tsx`

- Remove the `MessageCircle` button from the fixed bottom bar (line 520-524)
- Simplify bottom bar to only "Add to Cart" + "Buy Now" (equal width)
- Add a floating action button (FAB) at `fixed bottom-20 right-4 z-[60]`:
  - Round `w-14 h-14` circle, primary gradient, `MessageCircle` icon
  - Green pulsing dot when merchant is online
  - `Loader2` spinner during `chattingWithMerchant`
  - Hidden when `merchantUserId === user?.id` (own store)
  - Auto-sends system message: `"You are now chatting with [Shop Name]"` followed by the product inquiry card
  - Navigates to `/?tab=inbox&conv=${convId}`

---

### Phase 3: Merchant Dashboard — Floating Chat FAB

**File**: `src/pages/MerchantDashboard.tsx`

- Add a persistent FAB before the closing `</div>` of the main return (line ~469):
  - Position: `fixed bottom-6 right-4 z-[60]`
  - Style: `w-14 h-14` rounded-full, gradient background, shadow-lg
  - Icon: `MessageCircle` (white)
  - Red badge showing `totalUnread` count when > 0
  - On click: `navigate("/?tab=inbox")`
  - Only rendered when `isMerchant === true` (already guaranteed by the component)

---

### Phase 4: Enhance Chat Message Types & Status

**File**: `src/pages/InboxPage.tsx`

Already supports: text, money, voice, image, order, product bubble types. Already has read receipts (sent ✔, delivered ✔✔, seen 👁), typing indicators, online presence, message search, block/report, accept/reject requests.

**Additions**:
- Add file attachment support via attachment button (already has `Paperclip` icon imported but not wired):
  - Upload to Supabase Storage bucket
  - Send as `image` type message with `imageUrl` in metadata
  - Support for image/file picker via camera and gallery buttons
- Enhance the "Chat with Seller" system message to say: `"You are now chatting with [Shop Name]"`

---

### Phase 5: Admin Chat Monitoring

**File**: `src/components/admin/AdminSupportDashboard.tsx` (or new component)

- Add a "Chat Monitor" section to the admin dashboard that queries all `chat_conversations` and `chat_messages`
- Show: total active chats, flagged messages count, blocked users
- View all chats list with participant names and last message preview
- Block/unblock users from chat

This requires an admin RLS policy on `chat_conversations` and `chat_messages` for SELECT:
```sql
CREATE POLICY "Admins can view all chats"
ON public.chat_conversations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

---

### Summary of files changed

1. **Database migration** — Public SELECT on `merchants`, admin SELECT on `chat_conversations` + `chat_messages`
2. **`src/pages/ProductDetailPage.tsx`** — Extract chat from bottom bar to FAB, add system welcome message
3. **`src/pages/MerchantDashboard.tsx`** — Add floating chat FAB with unread badge
4. **`src/pages/InboxPage.tsx`** — Wire file/image attachment upload via Supabase Storage
5. **`src/components/admin/AdminChatMonitor.tsx`** (new) — Admin chat monitoring dashboard
6. **`src/pages/AdminDashboard.tsx`** — Add "Chat Monitor" tab entry

### What already exists (no changes needed)
- Real-time messaging via Supabase postgres_changes ✓
- Typing indicators ✓
- Online/offline presence ✓
- Read receipts (sent/delivered/seen) ✓
- Message search ✓
- Block/report user ✓
- Accept/reject message requests ✓
- Product inquiry bubble ✓
- Group chat ✓
- Encrypted messaging support ✓

