
Goal: fix the end-call flow so tapping the red End button always terminates the call once (no recursion, no rate-limit flood), and restores normal calling reliability.

What I found
- Current loop is: End button → `handleEndCall()` → `webrtcManager.endCall()` → `setState("ended")` → overlay `onCallStateChange("ended")` → `onEnd()` → `handleEndCall()` again.
- That recursive loop matches your runtime errors (`Maximum call stack size exceeded`) and repeated broadcast 429s.
- Those repeated `call-end` sends are also likely why later calls fail to reach the other person (signaling gets rate-limited).

Implementation plan
1) Harden call termination in `src/lib/webrtc.ts`
- Make terminal transitions idempotent:
  - `setState()` should no-op if state is unchanged.
  - `endCall()` should return early if already ending/ended.
  - Ignore duplicate incoming `call-end` / `call-reject` once terminal.
- Keep cleanup safe to run once.

2) Separate “signal end” from “UI cleanup” in `src/pages/InboxPage.tsx`
- In `CallingOverlay`, End button should trigger only `webrtc?.endCall()` (signal + RTC teardown).
- Keep `onCallStateChange("ended")` responsible for UI closure (`onEnd()`).
- Update parent `handleEndCall` to be cleanup-only:
  - stop call sounds
  - clear `callMode`
  - clear `incomingCall`
  - do not call `webrtcManager.endCall()` again

3) Add defensive error handling on the local End action
- Wrap end action in `try/catch` at click path to prevent UI lock if signaling throws.
- Log and safely still clear UI state.

4) Prevent callback leakage
- On overlay unmount, clear timer and detach/neutralize call-state callback so stale callbacks cannot re-trigger end logic after unmount/remount.

Validation plan
1. Connected call: tap End once → both sides close once, no stack overflow, no repeated `call-end`.
2. Ringing call: caller cancels before answer → receiver overlay dismisses once.
3. Remote hang-up: local UI closes without sending another `call-end`.
4. Console/network check: no recursive warnings, no 429 burst on `/realtime/.../broadcast`.

Files to update
- `src/lib/webrtc.ts`
- `src/pages/InboxPage.tsx` (both `CallingOverlay` and parent end-call handler)
