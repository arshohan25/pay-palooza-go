

## Plan: Add Audit Logging for Admin Profile Views

### What this does
Every time an admin opens a customer's profile detail drawer, an entry will be recorded in the `audit_logs` table with the action `view_user_profile`, capturing who viewed whose data and when.

### Changes

#### 1. Update `fetchUserDetails` in `src/hooks/use-admin.ts`
After fetching the user details, insert an audit log entry before returning the data:

```typescript
// After fetching all data, log the view
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) {
  await supabase.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "view_user_profile",
    entity_type: "user",
    entity_id: userId,
    details: {
      viewed_user_name: profileRes.data?.name,
      viewed_user_phone: profileRes.data?.phone,
    },
  });
}
```

This is a fire-and-forget insert — it won't block or break the detail view if logging fails. The existing RLS policy on `audit_logs` allows inserts where `auth.uid() = actor_id`, which is satisfied here.

#### 2. Update `fetchAllUsers` in `src/hooks/use-admin.ts`
Add an audit log when the admin loads the full user list:

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) {
  supabase.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "view_all_profiles",
    entity_type: "user_list",
    entity_id: session.user.id,
    details: { count: data?.length ?? 0 },
  }).then(); // fire-and-forget
}
```

### No database changes needed
The `audit_logs` table already exists with the correct schema and RLS policies that allow authenticated users to insert logs where `actor_id = auth.uid()`.

### Files modified
- `src/hooks/use-admin.ts` — two functions updated

