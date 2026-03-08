

## Plan: Add Missing Feature Toggle Keys

### Current State
The `global_feature_toggles` table already has 13 entries: `send_money`, `cash_out`, `cash_in`, `add_money`, `payment`, `mobile_recharge`, `pay_bill`, `bank_transfer`, `qr_scan`, `refer`, `savings`, `shop`, `drive_offers`.

### Missing Feature Keys
The "More Services" section has 5 features without toggle entries. These need to be inserted:

| Feature Key | Label | Sort Order |
|---|---|---|
| `coupons` | Coupons & Offers | 14 |
| `donations` | Donations | 15 |
| `loan` | Loan | 16 |
| `insurance` | Insurance | 17 |
| `gift_cards` | Gift Cards | 18 |

### Code Fix
In `FEATURE_MAP`, `shop` currently maps to `"payment"` instead of `"shop"`. This will be corrected. Also, add the 5 new feature keys to `FEATURE_MAP` so the grayscale/disabled logic applies to them too, and add `featureKey` to each of the "coming soon" moreServices items.

Additionally, add missing mappings for `add_money`, `cash_in`, and `qr_scan` features that exist in the DB but aren't in `FEATURE_MAP` — these are triggered from other parts of the UI but should be consistent.

### Files Modified
- **Data insert**: 5 new rows into `global_feature_toggles`
- `src/components/QuickActions.tsx` — fix `shop` mapping, add new feature keys to `FEATURE_MAP` and `moreServices` items

