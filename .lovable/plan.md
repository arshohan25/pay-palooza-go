

## Plan: Display All Merchant Credentials (API Key, Secret Key, App Password)

### Current State
The system already generates both an **API Key** (`epk_...`) and a **Secret Key** (`eps_...`) for each merchant. However:
1. The **Secret Key** is never shown to the merchant in the UI — it's only stored in the DB and referenced in webhook verification docs
2. There is no **App Password** concept at all
3. The merchant API tab only displays the API Key and webhook URL — missing the secret key

### What Needs to Change

**1. Show Secret Key to merchants in `MerchantApiTab.tsx`**
- Add a masked secret key display row (like `eps_****...****`) with a "Reveal" toggle and copy button
- Show it alongside the existing API Key display

**2. Add App Password field to `merchant_api_keys` table (migration)**
- Add `app_password` column to `merchant_api_keys`
- Auto-generate it when admin approves API access (format: `epp_` + random 24 chars)

**3. Update API key generation in admin flows**
- `AdminApiRequests.tsx`: Generate app_password when approving requests
- `AdminMerchantManagement.tsx`: Generate app_password when manually creating keys

**4. Update merchant-payment-api edge function for 3-credential auth**
- Validate `X-API-Key` header (existing)
- Add `X-App-Password` header validation
- Secret key remains for webhook signature verification only (not used for API auth)

**5. Update Integration Guide docs in `MerchantApiTab.tsx`**
- Show all 3 credentials: API Key, App Password, Secret Key
- Update code examples to include `X-App-Password` header
- Update SDK docs accordingly

**6. Update SDK (`public/sdk/easypay-sdk.js`)**
- Add `appPassword` to `init()` config
- Send `X-App-Password` header in requests

### Files to Modify

| File | Change |
|------|--------|
| Migration SQL | Add `app_password` column to `merchant_api_keys` |
| `src/components/MerchantApiTab.tsx` | Show secret key + app password with reveal/copy; update docs |
| `src/components/admin/AdminApiRequests.tsx` | Generate app_password on approval |
| `src/components/admin/AdminMerchantManagement.tsx` | Generate app_password on manual key creation |
| `supabase/functions/merchant-payment-api/index.ts` | Validate app_password header |
| `public/sdk/easypay-sdk.js` | Add appPassword support |

