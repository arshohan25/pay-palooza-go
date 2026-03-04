

## Plan: Fix Chat Encryption, Profile Visibility, and Calling Issues

### Problems Identified

1. **"Unable to decrypt message"** — E2E encryption uses `getOrCreateConversationKey()` which generates a random AES key and stores it in `localStorage`. Each device generates its own independent key, so User A encrypts with Key-A but User B has Key-B and cannot decrypt. The keys are never shared between devices.

2. **"Unknown" name & no phone number** — When loading conversation participants, the code queries `profiles` table for other users' data (line 115-118 in use-chat.ts). But RLS on `profiles` only allows `Users can view own profile` (`auth.uid() = user_id`). So the query returns nothing for other participants, resulting in "Unknown" names and missing phone numbers.

3. **Calling** — The WebRTC signaling works via Supabase Broadcast, but the call UI shows "Unknown" for the same profile visibility reason above.

### Solution

#### 1. Fix encryption: disable E2E for cross-device compatibility
Since there's no secure key exchange mechanism (no public-key infrastructure), the symmetric key approach is fundamentally broken across devices. The simplest fix is to **send messages as plaintext** (remove encryption on send) while keeping the decrypt fallback for old encrypted messages. This makes messages readable by all participants.

**File: `src/hooks/use-chat.ts`**
- In `sendMessage`: stop encrypting — store `content` as plaintext with `is_encrypted: false`
- Keep `tryDecryptMessage` in `openConversation` and realtime handler as fallback for previously encrypted messages

#### 2. Fix profile visibility: new RPC to fetch chat participant profiles
Create a `SECURITY DEFINER` function that returns profile data (name, phone, avatar_url) for users who share a conversation with the caller. This bypasses RLS safely.

**Database migration:**
```sql
CREATE OR REPLACE FUNCTION public.get_chat_participant_profiles(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, name text, phone text, avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only return profiles of users who share at least one conversation with the caller
  RETURN QUERY
  SELECT DISTINCT p.user_id, p.name, p.phone, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids)
    AND p.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.chat_participants cp1
      JOIN public.chat_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid() AND cp2.user_id = p.user_id
    );
END;
$$;
```

**File: `src/hooks/use-chat.ts`**
- Replace the direct `profiles` table query (line 115-118) with an RPC call to `get_chat_participant_profiles`

#### 3. Fix calling: ensure contact info is passed correctly
The calling overlay already uses `contact.name` and `contact.phone` from the UI contact object. Once profile visibility is fixed (point 2), the name/phone will populate correctly, fixing the "Unknown" label during calls.

### Files to Change
- **New migration**: `get_chat_participant_profiles` RPC function
- **Edit**: `src/hooks/use-chat.ts` — replace profile query with RPC call; remove message encryption on send
- **Edit**: `src/pages/InboxPage.tsx` — no changes needed (it derives from hook data)

### Summary of Changes
- Messages will be sent as plaintext going forward (old encrypted messages still attempt decryption as fallback)
- Other users' names and phone numbers will be visible via a secure RPC that validates shared conversation membership
- Call overlays will show correct names once profiles load properly

