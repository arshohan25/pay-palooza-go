

## Phase 5: Marketing & Communications — CRUD Gaps

### Current State

| Section | Lines | Has | Missing |
|---------|-------|-----|---------|
| **Banners** | 523 | Full CRUD (create/edit/delete/drag-reorder) | Audit logging |
| **Announcements** | 191 | Full CRUD (create/edit/delete/toggle) | Audit logging |
| **Loyalty Points** | 142 | Create + Edit rules | Delete rule, manual point adjustment, audit logging |
| **Festival Themes** | 794 | Full CRUD (create/edit/delete/preview) | Audit logging |
| **Changelog** | 132 | Create + Delete + Publish toggle | Edit entry body/title, audit logging |
| **Notification Sender** | 814 | Send + Edit + Delete + SMS logs | Notification templates CRUD, audit logging on send |

---

### Implementation

**File 1: `AdminLoyaltyPoints.tsx`**
- Add Delete button (Trash2) per rule row with confirmation
- Add "Manual Adjust" dialog: select user by phone, add/deduct points, reason
- Add audit logging to create/edit/delete/adjust actions

**File 2: `AdminChangelogManager.tsx`**
- Add Edit button per entry (pencil icon → dialog with version/title/body pre-filled)
- Add AlertDialog confirmation on delete
- Add audit logging to create/edit/delete/publish actions

**File 3: `AdminAnnouncementManager.tsx`**
- Add audit logging to create/edit/delete/toggle actions
- Add AlertDialog confirmation on delete (currently immediate)

**File 4: `AdminBannerManager.tsx`**
- Add audit logging to create/edit/delete/reorder actions

**File 5: `AdminFestivalThemes.tsx`**
- Add audit logging to create/edit/delete/activate actions

**File 6: `AdminNotificationSender.tsx`**
- Add "Templates" tab with CRUD: create/edit/delete reusable notification templates (title, body, category, image_url)
- Templates stored in `notification_templates` table (needs migration)
- "Use Template" button in send tab to pre-fill from a template
- Add audit logging on send/delete actions

### Database Changes
- Create `notification_templates` table (id, name, title, body, category, image_url, is_active, created_by, created_at, updated_at)
- Enable RLS with admin-only access via `has_role()`

### Technical Pattern
All files get a shared `auditLog()` helper:
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

### Files Modified
1. `src/components/admin/AdminLoyaltyPoints.tsx`
2. `src/components/admin/AdminChangelogManager.tsx`
3. `src/components/admin/AdminAnnouncementManager.tsx`
4. `src/components/admin/AdminBannerManager.tsx`
5. `src/components/admin/AdminFestivalThemes.tsx`
6. `src/components/admin/AdminNotificationSender.tsx`

