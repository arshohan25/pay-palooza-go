# Restrict API access status banner to API tab only

## Problem
The API access request status card (the one in your screenshot showing "API access request submitted", the timeline, and "Follow up in Live Chat") is currently rendered on the merchant **Overview** tab. You want it to appear **only** on the **API Integration** tab.

## Root cause
In `src/pages/MerchantDashboard.tsx`:
- Line 522 renders `<MerchantApiAccessStatusBanner />` inside the `overview` tab block.
- Lines 615–621 render the API tab, which already shows `<MerchantApiAccessGate />` when `apiLocked` is true and `<MerchantApiTab />` otherwise.

So the status banner is currently dashboard-wide instead of API-tab-scoped.

## Change
Single file: `src/pages/MerchantDashboard.tsx`

1. **Remove** the banner from the Overview tab (line 522).
2. **Add** the banner inside the API tab block (lines 615–621) so it appears above either the gate or the unlocked API tab content. This way:
   - Locked merchants on the API tab see: status banner (timeline + Follow up in Live Chat) + the gate CTA below.
   - Approved merchants on the API tab see: status banner (briefly, until dismissed) + the full API tab.
   - Every other tab (Overview, Products, Orders, etc.) shows nothing related to API access.

Resulting structure for the API tab:
```text
{activeTab === "api" && merchant && (
  <div className="px-4 py-4 space-y-4">
    <MerchantApiAccessStatusBanner userId={user!.id} merchantId={merchant.id} visible={!isStaff} />
    {apiLocked
      ? <MerchantApiAccessGate userId={user!.id} merchantId={merchant.id} />
      : <MerchantApiTab merchantId={merchant.id} />}
  </div>
)}
```

## Out of scope
- No changes to the banner component itself, redaction, i18n, prefill, or routing.
- No database changes.

Approve to apply.