

## Make Fee Rules Tab Fully Editable with Add/Edit Support

### Summary
Add full CRUD capabilities to the Fee Rules tab in System Settings, allowing admins to add new fee rules and edit existing ones inline — matching the existing `AdminChargeConfig` component's functionality.

### Changes to `FeeRulesTab` in `src/components/admin/AdminSystemSettings.tsx`

1. **Add "Add Rule" button** — next to the summary cards, a `Plus` button opens a Dialog to create a new fee rule with fields: Transaction Type, Fee Type (flat/percentage), Fee Value, Min Amount, Max Amount, Active toggle.

2. **Add Edit button per row** — a `Pencil` icon button on each row opens the same Dialog pre-filled with that rule's data for editing.

3. **Add Delete capability** — a `Trash2` icon on each row to remove a rule (with confirmation).

4. **Dialog form** — reuses the same pattern from `AdminChargeConfig`: select for txn_type, select for fee_type, number inputs for value/min/max, switch for active. Saves via `supabase.from("fee_config").insert/update`.

5. **Commission fields** — include optional agent_commission, distributor_commission, platform_share fields in the dialog for advanced configuration.

### Technical Details
- All DB operations use the existing `fee_config` table (no migrations needed)
- Dialog state managed with `useState` for `dialogOpen` and `editing` (null = add mode)
- After save, re-fetch the fee list
- Transaction types: send, cashout, cashin, payment, recharge, paybill, addmoney, banktransfer
- Fee types: flat, percentage

### File Modified
1. `src/components/admin/AdminSystemSettings.tsx` — refactor `FeeRulesTab` with add/edit/delete dialog

