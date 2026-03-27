

# Fix: Hide Team/Staff Members from Admin Users List

## Problem
Team/staff members (e.g., staff-sa88, staff-co9k, staff-t00j) appear in the admin "Users" list alongside regular users. These are internal staff accounts created via `create-team-member` edge function with emails like `username@team.easypay.app`. They should not be shown in the regular users list.

## Fix

### File: `src/hooks/use-admin.ts` — `fetchAllUsers` function
Filter out team/staff accounts by excluding profiles whose `phone` starts with `"staff-"`:

```typescript
export async function fetchAllUsers(limit = 50) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .not("phone", "like", "staff-%")
    .order("created_at", { ascending: false })
    .limit(limit);
  // ... rest unchanged
}
```

This single filter change removes all team accounts from the Users tab while keeping them accessible in the Team Management module.

### Summary
- 1 file edit: `src/hooks/use-admin.ts`

