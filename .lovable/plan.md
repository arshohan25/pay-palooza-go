

## Plan: Admin Notifications for Balance Recovery from Deleted Users

### Changes

**1. `supabase/functions/delete-user/index.ts`**
After the treasury credit block (around line 136), insert a notification for all admin users:
- Query `user_roles` for all users with `role = 'admin'`
- Insert a notification for each admin into the `notifications` table with:
  - `title`: "Balance Recovered from Deleted User"
  - `body`: "৳{amount} recovered from {name/phone} and credited to treasury"
  - `category`: "system"
  - `metadata`: `{ type: "balance_recovery", amount, user_name, source: "manual_delete" }`

**2. `supabase/functions/auto-purge-deactivated/index.ts`**
Same pattern after treasury credit (around line 96):
- Fetch admin user IDs from `user_roles`
- Insert notifications for each admin with source `"auto_purge"`

**3. No database or UI changes needed**
- The `notifications` table already exists with the right schema
- The existing Notification Center already displays system notifications with real-time sync
- Admin notifications will appear automatically in the bell icon notification center

### Implementation Detail

```typescript
// Notify all admins about balance recovery
const { data: admins } = await adminClient
  .from("user_roles")
  .select("user_id")
  .eq("role", "admin");

if (admins?.length) {
  await adminClient.from("notifications").insert(
    admins.map(a => ({
      user_id: a.user_id,
      title: "Balance Recovered",
      body: `৳${amount} recovered from ${userName} and credited to treasury`,
      category: "system",
      metadata: { type: "balance_recovery", amount, source: "manual_delete" }
    }))
  );
}
```

### Files to Modify
| File | Change |
|------|--------|
| `supabase/functions/delete-user/index.ts` | Add admin notification after treasury credit |
| `supabase/functions/auto-purge-deactivated/index.ts` | Add admin notification after treasury credit |

