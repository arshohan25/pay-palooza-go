

## Verification: Customer-to-Merchant Chat Flow

### Status: **Working correctly — no fixes needed**

After thorough inspection of the entire flow, here's what I verified:

---

### Flow Walkthrough

1. **Product Page FAB** (`ProductDetailPage.tsx`): Customer taps the floating chat button → calls `createDirectConversation(merchantUserId)` which invokes the `create_direct_chat_request` RPC
2. **RPC Logic**: The `create_direct_chat_request` function either reuses an existing direct conversation between the two users or creates a new one with `status: 'pending'`. It also sends a notification to the merchant.
3. **Auto Product Message**: After conversation creation, a product inquiry message is sent with metadata (`isProductInquiry: true`, product name, price, image)
4. **Navigation**: Customer is redirected to `/?tab=inbox&conv={convId}` which opens the user-side InboxPage with the conversation auto-opened via deep-link handling
5. **Merchant Side**: MerchantInbox reads the same `useChat()` hook, showing all conversations where the merchant is a participant. Product inquiries are tagged with metadata and shown with product context banners and filters.

### What's Verified ✓

- **Conversation creation**: RPC correctly creates a direct conversation between customer and merchant only (not broadcast)
- **Deduplication**: If customer already has a conversation with the merchant, it reuses the existing one
- **Product metadata**: Properly attached as message metadata and displayed on both sides
- **Deep-linking**: `/?tab=inbox&conv=` correctly parsed by InboxPage to auto-open the conversation
- **Merchant inbox filtering**: Product inquiries are correctly identified by `isProductInquiry` metadata flag
- **Online presence**: Merchant online status shown via green pulsing dot on the FAB
- **Real-time**: Both `chat_messages` and `chat_conversations` are in `supabase_realtime` publication
- **RLS**: Chat participants can only access their own conversations via `is_chat_participant` security definer function

### No changes required

The customer-to-merchant chat is correctly isolated to a 1:1 direct conversation. The merchant sees only conversations they're a participant in, and product context is properly carried through the entire flow.

