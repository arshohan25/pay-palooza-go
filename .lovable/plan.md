

## Fix: Consistent Name Display Across BalanceCard and SideNav

### Problem
The BalanceCard and SideNav derive the user's display name differently:

- **BalanceCard** (`userName`): If no `profileName`, falls back to a masked phone format like `+880 017****890`
- **SideNav** (`displayName`): If no `profileName`, falls back to raw localStorage value or `"My Wallet"`

This causes the two components to show different names when the user hasn't set a profile name.

### Solution
Unify both components to use the same name derivation logic from `useProfile`, and apply the same fallback strategy.

### Changes

#### `src/hooks/use-profile.ts`
- Add a computed `displayName` field to the hook's return value that applies the consistent fallback logic:
  1. Database `name` (if set)
  2. Masked phone (`+880 017****890`) if phone is available
  3. `"My Wallet"` as final fallback
- This centralizes the logic so all consumers get the same result

#### `src/components/BalanceCard.tsx`
- Replace the local `userName` useMemo with `displayName` from `useProfile()`
- Remove redundant phone-masking logic

#### `src/components/SideNav.tsx`
- Replace the local `displayName` variable with `displayName` from `useProfile()`
- Remove the localStorage fallback chain

### Result
Both components (and any future consumers) will always show the same name, derived from a single source of truth in `useProfile`.

