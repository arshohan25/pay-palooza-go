## Plan: Clean Up Old Encrypted Messages

### Problem

Old version of app still showing like logo not updating old demo chats etc still alive. Fix it and it should not appear here again 

Old messages were encrypted with device-local AES keys that can never be shared between participants. After the last fix, instead of showing "🔒 Unable to decrypt", they now show raw base64 ciphertext gibberish — which is worse.

### Solution (2 changes)

#### 1. Database migration: bulk-fix old encrypted messages

Run a single UPDATE to set all `is_encrypted = true` messages to `is_encrypted = false` and replace their unrecoverable ciphertext content with a friendly placeholder.

```sql
UPDATE public.chat_messages
SET is_encrypted = false,
    content = '[Old message]'
WHERE is_encrypted = true;
```

This permanently fixes all existing garbled messages in the database.

#### 2. Defensive fallback in `tryDecryptMessage` (`src/lib/chatCrypto.ts`)

If a message is marked encrypted and decryption fails, return `"[Old message]"` instead of the raw base64 content, as a safety net for any edge cases.

### Files

- **New migration**: Bulk update old encrypted messages
- **Edit**: `src/lib/chatCrypto.ts` — return friendly placeholder on decryption failure