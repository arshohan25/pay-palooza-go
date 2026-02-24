
# Recharge API Connect Section

## Overview
Add a new "API Connect" sub-tab inside the existing Recharge section of the Admin Dashboard. This section allows admins to configure API credentials for each mobile operator (GP, Robi, Banglalink, Teletalk, Airtel) to enable real-time recharge processing through operator APIs instead of just recording local transactions.

## What It Does
- Admins can configure API credentials (API Key, Secret, Merchant ID, Callback URL, etc.) per operator
- Each operator connection has an enable/disable toggle
- A "Test Connection" button sends a ping to verify credentials work
- The MobileRechargeFlow will check if an operator has a live API connection and, if so, call a backend function to process the recharge in real-time

## Technical Plan

### 1. Database: New `recharge_api_configs` table
Create a migration to add:

```text
recharge_api_configs
  id            uuid PK
  operator      text NOT NULL UNIQUE (Grameenphone, Robi, Banglalink, Teletalk, Airtel)
  display_name  text NOT NULL
  api_base_url  text
  config        jsonb DEFAULT '{}'  (stores API_KEY, API_SECRET, MERCHANT_ID, etc.)
  is_enabled    boolean DEFAULT false
  last_tested   timestamptz
  test_status   text  ('success' | 'failed' | null)
  created_at    timestamptz DEFAULT now()
  updated_at    timestamptz DEFAULT now()
```

RLS: Admin-only full access (matching existing pattern with `has_role(auth.uid(), 'admin')`).

### 2. New Component: `AdminRechargeApiConnect.tsx`
- Lists all 5 operators as cards (pre-seeded or dynamically created on first visit)
- Each card shows: operator logo/name, connection status badge (Connected/Not Configured/Failed), enable/disable toggle
- Edit dialog for each operator with fields: API Base URL + dynamic credential fields (show/hide secrets, add/remove fields -- same pattern as `AdminGatewayConfig.tsx`)
- "Test Connection" button that calls a backend function to validate credentials
- Real-time sync via Supabase channel

### 3. Backend Function: `test-recharge-api` Edge Function
- Accepts operator name and credentials
- Makes a lightweight health-check/ping call to the operator's API endpoint
- Returns success/failure status
- Updates `last_tested` and `test_status` in the database

### 4. Backend Function: `process-recharge` Edge Function
- Called by the MobileRechargeFlow when an operator has `is_enabled = true`
- Fetches credentials from `recharge_api_configs` table
- Sends the recharge request to the operator's API
- Returns success/failure with operator transaction ID
- On success, records the transaction normally

### 5. Update `RechargeSection` in AdminDashboard
- Add a 4th sub-tab button: "API Connect"
- Renders the new `AdminRechargeApiConnect` component

### 6. Update `MobileRechargeFlow.tsx`
- Before processing a recharge, check if the detected operator has an enabled API config
- If enabled: call the `process-recharge` edge function for real-time processing
- If not enabled: fall back to existing local transaction recording (current behavior)
- Show appropriate status messaging (e.g., "Processing via GP API..." vs "Recharge recorded")

## Files to Create
- `src/components/admin/AdminRechargeApiConnect.tsx` -- main admin UI component
- `supabase/functions/test-recharge-api/index.ts` -- connection test endpoint
- `supabase/functions/process-recharge/index.ts` -- real-time recharge processing endpoint
- Database migration for `recharge_api_configs` table

## Files to Modify
- `src/pages/AdminDashboard.tsx` -- add "API Connect" sub-tab to RechargeSection
- `src/components/MobileRechargeFlow.tsx` -- integrate real-time recharge call
- `supabase/config.toml` -- register new edge functions with `verify_jwt = false`
