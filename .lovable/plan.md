## Plan: Add Admin Operations Wall

### Goal
Create a new admin dashboard module that acts as a command-center view for operations teams, showing:

- Real-time gateway health
- Failed transaction counts and failure trends
- Liquidity-related alerts
- Live operational event stream

### What will be added

1. **New Operations Wall module**
   - Add a new component: `src/components/admin/AdminOperationsWall.tsx`
   - Present a full-screen-friendly admin panel with compact KPI cards, live lists, and alert sections.
   - Match the existing admin glass/card style and responsive layout.

2. **Gateway health section**
   - Read existing gateway sources:
     - `payment_gateways`
     - `recharge_api_configs`
     - `merchant_api_logs`
     - `payment_sessions`
     - `merchant_payment_sessions`
   - Show enabled/disabled status, configured/test status, API success rate, average response time, webhook delivery problems, and recent gateway failures.
   - Classify each provider as Healthy, Warning, or Critical using recent errors and test status.

3. **Failed transaction monitoring**
   - Read recent `transactions` and payment session data.
   - Show failed transaction counts for today and the last hour.
   - Break failures down by transaction type/provider where available.
   - Add a live failure feed with amount, type/provider, time, and reason/status.

4. **Liquidity alerts**
   - Read `platform_treasury`, `treasury_ledger`, `agents`, `profiles`, and existing payment/fund-request data.
   - Show treasury balance, net cash flow, projected shortfall, low-float agents, pending fund requests, and gateway/offline risk signals.
   - Generate alert cards such as “Treasury below threshold”, “Negative net flow”, “Agent low float”, or “High pending add-money volume”.

5. **Realtime updates**
   - Subscribe to changes on operational tables using `postgres_changes`:
     - `transactions`
     - `payment_sessions`
     - `merchant_payment_sessions`
     - `merchant_api_logs`
     - `payment_gateways`
     - `recharge_api_configs`
     - `platform_treasury`
     - `treasury_ledger`
     - `fund_requests`
     - `agents`
   - Update counters and live feed without refresh, following the project’s zero-refresh policy.
   - Include pause/resume and manual refresh controls.

6. **Admin dashboard integration**
   - Import the new component into `src/pages/AdminDashboard.tsx`.
   - Add a new sidebar item under **Operations** named **Operations Wall**.
   - Render the module when `activeTab === "operations_wall"`.

### Technical details

- No database schema changes are required for the first version.
- The module will use existing tables and current RLS/admin permissions.
- Data will be capped with practical query limits to avoid heavy admin loads.
- Health scoring will be computed client-side from recent operational data:

```text
Gateway health = enabled/configured status
               + recent API status codes
               + payment session failures
               + webhook delivery status
               + recharge API test status

Liquidity alert = treasury balance
                + recent inflow/outflow
                + pending fund requests
                + low agent/profile balances
                + recent cash-out pressure
```

### Expected result
Admins will get a dedicated **Operations Wall** in the admin dashboard that continuously surfaces gateway problems, transaction failures, and liquidity risks in one command-center screen, with live updates and clear severity indicators.