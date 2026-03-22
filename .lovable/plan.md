

## Add Toggle Keys to Agent & Distributor Dashboard Features

### What
Neither the Agent Dashboard (8 quick actions + 5 menu items) nor the Distributor Dashboard (8 quick actions) currently have toggle key support. This change adds `toggleKey` properties and filtering logic so admins can control all agent/distributor features from the Global Toggles panel, plus inserts the corresponding database rows.

### Changes

#### 1. `src/pages/AgentDashboard.tsx`
- Import `useGlobalToggles`
- Add `toggleKey` to each quick action:
  - Cash In → `agent_cash_in`
  - B2B Send → `agent_b2b`
  - Bank → `agent_bank_transfer`
  - Bill Pay → `agent_bill_pay`
  - Register → `agent_register`
  - Float Req → `agent_float_request`
  - History → `agent_history`
  - Support → `agent_support`
- Filter `quickActions` with `isDisabled` before rendering

#### 2. `src/components/AgentMenuDrawer.tsx`
- Import `useGlobalToggles`
- Add `toggleKey` to menu items:
  - Edit Avatar → `agent_edit_avatar`
  - Share QR → `agent_share_qr`
  - Customer KYC → `agent_customer_kyc`
  - Analytics → `agent_analytics`
  - Settings → `agent_settings`
- Filter `menuItems` with `isDisabled` before rendering

#### 3. `src/pages/DistributorDashboard.tsx`
- Import `useGlobalToggles`
- Add `toggleKey` to each quick action:
  - Create Agent → `distributor_create_agent`
  - Float Send → `distributor_float_send`
  - Agents → `distributor_agents`
  - Agent Txns → `distributor_agent_txns`
  - Settle → `distributor_settle`
  - Earnings → `distributor_earnings`
  - History → `distributor_history`
  - Support → `distributor_support`
- Filter `quickActions` with `isDisabled` before rendering

#### 4. Database Insert (using insert tool)
Insert all 21 new toggle rows into `global_feature_toggles` with `is_enabled = true` and `ON CONFLICT DO NOTHING`.

### Result
All agent and distributor features become individually controllable from the Admin Global Toggles panel under the "Agent" and "Distributor" section tabs.

