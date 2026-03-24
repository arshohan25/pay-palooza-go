

## Plan: Clone Permissions from Existing Member

### What It Does
Adds a "Clone from member" option in the permission configuration step (Step 2) of the Add Member dialog. When creating a new team member, the admin can select an existing member from a dropdown, and that member's exact permission grid is copied into the new member's permission editor.

### Changes

**File: `src/components/admin/AdminTeamManagement.tsx`**

1. **Add "Clone from member" dropdown** in the `PermissionEditor` component, next to the existing Preset selector. It will:
   - Show a `Select` dropdown listing all current team members by display name
   - Accept a `members` prop (the loaded `TeamMember[]` list)
   - On selection, fetch that member's `team_access_permissions` from the database and populate the permission grid

2. **Pass `members` prop** to `PermissionEditor` from both the Add dialog (Step 2) and the Edit dialog.

3. **Fetch and apply cloned permissions**: When a member is selected from the clone dropdown:
   - Query `team_access_permissions` for that member's `user_id`
   - Map results into the `AccessPerm[]` format (filling missing sections with no access)
   - Call `onChange(clonedPerms)` to update the grid

4. **UI placement**: The clone dropdown sits on the same row as the preset selector, with a `Copy` icon and "Clone from:" label. Selecting a clone clears the preset selection and vice versa.

### No database changes needed.

