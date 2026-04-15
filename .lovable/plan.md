

# Show Nearby Agents with Real Location & Distance

## Problem
The CashOut flow's "Nearby Agents" section currently shows recent transaction history agents with no real geolocation or distance data. The `agents` table has no latitude/longitude columns.

## Changes

### 1. Add location columns to `agents` table (migration)

```sql
ALTER TABLE public.agents ADD COLUMN latitude double precision;
ALTER TABLE public.agents ADD COLUMN longitude double precision;
ALTER TABLE public.agents ADD COLUMN address text DEFAULT '';
```

### 2. Create `get_nearby_agents` RPC (same migration)

A SECURITY DEFINER function that takes user's lat/lng and returns active agents sorted by distance using the Haversine formula:

```sql
CREATE FUNCTION public.get_nearby_agents(p_lat double precision, p_lng double precision, p_radius_km double precision DEFAULT 10)
RETURNS TABLE(agent_id uuid, business_name text, territory_code text, address text, latitude double precision, longitude double precision, distance_km double precision)
```

- Filters only `status = 'active'` agents with non-null lat/lng
- Calculates distance using Haversine
- Returns sorted by distance, limited to agents within `p_radius_km`

### 3. Update `CashOutFlow.tsx` — fetch nearby agents with real location

- On mount, call `navigator.geolocation.getCurrentPosition()` to get user's coordinates
- If location granted, call `get_nearby_agents` RPC with user's lat/lng
- Display returned agents in the "Nearby Agents" section with real distance (e.g. "0.8 km away", "2.3 km away")
- Fall back to recent transaction agents if location is denied or no nearby agents found
- Show a small location permission prompt/badge when geolocation is not yet granted

### 4. Update agent card UI in the list

Each agent card will show:
- Agent initials avatar + business name
- Territory code / agent ID
- Distance badge (e.g. `📍 1.2 km`) — only when location data is available
- Address line if available

### 5. Admin: Allow setting agent location in AdminAgentHub

Add lat/lng input fields to the agent edit form so admins can set agent coordinates. This provides the data source for nearby agent lookups.

## Result
When location is enabled, users see real nearby agents sorted by distance. When location is off, they see their recent cashout agents as before.

