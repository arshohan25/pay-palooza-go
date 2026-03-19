

## Open Chat Inline on Product Page

### What changes
**File: `src/pages/ProductDetailPage.tsx`**

Instead of navigating to `/?tab=inbox&conv=${convId}`, open the chat directly on the product page as a full-screen overlay (same pattern as MerchantDashboard's chat overlay).

### Implementation

1. **Add state**: `showInlineChat` (string | null) to hold the active conversation ID, plus local message state.

2. **Create an inline chat panel** rendered as an `AnimatePresence` overlay (`fixed inset-0 z-[70]`) containing:
   - Header with back button (closes overlay), customer/merchant name, online indicator
   - Product context banner (product name, price, emoji)
   - Messages list using `useChat().messages` + `openConversation()`
   - Input bar with send button
   - Uses the same `useChat` hook already imported

3. **Modify `handleChatWithMerchant`**:
   - After creating conversation and sending the inquiry message, instead of `navigate(...)`, set `showInlineChat` to the conversation ID
   - Call `openConversation(convId)` to load messages

4. **Chat overlay behavior**:
   - Back button sets `showInlineChat` to null (returns to product page)
   - Auto-scrolls to bottom on new messages
   - Typing indicator support via existing `useTypingIndicator` hook
   - Message bubbles with sent/delivered/read status (reuse same pattern from InboxPage/MerchantInbox)

5. **Imports to add**: `useTypingIndicator` from hooks, `Input` from ui

### Technical notes
- The `useChat` hook is already imported and provides `messages`, `openConversation`, `sendMessage`, `messagesLoading`
- Pattern mirrors MerchantDashboard's `MerchantInbox` overlay approach
- No navigation away from the product page — chat opens and closes in-place

