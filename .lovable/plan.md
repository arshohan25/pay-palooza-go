

## Plan: Add Essential API Management Sub-tabs

### What's There Now
The API Access Management section (`AdminApiRequests.tsx`) has 5 sub-tabs: Requests, API Keys, Logs, Rate Limits, IP Whitelist. These are solid but missing some critical operational tools.

### New Sub-tabs to Add

#### 1. **Webhooks** — `AdminApiWebhooks.tsx`
- List all `merchant_api_keys` with their `webhook_url` configured
- Test webhook button: sends a test POST payload to the merchant's URL and shows response status/time
- Edit webhook URL inline per key
- Show recent delivery attempts from `merchant_api_logs` filtered to webhook actions
- Summary cards: Total Configured, Active Webhooks, Failed Deliveries

#### 2. **Sandbox** — `AdminApiSandbox.tsx`
- Interactive API testing console for admins to simulate merchant API calls
- Select a merchant API key, choose an endpoint/action (create-payment, check-status, refund)
- Auto-fill sample request body, editable JSON textarea
- Execute button that calls the `merchant-payment-api` edge function
- Display response: status code, body (formatted JSON), response time
- Useful for debugging merchant integration issues

#### 3. **Usage Analytics** — `AdminApiUsageAnalytics.tsx`
- Aggregate stats from `merchant_api_logs`: requests per day chart, top merchants by volume, error rate trends
- Time range selector (24h, 7d, 30d)
- Bar/line chart using existing chart components for daily request counts
- Top 5 merchants by API call volume
- Breakdown by status code (2xx vs 4xx vs 5xx pie/donut)
- Average response time trend

### Changes to Existing Files

#### `AdminApiRequests.tsx`
- Add 3 new tabs: "Webhooks", "Sandbox", "Usage" to the segmented control
- Import and render the 3 new components
- Pass `search` prop to Webhooks and Usage

### Technical Detail
- All data sourced from existing tables: `merchant_api_keys`, `merchant_api_logs`, `merchants`
- Sandbox calls existing `merchant-payment-api` edge function
- Charts use the existing `@/components/ui/chart` (Recharts-based)
- No database migrations needed

