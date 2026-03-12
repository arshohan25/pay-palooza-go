

## Auto-Assign & Complaint Escalation System

### What We're Building

1. **Auto-assign**: When a user creates a new support ticket, automatically assign it to the least-busy available support agent (no manual "Assign" click needed).
2. **Escalate to Technical Team**: Support agents can raise a complaint/escalation to the technical team from within a ticket, generating a unique complaint number (e.g., `CMP-20260312-A1B2`).
3. **User sees complaint number**: The complaint number is shown on the user's ticket page so they can track the escalation.

### Database Changes

**New table: `support_complaints`**
- `id` (uuid, PK)
- `complaint_number` (text, unique) — auto-generated like `CMP-YYYYMMDD-XXXX`
- `conversation_id` (uuid, FK → support_conversations)
- `raised_by` (uuid) — support agent who escalated
- `assigned_to` (uuid, nullable) — technical team member
- `subject` (text)
- `description` (text)
- `priority` (text: low/medium/high/critical, default 'medium')
- `status` (text: open/in_progress/resolved, default 'open')
- `resolution_notes` (text, nullable)
- `created_at` / `updated_at` (timestamptz)

RLS: Admins can read/write. Users can read their own (via conversation_id → user_id join).

**Add column to `support_conversations`**: `complaint_number` (text, nullable) — denormalized for quick display on user tickets.

### Auto-Assign Logic

**`src/components/admin/SupportAgentRouter.tsx`** — Add `autoAssignNewConversation()` function.

**Trigger point**: In `AdminSupportDashboard.tsx`, when the realtime listener detects a new `support_conversations` INSERT with status `open` and no `assigned_agent_id`, automatically call `assignConversation(convId)` to route to the least-busy agent.

### Complaint Escalation UI

**`src/components/admin/AdminSupportDashboard.tsx`**:
- Add "Escalate" button in chat header (next to Resolve/Close), with `AlertTriangle` icon
- Opens an AlertDialog with:
  - Pre-filled subject from ticket
  - Description textarea for the agent to explain the issue
  - Priority selector (Low/Medium/High/Critical)
- On submit: inserts into `support_complaints`, updates `support_conversations.complaint_number`, sends a system message in the chat like "⚠️ Complaint CMP-20260312-A1B2 raised to technical team"
- Toast with complaint number

### User-Facing Complaint Number

**`src/pages/MyTicketsPage.tsx`**:
- Show complaint number badge on tickets that have one (fetched from `support_conversations.complaint_number`)
- Display as a small badge like `🔧 CMP-20260312-A1B2` below the subject

### Files

1. **Migration SQL** — `support_complaints` table + `complaint_number` column on `support_conversations`
2. **`src/components/admin/SupportAgentRouter.tsx`** — Add auto-assign helper
3. **`src/components/admin/AdminSupportDashboard.tsx`** — Auto-assign on new ticket detection + Escalate button/dialog
4. **`src/pages/MyTicketsPage.tsx`** — Show complaint number on user tickets

