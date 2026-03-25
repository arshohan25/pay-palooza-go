

## Plan: Add Essential API Management Components

### What
Add three new sub-tabs to the API Access Management section: **API Logs**, **Rate Limits**, and **IP Whitelist**. All backing tables already exist in the database (`merchant_api_logs`, `merchant_api_keys.rate_limit_per_minute`, `merchant_ip_whitelist`).

### Changes

#### 1. New Component: `src/components/admin/AdminApiLogs.tsx`
- Query `merchant_api_logs` table with filters for merchant, status code (2xx/4xx/5xx), and date range
- Summary cards: Total Requests, Success Rate, Avg Response Time, Error Count
- Table columns: Time, Merchant, Action, Status Code, Response Time, IP, Error
- Expandable rows showing user_agent and full error message
- Real-time subscription for live updates

#### 2. New Component: `src/components/admin/AdminApiRateLimits.tsx`
- List all `merchant_api_keys` showing merchant name, current `rate_limit_per_minute`, and active status
- Inline edit: click on rate limit value to change it (select dropdown: 10, 30, 60, 120, 300, 600, unlimited)
- Updates `merchant_api_keys.rate_limit_per_minute` directly
- Summary: total keys, keys with custom limits, keys at default

#### 3. New Component: `src/components/admin/AdminApiIpWhitelist.tsx`
- Query `merchant_ip_whitelist` joined with merchant names
- Table: Merchant, IP Address, Label, Added Date, Actions (delete)
- Add IP dialog: select merchant, enter IP address, optional label
- Toggle `ip_whitelist_enabled` on `merchant_api_keys` per key
- Summary cards: Total IPs, Merchants with whitelist enabled

#### 4. Update `src/components/admin/AdminApiRequests.tsx`
- Add sub-tabs: Requests | API Keys | **Logs** | **Rate Limits** | **IP Whitelist**
- Render the new components based on active tab
- Pass `search` prop to new components for consistent filtering

#### 5. Update `src/pages/AdminDashboard.tsx`
- No new sidebar items needed -- everything nests under existing "API Requests" tab

### Technical Detail
- All three tables (`merchant_api_logs`, `merchant_ip_whitelist`, `merchant_api_keys`) already exist with proper schemas
- `merchant_api_keys` already has `rate_limit_per_minute` (number) and `ip_whitelist_enabled` (boolean) columns
- Follow existing admin UI patterns: summary cards at top, segmented control tabs, table with search filtering
- Real-time channel subscriptions for `merchant_api_logs` table

