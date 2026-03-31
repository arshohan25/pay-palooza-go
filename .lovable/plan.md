

# Fix: Create `user_rewards` Table & Verify End-to-End Flow

## Problem
The `user_rewards` table does not exist in the database. Every request to it returns a 404 error (`Could not find the table 'public.user_rewards'`). This breaks both:
1. Admin reward assignment
2. User "My Rewards" section on the Account page

## Plan

### 1. Create `user_rewards` table (database migration)
```sql
CREATE TABLE public.user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  reward_value jsonb NOT NULL DEFAULT '{}',
  reason text,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access on user_rewards"
  ON public.user_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read their own active rewards
CREATE POLICY "Users read own rewards"
  ON public.user_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Index for fast user lookups
CREATE INDEX idx_user_rewards_user_id ON public.user_rewards(user_id);
CREATE INDEX idx_user_rewards_status ON public.user_rewards(status);
```

### 2. No code changes needed
The existing code in `AdminUserPerformanceTracker.tsx` and `AccountPage.tsx` already:
- Inserts rewards into `user_rewards`
- Creates `user_feature_overrides` entries for `feature_unlock` type rewards (making the feature visible to the user)
- Displays active rewards in "My Rewards" on the Account page

Once the table exists, the full flow will work:
1. Admin selects user(s) → opens reward dialog → picks "Feature Unlock" → selects a feature → assigns
2. A row is inserted into `user_rewards` (for tracking/display)
3. A `user_feature_overrides` row is upserted with `visibility: "visible"` (unlocks the feature)
4. User sees the reward in Account → "My Rewards" section
5. The unlocked feature becomes visible on their home/account page via the `useGlobalToggles` hook

## File Changed
- **New migration**: Create `user_rewards` table with RLS policies

