

## Plan: Add "Currently Online" Support Agents Indicator

### What Changes

**Single file: `src/components/admin/AdminSupportDashboard.tsx`**

**1. Add state and periodic fetch for online agents**
- Add `onlineAgents` state (array of `{ user_id, display_name, open_count }`)
- Use the existing `getAvailableAgents()` from `useAgentRouting` (already destructured but not used directly — will add it to the destructured return)
- Fetch on mount and refresh every 30 seconds via `setInterval`
- Also re-fetch when conversations change (to update open_count)

**2. Render an "Online Agents" collapsible strip**
- Place it between the header title/tabs and the conversation list (after line ~568, before `<ScrollArea>`)
- Show a compact horizontal strip with:
  - Green dot + "X agents online" summary
  - Each agent as a small pill: `[green dot] Name (3 chats)` showing their `display_name` and `open_count`
- If no agents online: show a yellow warning pill "No agents online"
- Collapsed by default, expandable with a chevron toggle to save space

**3. Wire `getAvailableAgents` from existing hook**
- Already available via `useAgentRouting()` — just add it to the destructured return on line 111

### Technical Details
- No new dependencies, hooks, or database changes needed
- `getAvailableAgents()` already queries `team_members` (department=support, is_available=true) and counts open conversations per agent — exactly what's needed
- Polling interval of 30s keeps data fresh without overloading
- The strip is ~40px tall collapsed, expands to show individual agent pills

