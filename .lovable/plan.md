

## Add "Create Agent" to Admin Agent Management Hub

### Summary
Add a "Create Agent" button + dialog to the `AgentListTab` in the Admin Agent Hub, allowing admins to onboard new agents directly — similar to the existing Distributor→Agent creation flow.

### Changes to `src/components/admin/AdminAgentHub.tsx`

1. **Add "+" button** next to the search bar or status cards — opens a Dialog for creating a new agent.

2. **Create Agent Dialog** with fields:
   - Phone Number (required, with validation)
   - Full Name
   - Business Name
   - Territory Code
   - NID Number
   - Trade License
   - Max Float (default 500,000)

3. **Creation logic** (mirrors `DistributorCreateAgent`):
   - Clean phone, generate random 4-digit PIN
   - Create auth account via `signUpWithPhonePassword`
   - Create profile record
   - Assign `agent` role in `user_roles`
   - Create `agents` row with business details
   - Toast success + reload list

4. **UI placement**: A `UserPlus` icon button beside the search input, or a full "Add Agent" button above the table.

### File Modified
1. `src/components/admin/AdminAgentHub.tsx` — add create agent dialog and handler to `AgentListTab`

