

# Add More Unlockable Features to Global Feature Toggles

## What This Does
Insert new premium/advanced features into `global_feature_toggles` that are globally enabled but **hidden for New and Basic users** via badge-level overrides. These features become available as reward unlocks for admins to grant as users grow.

## New Features to Add

| Feature Key | Label | Description |
|---|---|---|
| `account_budget_manager` | Budget Manager | Set spending budgets and track limits |
| `account_scheduled_payments` | Scheduled Payments | Schedule recurring transfers |
| `account_transaction_export` | Export Transactions | Download transaction history as CSV/PDF |
| `account_favorites` | Favorite Contacts | Save frequently used recipients |
| `account_auto_save` | Auto Save | Automatic savings from transactions |
| `account_bill_reminders` | Bill Reminders | Get notified before bill due dates |
| `account_split_bill` | Split Bill | Split payments among friends |
| `account_virtual_card` | Virtual Card | Generate virtual debit cards |
| `account_cashback_rewards` | Cashback Rewards | Earn cashback on transactions |
| `account_priority_support` | Priority Support | Access to priority customer support |
| `account_multi_wallet` | Multi Wallet | Create multiple wallet accounts |
| `account_transaction_tags` | Transaction Tags | Tag and categorize transactions |

## Badge Override Strategy
- **New** users: All 12 features hidden
- **Basic** users: 8 features hidden (unlock budget, favorites, bill reminders, transaction tags)
- **Active** users: 4 features hidden (unlock most, keep virtual card, cashback, priority support, multi wallet locked)
- **Power** users: All visible by default

## Data Changes (no code changes needed)
1. **INSERT** 12 rows into `global_feature_toggles` (all `is_enabled: true`, `visibility: visible`)
2. **INSERT** badge-level overrides into `user_feature_overrides`:
   - 12 overrides for `new` badge (all hidden)
   - 8 overrides for `basic` badge
   - 4 overrides for `active` badge

## Technical Details
- Uses the `supabase--read_query` insert tool for data operations (no migration needed)
- The existing `useGlobalToggles` hook and `AdminUserPerformanceTracker` feature unlock dropdown will automatically pick up these new features
- Admins can individually unlock any feature for any user via the Assign Reward dialog

