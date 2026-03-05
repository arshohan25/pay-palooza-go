

## Plan: Redesign Inbox UI — Modern, Clean, Feature-Rich

### Overview
Completely overhaul the InboxPage with a modern messaging UI: tighter spacing, cleaner conversation list, improved chat view, and new working features (message search, swipe-to-delete, delivery status in list, story-like online avatars, pinned conversations, message forwarding).

### Changes to `src/pages/InboxPage.tsx` (single file, ~1680 lines)

#### 1. Modernize Conversation List Header
- Replace plain "Messages" title with a sleek header including user avatar, title, and action buttons
- Add a segmented filter: **All | Unread | Groups** tabs above the list
- Tighten vertical spacing (remove excess `mb-5`, `mb-4` gaps)

#### 2. Redesign Conversation List Items
- Remove the heavy `border` + `shadow-card` on every item — use a clean divider-based layout instead
- Add last message sender indicator ("You: ...") for sent messages
- Show delivery status icon (check/double-check) next to last message for sent messages
- Add swipe-to-archive gesture (using existing framer-motion drag)
- Display typing indicator inline in the conversation preview ("typing...")
- Make online indicator a ring around the avatar instead of a small dot

#### 3. Online Users Horizontal Scroll (Stories-style)
- Add a horizontal scrollable row of online contacts with glowing green ring avatars at the top of the list (below search)
- Tapping an online user opens their chat directly

#### 4. Improve Search Bar
- Add a search icon inside the input
- Add "Cancel" button when search is focused
- Search through message content, not just contact names

#### 5. Modernize Chat View Header
- Cleaner, less bulky header with subtle background blur instead of full gradient fill
- Smaller, more refined action buttons
- Remove excess padding (`pt-12` → `pt-safe` with proper safe area)

#### 6. Improve Chat Input Bar
- Add attachment menu (expandable: camera, gallery, document, location)
- Remove excess bottom padding
- Better visual separation with subtle top border

#### 7. New Working Features
- **Message deletion**: Long-press menu adds "Delete for me" option that marks `is_deleted` in DB
- **Copy message text**: Long-press menu adds "Copy" option
- **Message forwarding**: Long-press menu adds "Forward" to select another conversation
- **Pinned conversations**: Pin a conversation to always appear at the top of the list (stored in localStorage)

#### 8. Empty State Improvement
- More engaging empty state with illustration-style icon and call-to-action button
- Animate the empty state entrance

#### 9. Fix Spacing Issues
- Remove redundant `space-y-0` on container
- Reduce gap between search and list from `mb-4` to `mb-2`
- Tighten conversation item padding from `p-3` to `px-4 py-3`
- Fix chat view safe area (replace hardcoded `pt-12` with dynamic safe-area-inset)
- Reduce message bubble spacing from `space-y-3` to `space-y-2`

### Technical Notes
- All changes are in `src/pages/InboxPage.tsx` (UI-only and localStorage for pins)
- Message deletion will call existing `supabase` update on `chat_messages.is_deleted`
- No database migrations needed — uses existing schema fields
- Filter tabs use client-side filtering on existing `conversations` data

