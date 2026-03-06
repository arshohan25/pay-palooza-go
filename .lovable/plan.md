## Plan: Add Unified "API Connections" Section to Admin Dashboard

### What

A new admin dashboard tab called "API Hub" that provides a single centralized view of **every** external API and service integration the platform uses. Each integration shows its connection status, configuration state, and quick actions to configure/test.

### API Categories to Display


| Category               | Services                                         | Status Source                                              |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| **Payment Gateways**   | bKash, Nagad, AsthaPay, Rocket, uPay, TAP, mCash | `payment_gateways` table (is_enabled + config presence)    |
| **Recharge Operators** | GP, Robi, Banglalink, Teletalk, Airtel           | `recharge_api_configs` table (is_enabled + test_status)    |
| **SMS**                | Local Providers                                  | Check if `LOCAL PROVIDERS` secret exists via edge function |
| **Email**              | Resend                                           | Check if `RESEND_API_KEY` secret exists via edge function  |
| **KYC**                | OCR, Face Match                                  | Edge function availability                                 |
| **Auth / Device**      | OTP, Device Validation                           | Edge function availability                                 |


All Categories every single Billers 

### Implementation

**1. New component: `src/components/admin/AdminApiHub.tsx**`

- Fetches payment gateways via `manage-gateway-config` edge function (existing, action: `list`, both tables)
- Displays all integrations in a card grid grouped by category
- Each card shows: service name, logo/icon, connection status (Connected/Not Configured/Disabled), last updated timestamp
- "Configure" button navigates to the relevant admin tab (e.g., clicking bKash goes to Gateways tab, clicking GP goes to Recharge > API Connect)
- A "Test All" button that runs connectivity checks on enabled services
- Summary bar at top: "X of Y APIs connected"

**2. New edge function: `supabase/functions/check-api-status/index.ts**`

- Admin-only endpoint that checks which secrets are configured (Twilio, Resend, etc.) by testing if `Deno.env.get()` returns truthy values
- Returns a status map: `{ twilio: true, resend: true, ... }`
- Does NOT expose secret values, only boolean presence

**3. Update `src/pages/AdminDashboard.tsx**`

- Add new nav item: `{ id: "apihub", label: "API Hub", icon: Plug }` (using `Plug` from lucide-react)
- Add tab render: `{activeTab === "apihub" && <AdminApiHub onNavigate={setActiveTab} />}`
- Pass `setActiveTab` so cards can navigate to specific config sections

### Files

- `src/components/admin/AdminApiHub.tsx` (new)
- `supabase/functions/check-api-status/index.ts` (new)
- `supabase/config.toml` (add function config)
- `src/pages/AdminDashboard.tsx` (add nav item + tab render)