

## Plan: Redesign Inbox Chat UI — Modern & Dynamic

### Overview
Modernize the inbox conversation list and chat view with better spacing, cleaner layout, and a more dynamic feel. Remove visual clutter and tighten/loosen spacing where needed.

### Changes to `src/pages/InboxPage.tsx`

#### 1. Conversation List (Lines 1497-1695)
- **Header**: Increase top padding, make title larger (`text-xl`), add subtle bottom border, more breathing room between avatar and text
- **Search bar**: Add proper vertical margin (`mb-3` instead of `mb-2`), slightly taller (`h-10`), rounded-xl instead of rounded-full for modern look
- **Filter tabs**: Add more gap between tabs (`gap-2`), increase pill padding (`px-4 py-1.5`), add `mb-3` for spacing below
- **Online stories bar**: Add `mb-3` and proper padding
- **Conversation items**: 
  - Increase row height with `py-3` (was `py-2.5`)
  - Make avatars `w-13 h-13` (slightly larger) with proper gap-3.5
  - Add rounded hover state (`rounded-xl`)
  - Name font size bump to `text-sm` (was `text-[13.5px]`)
  - Last message size `text-[12.5px]`
  - Remove the `space-y-0` and add proper dividers with more left margin
- **Remove**: "Long press a chat to pin or manage" hint text (unnecessary)
- **Empty state**: Add more vertical padding

#### 2. Chat View (Lines 899-1215)
- **Header**: 
  - Increase avatar to `w-10 h-10` (was `w-9 h-9`)
  - More padding (`px-4` instead of `px-3`)
  - Increase name font size, add gap-3
  - Action buttons slightly larger (`w-9 h-9`)
- **Remove E2E banner**: It takes space and adds clutter — remove the "Messages are end-to-end encrypted" bar entirely
- **Messages area**: 
  - Increase padding (`px-4 py-4`), more gap between messages (`space-y-3` instead of `space-y-2`)
  - Bubble text size `text-sm` (was `text-[13.5px]`)
  - More bubble padding (`px-4 py-3` instead of `px-4 py-2.5`)
- **Input bar**: 
  - More padding (`px-4` instead of `px-3`)
  - Taller input area with `py-2` instead of `py-1.5`
  - Slightly larger send/mic buttons (`w-10 h-10`)
  - Input field `text-sm` with proper height

#### 3. Message Bubbles (Lines 491-625)
- Increase max-width to `max-w-[80%]`
- Add more breathing room between time/read receipt and bubble (`mt-1` instead of `mt-0.5`)
- Larger time text (`text-[11px]` instead of `text-[10px]`)

### Files modified
- `src/pages/InboxPage.tsx` — spacing and styling updates throughout

