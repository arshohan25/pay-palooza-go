

# Fix: Chat "Add by Phone" and Request System

## Problem
Console error reveals the root cause:
```
PGRST203: Could not choose the best candidate function between:
  public.create_direct_chat_request(p_other_user_id => uuid)
  public.create_direct_chat_request(p_other_user_id => uuid, p_metadata => jsonb)
```

Two overloaded versions of `create_direct_chat_request` exist in the database. PostgREST cannot disambiguate between them when called via the Supabase JS client, causing every chat creation attempt to fail silently.

## Fix

### 1. Database migration -- merge the two functions into one
Drop both overloaded functions and create a single function with `p_metadata` as an optional parameter (defaulting to `NULL`):

```sql
DROP FUNCTION IF EXISTS public.create_direct_chat_request(uuid);
DROP FUNCTION IF EXISTS public.create_direct_chat_request(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.create_direct_chat_request(
  p_other_user_id uuid,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid ...
```

The function body stays the same -- create conversation, add participants, send notification. If `p_metadata` is not null, store it on the conversation.

### 2. Client code -- always pass p_metadata
**File**: `src/hooks/use-chat.ts` (line ~533-541)

Update `createDirectConversation` to always pass both parameters to avoid ambiguity:
```typescript
const { data, error } = await supabase.rpc(
  "create_direct_chat_request" as any,
  { p_other_user_id: otherUserId, p_metadata: metadata ?? null }
);
```

## Summary
- 1 database migration (merge overloaded functions)
- 1 file edit (`src/hooks/use-chat.ts`)

