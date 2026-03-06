

## Plan: Fix Chat UI Issues

### Issues
1. **"[Old message]" still showing as bubbles** — The exact string match `msg.text === "[Old message]"` may not catch all variants (extra whitespace, different casing). Change to a more robust check using `.includes()` or `.trim()`.
2. **Compose box needs bottom spacing** — Currently `pb-[env(safe-area-inset-bottom,8px)]` gives only 8px fallback. Increase to `pb-4` minimum plus safe-area.
3. **"Previous message unavailable" centered awkwardly** — Should align with the sender's side rather than centered.

### Changes to `src/pages/InboxPage.tsx`

#### 1. Fix "[Old message]" detection (line ~572)
- Change `msg.text === "[Old message]"` to `msg.text.trim() === "[Old message]"` or use `.includes("[Old message]")` for robustness
- Also filter these out from the conversation list's `lastMsg` preview

#### 2. Add bottom padding to compose box (line 1129)
- Change `pb-[env(safe-area-inset-bottom,8px)]` to `pb-4` with an additional safe-area wrapper, e.g. `pb-[max(16px,env(safe-area-inset-bottom,16px))]`

#### 3. Style "Previous message unavailable" better
- Instead of centering, render as a small muted bubble aligned to the sender's side, consistent with the chat flow

### Files modified
- `src/pages/InboxPage.tsx`

