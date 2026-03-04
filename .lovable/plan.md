

## Real-Time Chat with DB Persistence, E2E Encryption, and WebRTC Calling

This is a large-scale feature that transforms the current mock-data Inbox into a fully database-backed real-time messaging system with peer-to-peer audio/video calls.

---

### Phase 1: Database Schema

Create three new tables:

**`chat_conversations`** — Stores conversation metadata (1-on-1 or group)
- `id`, `type` (enum: `direct`, `group`), `name` (nullable, for groups), `group_icon`, `admin_id`, `created_at`, `updated_at`

**`chat_participants`** — Maps users to conversations
- `id`, `conversation_id`, `user_id`, `joined_at`, `last_read_at`
- Unique constraint on `(conversation_id, user_id)`

**`chat_messages`** — Stores encrypted messages
- `id`, `conversation_id`, `sender_id`, `content` (encrypted text), `is_encrypted`, `is_deleted`, `expires_at`, `message_type` (text, money, voice, image, order), `metadata` (jsonb for amount/txnId/imageUrl/voiceDuration/etc.), `created_at`

RLS policies: participants can read/write messages in their conversations; users can only see conversations they belong to. Enable realtime on `chat_messages` and `chat_participants`.

### Phase 2: Core Chat Logic

**New hook: `src/hooks/use-chat.ts`**
- Loads user's conversations + participants from DB
- Subscribes to realtime INSERT on `chat_messages` for all user's conversations
- Provides `sendMessage()`, `createConversation()`, `createGroup()` functions
- Integrates existing `chatCrypto.ts` for E2E encryption per conversation
- Handles contact discovery via `profiles` table phone lookup

**Refactor `src/pages/InboxPage.tsx`**
- Replace `INITIAL_CONTACTS` mock data with DB-backed conversations from `use-chat`
- Contact list derived from `chat_participants` joined with `profiles`
- Messages loaded from `chat_messages` and decrypted client-side
- New contact creation → creates `chat_conversations` + `chat_participants` rows
- Group creation → same with `type = 'group'`
- All send operations write encrypted content to `chat_messages`
- Realtime subscription delivers incoming messages instantly
- Typing indicators via Supabase Presence (already partially implemented in SupportChat)
- Read receipts via `last_read_at` updates on `chat_participants`

### Phase 3: WebRTC Audio/Video Calling

**Signaling via Supabase Realtime Broadcast**
- Use Supabase Realtime broadcast channels (not DB) for call signaling
- Signal types: `call-offer`, `call-answer`, `ice-candidate`, `call-end`, `call-reject`
- No DB persistence needed for call signaling — ephemeral by nature

**New module: `src/lib/webrtc.ts`**
- `WebRTCManager` class handling:
  - `RTCPeerConnection` lifecycle with Google's free STUN servers (`stun:stun.l.google.com:19302`)
  - `getUserMedia()` for microphone and camera access
  - ICE candidate exchange via Supabase broadcast
  - SDP offer/answer negotiation
  - Media stream management (local + remote)
  - Mute/unmute, camera toggle, speaker toggle

**Update `CallingOverlay` component**
- Replace simulated 3-second auto-answer with real signaling
- Show actual remote audio/video stream
- Incoming call notification UI (ring + accept/reject buttons)
- Call duration timer from actual connection time

**New component: `src/components/IncomingCallOverlay.tsx`**
- Full-screen overlay when receiving a call
- Accept / Reject buttons
- Caller info display

**STUN/TURN considerations:**
- Google's free STUN server works for most cases (users on same network or simple NATs)
- For production reliability behind symmetric NATs, a TURN server would be needed (e.g., Twilio TURN — already have Twilio credentials)
- Initial implementation uses STUN only; can upgrade to TURN later

### Phase 4: Integration Points

- **BottomNav badge** — unread count from `chat_messages` where `created_at > last_read_at`
- **Notification** — incoming message triggers toast when not in chat view
- **Send Money integration** — existing `onSendMoney` callback writes a money-type message to DB after transfer
- **Contact Picker** — uses existing PermissionGate for contacts access

### Files

| Action | File |
|--------|------|
| **DB Migration** | New tables: `chat_conversations`, `chat_participants`, `chat_messages` + RLS + realtime |
| **New** | `src/hooks/use-chat.ts` — core chat data hook |
| **New** | `src/lib/webrtc.ts` — WebRTC manager |
| **New** | `src/components/IncomingCallOverlay.tsx` — incoming call UI |
| **Major Edit** | `src/pages/InboxPage.tsx` — replace mock data with DB + realtime |
| **Edit** | `src/components/BottomNav.tsx` — unread badge from DB |

### Limitations & Notes

- WebRTC media streaming is peer-to-peer and works best on modern browsers. Safari has some quirks.
- Without a TURN server, calls may fail for users behind strict corporate firewalls or symmetric NATs. STUN handles ~85% of real-world cases.
- Group calls are significantly more complex (require SFU architecture) — this plan covers 1-on-1 calls only.
- E2E encryption keys are stored in localStorage per conversation, meaning they don't transfer across devices.

