

# Agent Rating System — Rate After Cash Out + Admin Management

## Overview
Add a rating system where users rate agents (1-5 stars) after a successful cash out. Ratings are stored in a new table, averaged per agent, and displayed in the agent list cards. Admins can view, filter, and manage ratings from the Agent Hub.

## Database Changes (1 migration)

### New `agent_ratings` table
```sql
CREATE TABLE public.agent_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text DEFAULT '',
  transaction_id text,
  created_at timestamptz DEFAULT now()
);
-- Unique: one rating per user per agent per transaction
CREATE UNIQUE INDEX idx_agent_ratings_unique ON public.agent_ratings(agent_id, user_id, transaction_id);
```

### Add `avg_rating` and `total_ratings` to `agents` table
```sql
ALTER TABLE public.agents ADD COLUMN avg_rating numeric DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN total_ratings integer DEFAULT 0;
```

### Trigger to auto-update agent averages
A trigger on `agent_ratings` INSERT that recalculates `avg_rating` and `total_ratings` on the parent `agents` row.

### Update `get_nearby_agents` RPC
Return `avg_rating` and `total_ratings` in the response so the CashOutFlow can display them.

### RLS
- Users can INSERT their own ratings (`user_id = auth.uid()`)
- Users can SELECT their own ratings
- Admins (via `has_role`) can SELECT/UPDATE/DELETE all ratings

## Frontend Changes

### 1. CashOutFlow.tsx — Show rating on agent cards + post-cashout rating prompt

**Agent list cards (Step 1):** Add star rating display (e.g., ★ 4.3) next to distance badge using `avg_rating` from the RPC response.

**Success screen (Step 4):** After the receipt, show a "Rate this agent" section with 5 tappable stars and an optional comment field. On submit, INSERT into `agent_ratings`. User can skip.

### 2. AdminAgentHub.tsx — New "Ratings" tab

Add a 7th tab "Ratings" to the Agent Hub showing:
- Agent name, avg rating, total ratings count
- Expandable list of individual reviews (user, rating, comment, date)
- Ability to delete inappropriate reviews
- Sort by highest/lowest rated

## Technical Details
- The `Agent` interface in CashOutFlow already has a `rating` field (currently hardcoded to 0) — will be populated from real data
- Star display component: inline SVG stars with partial fill for fractional ratings
- Rating prompt only appears once per transaction (checked via `transaction_id` unique constraint)

