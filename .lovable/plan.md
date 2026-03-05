

## Analysis of Call Issues

After reviewing the code, I identified three root causes:

### Issue 1: Receiver not getting the call
The `WebRTCManager` subscribes to a Supabase Realtime Broadcast channel per conversation. However, the receiver's manager is created **only when `InboxPage` is mounted and conversations are loaded**. If the receiver hasn't opened InboxPage yet, or the channel subscription isn't ready, the broadcast signal is lost because **Broadcast is ephemeral** — there's no persistence. Also, the `onIncomingCall` handler uses `setCallMode` in a functional update but returns `null` (not the incoming mode), so the call overlay shows but `callMode` stays null, which can cause the overlay to not render.

### Issue 2: No ringing sound
There is no ringtone sound implemented. `sounds.ts` has chat notification and request sounds, but no call ringing sound. When a call-offer arrives, `setIncomingCall` is called but no audio is played. Similarly, the caller hears no ringback tone.

### Issue 3: End button not working
`handleEndCall` calls `webrtcManager?.endCall()` and sets `callMode(null)`. The `CallingOverlay` also has its own `handleEnd` that calls `webrtc?.endCall()` then `onEnd()`. The problem: `endCall()` calls `cleanup()` which sets state to `"ended"`, which triggers `onCallStateChange` → `onEnd()` in the overlay → which calls `handleEndCall` again → but `webrtcManager` may already be cleaned up. The real issue is that `cleanup()` stops all tracks and closes the PC, but the broadcast of `"call-end"` happens **before** cleanup — so that part works. The end button likely fails because after `endCall()`, the `CallingOverlay`'s `useEffect` fires `onEnd` (due to state change to "ended"), but the component may already be unmounting. Also, the `handleEndCall` sets `callMode(null)` but doesn't clear `incomingCall`, potentially leaving stale state.

## Plan

### 1. Add ringing/ringback sounds to `src/lib/sounds.ts`
- Add `playRingtone()` — a repeating pleasant ring tone using Web Audio API oscillators (looping interval)
- Add `stopRingtone()` — stops the ringing
- Add `playRingbackTone()` — subtle "ring-ring" for the caller while waiting

### 2. Fix incoming call handling in `src/pages/InboxPage.tsx`
- When `incomingCall` is set, start playing the ringtone sound
- When call is accepted or rejected, stop the ringtone
- When the caller initiates a call, play ringback tone; stop on connect/end
- Fix `handleEndCall` to also clear `incomingCall` state and stop all sounds
- Ensure `callMode` is properly not set to null in the `setCallMode` functional update when an incoming call arrives (currently returns `null` which is correct for "not yet accepted" but then the `CallingOverlay` won't show since it checks `callMode`)

### 3. Fix end call flow
- In `CallingOverlay`, the `handleEnd` function calls both `webrtc.endCall()` and `onEnd()`. But `endCall()` triggers state change to "ended", which via `onCallStateChange` also calls `onEnd()`. This double-call is the bug.
- Fix: Remove `onEnd()` from the explicit `handleEnd` click — let it only be triggered via the state change callback. OR remove the state change callback trigger and rely only on the explicit click.
- In `handleEndCall`, ensure both `callMode` and `incomingCall` are cleared, and stop any ringing sounds.

### 4. Improve reliability of incoming call detection
- Add a global notification sound trigger when `incomingCall` state changes to non-null
- Ensure `webrtcManager` is set when incoming call arrives on a non-active conversation by updating `activeContactId` first (already done in existing code)

### Files to modify:
- **`src/lib/sounds.ts`** — Add ringtone and ringback tone functions
- **`src/pages/InboxPage.tsx`** — Wire up sounds, fix end call double-trigger, clear all state on end
- **`src/components/IncomingCallOverlay.tsx`** — Add auto-play ringtone on mount, stop on unmount

