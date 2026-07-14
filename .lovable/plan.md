## Goal
Give admins full control over the agent ↔ distributor relationship and distributor territory ownership from the Distributors section (`/admin#distributors`) and Agent Hub — currently there is no way to link/unlink an agent to a distributor, reassign an agent between distributors, or move territories from one distributor to another.

## What's missing today
- `AdminDistributorManagement.tsx` only lists linked agents (read-only). No assign / unassign / move buttons.
- `AdminAgentHub.tsx` never surfaces `distributor_id`; admins can't see or change which distributor owns an agent.
- Territories live in `distributors.territory text[]`, edited only as a free-text field per distributor — no way to hand a territory from Dist A to Dist B in one action (and no guard against the same territory being claimed twice).

## Features to add

### 1. In the Distributor drawer (Linked Agents section)
- **Unlink** button on each agent row → sets `agents.distributor_id = null` (agent becomes unassigned).
- **Transfer** button → picker dialog listing other active distributors; moves the agent to the chosen one.
- **Assign agents…** button at top → dialog with a searchable list of currently unassigned agents (or agents from other distributors), multi-select, "Assign to this distributor".

### 2. In the Distributor drawer (Territories section)
- Show territories as chips with an **×** to remove and a **Move to…** menu that transfers the code to another distributor atomically (removed from current, added to target, deduped).
- Prevent duplicate ownership: if the target already has the code, no-op with a toast.

### 3. Bulk transfer between distributors
- New "Transfer all" action in the distributor row menu → "Transfer all agents / all territories / everything from Distributor A → Distributor B" (with confirmation). Useful when retiring a distributor.

### 4. In Admin Agent Hub (`AdminAgentHub.tsx`)
- New "Distributor" column showing the current distributor's business name (or "Unassigned").
- Row action **Change distributor…** opens the same picker (reuses the component from #1).
- Filter: "Distributor = …/Unassigned".

### 5. Safety & audit
- Every link/unlink/transfer writes an `audit_logs` row (`action`: `agent_assigned`, `agent_unassigned`, `agent_transferred`, `territory_transferred`, `distributor_bulk_transferred`) with before/after ids.
- All mutations wrapped in a small helper `reassignAgent(agentId, fromDistId, toDistId)` / `transferTerritory(code, fromDistId, toDistId)` in `src/lib/distributorAdmin.ts`.
- Guarded by `useAdmin()` — the existing RLS on `agents`/`distributors` already permits admin updates, so no schema/RLS changes are required.

## Files touched

**New**
- `src/lib/distributorAdmin.ts` — helpers + audit
- `src/components/admin/DistributorPickerDialog.tsx` — reusable picker (search + select distributor)
- `src/components/admin/AssignAgentsDialog.tsx` — multi-select assign
- `src/components/admin/BulkTransferDistributorDialog.tsx`

**Edited**
- `src/components/admin/AdminDistributorManagement.tsx` — new buttons in drawer, row action menu, territory chips with move
- `src/components/admin/AdminAgentHub.tsx` — Distributor column, filter, Change-distributor action
- `src/lib/i18n.tsx` — new strings (EN + BN): assign, unassign, transfer, move territory, bulk transfer, confirmations

## Technical details
- No DB migration needed — `agents.distributor_id` and `distributors.territory` already exist and admin role has update rights via existing RLS.
- Territory move uses a single Postgres transaction via two `update` calls wrapped in `Promise.all` inside a try/catch; on error we revert client-side state (optimistic UI already used elsewhere in the file).
- All lists refresh via the existing realtime `postgres_changes` subscription on `agents` and `distributors` — no manual refetch after mutation.

## Order of build
1. `distributorAdmin.ts` helpers + audit
2. `DistributorPickerDialog` (shared)
3. Distributor drawer: unlink / transfer / assign / territory chips
4. Agent Hub: distributor column + change action + filter
5. Bulk-transfer dialog
6. i18n strings

Confirm and I'll ship it in that order.