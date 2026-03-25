

## Plan: Create a Public Developer Portal for EasyPay Integration

### Problem
Currently, integration docs are buried inside the Merchant Dashboard's API tab. External gateways, businesses, or developers who want to connect with EasyPay have no public-facing entry point to learn how to integrate, get credentials, or understand the API.

### Solution
Create a public `/developers` page — a Developer Portal that explains how to integrate with EasyPay, with SDK docs, API reference, and a "Get Started" flow.

### New Page: `src/pages/DeveloperPortal.tsx`

**Sections:**
1. **Hero** — "Build with EasyPay" headline, sub-text explaining payment collection, QR payments, webhooks
2. **Integration Methods** — 3 cards:
   - **SDK (Drop-in Button)** — embed `easypay-sdk.js`, code snippet with `EasyPay.init()` + `renderButton()`
   - **REST API** — direct API calls to create sessions, check status, list sessions
   - **QR Payments** — dynamic QR generation via API with polling
3. **Quick Start** — step-by-step: Register as Merchant → Get API Keys → Install SDK → Accept Payments
4. **API Reference** — collapsible sections for each endpoint:
   - `create_session` — params, response, example
   - `check_status` — params, response
   - `list_sessions` — pagination params
   - Authentication headers (`X-API-Key`, `X-App-Password`)
   - Webhook verification (HMAC-SHA256)
5. **Code Examples** — tabbed snippets (JavaScript, Python, cURL)
6. **SDK Reference** — `EasyPay.init()`, `renderButton()`, `displayQR()`, `createPayment()`, `checkStatus()`
7. **CTA Footer** — "Become a Merchant" button → links to `/merchant` or merchant application flow

### Route
- Add `/developers` route in `App.tsx` (public, no auth required)

### Files
| File | Action |
|------|--------|
| `src/pages/DeveloperPortal.tsx` | Create — full developer docs page |
| `src/App.tsx` | Add route `/developers` |

### Design
- Clean, documentation-style layout with the existing brand colors
- Code blocks with copy buttons using `bg-muted/50 rounded-lg` pattern
- Responsive — works on mobile and desktop
- No authentication required — fully public

