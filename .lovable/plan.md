

## Plan: Add AsthaPay default fields to Admin Gateway Config

### Problem
The `DEFAULT_FIELDS` map in `AdminGatewayConfig.tsx` has no entry for `asthapay`. When an admin opens the AsthaPay gateway to configure credentials, no fields appear — they'd have to manually add each one. The edge function expects keys `api_key`, `secret_key`, and `brand_key` in the config JSONB.

### Change
Add one line to the `DEFAULT_FIELDS` object in `src/components/admin/AdminGatewayConfig.tsx`:

```typescript
asthapay: ["api_key", "secret_key", "brand_key"],
```

This ensures the admin sees three pre-populated credential fields when editing the AsthaPay gateway, and the keys match exactly what the edge function reads.

### Files
- **Edit**: `src/components/admin/AdminGatewayConfig.tsx` — add `asthapay` entry to `DEFAULT_FIELDS`

