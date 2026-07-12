# Agent Features: Locator + AML Flag + Leaderboard

Building the 3 selected features. Each is independent and shipped as a separate agent page/section.

---

## 1. Nearby-Agent Locator (`#2`)

**Agent side** — `/agent` dashboard gets an "Availability" card:
- Toggle: Online / Offline (persisted in `agents.is_available`)
- "Set my shop location" → uses browser geolocation (one-time, stored in `agents.location_lat/lng` + `location_updated_at`)
- Shows current status pill + last-updated timestamp

**Customer side** — new route `/agents/nearby` (linked from customer home Quick Action "Find Agent"):
- Google Maps via existing Google Maps connector (already installed per knowledge)
- Shows customer location + pins for online agents within 5 km
- Tap pin → drawer with agent name, shop, distance, wallet ID, "Copy ID" + "Cash out here" (deep-links to `/cashout?agent=EP…`)
- Distance calc via Haversine in the query (Postgres function `nearby_agents(lat, lng, radius_km)`)

**Schema**
```sql
ALTER TABLE agents
  ADD COLUMN is_available boolean DEFAULT false,
  ADD COLUMN location_lat numeric(9,6),
  ADD COLUMN location_lng numeric(9,6),
  ADD COLUMN location_updated_at timestamptz,
  ADD COLUMN shop_name text;

CREATE FUNCTION public.nearby_agents(_lat numeric, _lng numeric, _radius_km numeric)
RETURNS TABLE(...) LANGUAGE sql STABLE SECURITY DEFINER ...
```
RLS: agents update own row; authenticated users can call `nearby_agents` RPC (returns only online agents with location, no PII beyond shop name + wallet ID).

---

## 2. Suspicious-Customer Flag / Quick AML Report (`#10`)

**On every row of Agent Transaction History** — kebab menu → "Flag suspicious":
- Sheet with reason dropdown (structuring, unknown source, refused ID, other), free-text notes, severity (low/med/high)
- Submits to new `aml_reports` table (agent_id, subject_user_id, txn_id, reason, notes, severity, status)
- Toast: "Reported to compliance"

**Admin side** — reports flow into existing `fraud_alerts` pipeline via a DB trigger that inserts a matching `fraud_alerts` row (so admins see it in the fraud queue they already use). No new admin UI needed for v1.

**Schema**
```sql
CREATE TABLE aml_reports (id uuid pk, agent_id uuid, subject_user_id uuid,
  transaction_id uuid, reason text, notes text, severity text,
  status text default 'pending', created_at timestamptz);
-- + GRANTs + RLS (agent inserts own; admin/compliance select all)
-- + trigger → fraud_alerts
```

---

## 3. District Leaderboard (`#11`)

New agent page `/agent/leaderboard`:
- Uses existing `agents.route_code` (2-letter district code) — no new geo data needed
- Ranks agents in same district by last-30-day txn count + volume
- Shows top 20 + "You are #N of M" row pinned at bottom
- Podium styling for top 3, matches existing dark/glassmorphism theme
- Refreshes on pull-to-refresh; realtime not required (leaderboards are laggy by design)

**Data**: new `agent_leaderboard(route_code)` RPC that aggregates `transactions` for last 30 days grouped by agent. SECURITY DEFINER, returns rank + masked agent name (first name + last-4 of wallet ID) — never full PII.

---

## Files touched

**New**
- `src/pages/AgentLeaderboard.tsx`
- `src/pages/NearbyAgentsPage.tsx`
- `src/components/agent/AvailabilityCard.tsx`
- `src/components/agent/FlagSuspiciousSheet.tsx`
- `supabase/migrations/…_agent_locator_aml_leaderboard.sql`

**Edited**
- `src/App.tsx` — 2 new routes (`/agent/leaderboard`, `/agents/nearby`)
- `src/pages/AgentDashboard.tsx` — mount AvailabilityCard, add Leaderboard tile
- `src/pages/AgentTransactionHistory.tsx` — kebab → Flag suspicious
- `src/components/QuickActions.tsx` — add "Find Agent" for customers
- `src/lib/i18n.tsx` — new strings (EN + BN)

## Order of build
1. Migration (schema + RPCs + RLS + GRANTs)
2. AML flag sheet (smallest, no maps)
3. Leaderboard page (pure data)
4. Availability + Nearby locator (biggest, needs maps loader)

Confirm and I'll ship it in that order.
