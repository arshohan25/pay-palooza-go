

## Plan: Add "Blocked Users" Management Screen

### Overview
Add a new sub-page accessible from Account Settings that displays all blocked users and allows unblocking them. Currently blocked users are stored in `localStorage` (`ep_blocked_users`) as an array of user IDs. We'll build a screen that resolves those IDs to profile names/phones and lets the user remove entries.

### Changes

#### 1. New component: `src/components/BlockedUsersPage.tsx`
- Read `ep_blocked_users` from `localStorage`
- For each blocked user ID, fetch their profile (name, phone, avatar) via a single query to `profiles` using the `find_chat_user_by_phone` pattern — but since we have user IDs, we need a new RPC or use the existing profiles table. Since regular users can only read their own profile via RLS, we'll create a small `SECURITY DEFINER` function `get_blocked_user_profiles(p_user_ids uuid[])` that returns safe public info (name, phone, avatar_url) for the given IDs.
- Display each blocked user in a list with name, phone, and an "Unblock" button
- On unblock: remove the user ID from `localStorage` array, update UI, show toast
- Empty state when no blocked users
- Back button to return to Account page

#### 2. Database migration: `get_blocked_user_profiles` RPC
```sql
CREATE OR REPLACE FUNCTION public.get_blocked_user_profiles(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, name text, phone text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.phone, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids) AND p.status = 'active';
$$;
```

#### 3. Update `src/pages/AccountPage.tsx`
- Add a new `MenuRow` in the Security section: "Blocked Users" with `ShieldBan` icon
- On click, set `subPage` to `"blocked"`
- Add routing: `if (subPage === "blocked") return <BlockedUsersPage onBack={() => setSubPage(null)} />`
- Update `SubPage` type to include `"blocked"`

### Files
- **New**: `src/components/BlockedUsersPage.tsx`
- **Edit**: `src/pages/AccountPage.tsx` — add menu item + sub-page routing
- **Migration**: New RPC function `get_blocked_user_profiles`

