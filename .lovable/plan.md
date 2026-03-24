

## Phase 6: Support, Compliance & Monitoring — Full CRUD

### Current State & Gaps

| Section | Lines | Has | Missing |
|---------|-------|-----|---------|
| **Dispute Resolution** | 213 | View + status update | Create dispute (admin-initiated), delete resolved disputes, audit logging |
| **Complaint Manager** | 153 | View + status update + notes | Delete resolved complaints, priority change, audit logging |
| **Blacklist Manager** | 173 | Add + toggle + delete | Edit entry (reason/type), AlertDialog on delete, audit logging |
| **User Feedback** | 107 | Read-only list | Delete feedback, flag/archive feedback, reply to feedback, audit logging |
| **Chat Monitor** | 246 | Read-only viewer | Delete/archive conversations, flag conversations, audit logging |
| **Careers Manager** | 171 | Create + toggle + delete jobs, shortlist/reject apps | Edit job details, AlertDialog on delete, audit logging |

### Implementation

**File 1: `AdminDisputeResolution.tsx`** (~213 → ~320 lines)
- Add "Create Dispute" dialog (admin-initiated: select user by phone, subject, description, link transaction)
- Add "Delete" button for resolved/rejected disputes with AlertDialog
- Add audit logging to create/update/delete actions

**File 2: `AdminComplaintManager.tsx`** (~153 → ~220 lines)
- Add "Delete" button per resolved complaint with AlertDialog confirmation
- Add priority change capability in the update dialog
- Add audit logging to status update and delete actions

**File 3: `AdminBlacklistManager.tsx`** (~173 → ~240 lines)
- Add "Edit" button per entry (edit reason, update type) via inline or dialog
- Wrap delete in AlertDialog confirmation
- Add audit logging to add/edit/delete/toggle actions

**File 4: `AdminUserFeedback.tsx`** (~107 → ~200 lines)
- Add "Delete" button per feedback with AlertDialog
- Add "Flag" toggle to mark feedback as important/reviewed
- Add audit logging to delete/flag actions

**File 5: `AdminChatMonitor.tsx`** (~246 → ~310 lines)
- Add "Delete Conversation" button with AlertDialog (deletes messages + conversation)
- Add "Flag" button to mark conversations for review
- Add audit logging to delete/flag actions

**File 6: `AdminCareersManager.tsx`** (~171 → ~260 lines)
- Add "Edit Job" dialog (pre-filled with title, department, location, type, description, requirements)
- Wrap job delete in AlertDialog confirmation
- Add audit logging to create/edit/delete/toggle/shortlist/reject actions

### Technical Pattern (consistent across all files)
```typescript
async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details
    });
  }
}
```
- Every destructive action: AlertDialog confirmation
- Toast feedback on success/error
- List auto-refresh after mutation

### Database Changes
None — all tables exist with required columns.

### Files Modified
1. `src/components/admin/AdminDisputeResolution.tsx`
2. `src/components/admin/AdminComplaintManager.tsx`
3. `src/components/admin/AdminBlacklistManager.tsx`
4. `src/components/admin/AdminUserFeedback.tsx`
5. `src/components/admin/AdminChatMonitor.tsx`
6. `src/components/admin/AdminCareersManager.tsx`

