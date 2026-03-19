

## Fix: Separate Merchant Customer Chats from Personal Inbox Chats

### Problem
Both `MerchantInbox` and `InboxPage` use the same `useChat()` hook, which returns ALL conversations without distinguishing merchant-customer chats from personal user-to-user chats. This causes messages to appear mixed across both views.

### Root Cause
The `chat_conversations` table has no field to identify whether a conversation is a merchant inquiry or a personal chat. The `create_direct_chat_request` RPC creates the same type of conversation for both flows.

---

### Plan

#### Step 1: Add `metadata` column to `chat_conversations`
- Database migration: `ALTER TABLE chat_conversations ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb`
- This column will store context like `{"context": "merchant_inquiry", "merchant_id": "..."}`

#### Step 2: Update `create_direct_chat_request` RPC to accept optional metadata
- Modify the RPC to accept a `p_metadata jsonb DEFAULT '{}'::jsonb` parameter
- When creating a new conversation, store the metadata
- When reusing an existing conversation, update metadata if it was previously empty and new metadata is provided

#### Step 3: Update `ProductDetailPage.tsx` — tag merchant chats
- Pass metadata when calling `createDirectConversation`:
  ```
  { context: "merchant_inquiry", merchant_id: merchantId }
  ```
- Update `useChat.createDirectConversation` to accept optional metadata and pass it to the RPC

#### Step 4: Update `useChat` hook — expose conversation metadata
- Include `metadata` field in `ChatConversation` type
- Pass metadata through when loading conversations

#### Step 5: Update `MerchantInbox.tsx` — filter merchant-only conversations
- Filter conversations where `metadata?.context === "merchant_inquiry"` and the current user is the merchant
- This ensures only customer inquiries appear in the merchant inbox

#### Step 6: Update `InboxPage.tsx` — exclude merchant conversations
- Filter out conversations where `metadata?.context === "merchant_inquiry"` from the personal inbox
- Personal chats remain clean and separate from merchant business

---

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE public.chat_conversations 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
```

**Updated RPC signature:**
```sql
CREATE OR REPLACE FUNCTION public.create_direct_chat_request(
  p_other_user_id uuid, 
  p_metadata jsonb DEFAULT '{}'::jsonb
)
```

**Filtering logic (MerchantInbox):**
```typescript
const merchantChats = conversations.filter(conv => {
  const meta = conv.metadata as Record<string, unknown>;
  return meta?.context === "merchant_inquiry";
});
```

**Filtering logic (InboxPage):**
```typescript
const personalChats = conversations.filter(conv => {
  const meta = conv.metadata as Record<string, unknown>;
  return meta?.context !== "merchant_inquiry";
});
```

### Files to modify
- **Database**: 1 migration (add column + update RPC)
- `src/hooks/use-chat.ts` — add metadata to types, pass metadata in `createDirectConversation`
- `src/pages/ProductDetailPage.tsx` — pass merchant metadata when creating chat
- `src/components/MerchantInbox.tsx` — filter to merchant-only conversations
- `src/pages/InboxPage.tsx` — exclude merchant conversations

