

## Plan: Admin-Controlled Account Page Feature Toggles

### Approach
Use the existing `global_feature_toggles` system. Seed new toggle entries for each Account page feature, then wrap each feature row in the Account page with a visibility check using the existing `useGlobalToggles` hook.

### Database Changes (1 migration)

Seed ~20 new toggle entries for Account page features:

```sql
INSERT INTO global_feature_toggles (feature_key, label, description, is_enabled, sort_order) VALUES
  ('account_edit_profile', 'Edit Profile', 'Account: Edit profile option', true, 100),
  ('account_kyc', 'KYC Verification', 'Account: KYC verification option', true, 101),
  ('account_change_pin', 'Change PIN', 'Account: Change PIN option', true, 102),
  ('account_refer', 'Refer a Friend', 'Account: Referral option', true, 103),
  ('account_become_merchant', 'Become a Merchant', 'Account: Merchant application', true, 104),
  ('account_language', 'Language Switch', 'Account: Language toggle', true, 105),
  ('account_theme', 'Theme Switch', 'Account: Theme toggle', true, 106),
  ('account_icon_size', 'Icon Size', 'Account: Icon size setting', true, 107),
  ('account_grid_layout', 'Grid Layout', 'Account: Grid layout setting', true, 108),
  ('account_compact_mode', 'Compact Mode', 'Account: Compact mode toggle', true, 109),
  ('account_rearrange_actions', 'Rearrange Quick Actions', 'Account: Drag & drop setting', true, 110),
  ('account_onboarding', 'View Onboarding', 'Account: Replay onboarding', true, 111),
  ('account_spending_insights', 'Spending Insights', 'Account: Spending insights page', true, 112),
  ('account_limits_charges', 'Limits & Charges', 'Account: Limits page', true, 113),
  ('account_push_notifications', 'Push Notifications', 'Account: Push notification toggle', true, 114),
  ('account_promo_alerts', 'Promotional Alerts', 'Account: Promo alerts toggle', true, 115),
  ('account_live_chat', 'Live Chat', 'Account: Support chat', true, 116),
  ('account_email_support', 'Email Support', 'Account: Email support option', true, 117),
  ('account_my_tickets', 'My Tickets', 'Account: Support tickets', true, 118),
  ('account_biometric', 'Biometric Login', 'Account: Biometric toggle', true, 119),
  ('account_2fa', 'Two-Factor Auth', 'Account: 2FA toggle', true, 120),
  ('account_blocked_users', 'Blocked Users', 'Account: Blocked users page', true, 121);
```

### Frontend Changes

| File | Change |
|------|--------|
| `src/pages/AccountPage.tsx` | Import `useGlobalToggles`, wrap each `MenuRow`/`ToggleRow` with `!isDisabled('account_xxx')` conditional rendering so disabled features are hidden |

### How It Works
- Admin goes to Global Toggles panel (already exists), sees the new account feature toggles
- Admin turns off e.g. "Refer a Friend" → the row disappears from the user's Account page in real-time
- No new UI needed on the admin side — the existing Global Toggles panel handles everything
- Real-time sync already works via the `useGlobalToggles` hook's Supabase subscription

### Technical Details
- Each Account page row gets a simple conditional: `{!isDisabled('account_refer') && <MenuRow ... />}`
- Empty sections are auto-hidden when all their children are disabled
- The existing admin "Enable All" / "Disable All" bulk actions work with these new toggles too

