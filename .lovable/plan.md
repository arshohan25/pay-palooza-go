

## Plan: Block/Report on Decline + Message Preview for Pending Requests

### Changes

#### 1. Conversation List — Show sender's first message preview (InboxPage.tsx)
The `lastMsg` field on `UIContact` already shows the last message content. For pending conversations, this naturally shows the sender's first message since that's the only message. The existing rendering at line 1472 already displays this. **No change needed** for the list preview — it already works.

However, I'll add a visual enhancement: for pending requests in the conversation list, show a small message preview with a quote-style indicator below the "Request" badge area.

#### 2. Accept/Decline bar — Add Block & Report option (InboxPage.tsx)
Update the decline flow at lines 1053-1080:
- Replace the simple "Decline" button with a split action: **Decline** and **Block & Report**
- "Decline" just removes the conversation (existing behavior)
- "Block & Report" shows a confirmation dialog, then declines + inserts a record into a `blocked_users` table (or uses notifications to flag the user for admin review)

Since we don't have a `blocked_users` table, I'll use a lightweight approach:
- On "Block & Report", decline the conversation AND insert a fraud alert / audit log entry so admins can review
- Store blocked user IDs in localStorage as a simple client-side block list (prevents seeing future requests from them)

#### 3. Message preview in the Accept/Decline bar (InboxPage.tsx)
In the pending chat view (lines 1053-1080), show the sender's first message as a preview quote above the Accept/Decline buttons, making it easier for the recipient to decide.

#### 4. Block/Report dialog (InboxPage.tsx)
Add a small confirmation dialog when "Block & Report" is tapped, with a text field for optional reason.

### Database
- **No migration needed** — we'll use the existing `fraud_alerts` table to log block/report actions with `rule_triggered = 'user_report_spam'`

### Files to Edit
- **`src/pages/InboxPage.tsx`**: Update Accept/Decline bar with message preview, add Block & Report button and confirmation dialog
- **`src/hooks/use-chat.ts`**: Add `blockAndReport` function that declines + inserts fraud alert

