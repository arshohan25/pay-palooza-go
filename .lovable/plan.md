# External login + role access + per-role installer audit

## Scope

Verify that any external user can (a) reach the right login/signup page, (b) get their role assigned correctly, (c) land on the correct role home, and (d) install a role-specific PWA that opens straight into their role.

## Current state (findings from the codebase)

- **Manifests per role** exist: `manifest-agent.json`, `manifest-merchant.json`, `manifest-distributor.json`, `manifest-super-distributor.json`, `manifest-admin.json`, plus the customer `manifest.json`. Each carries `start_url=/<role>?app=<role>` so an installed PWA is bound to its role via `captureAppRoleFromUrl()` / `AppRoleEnforcer`.
- **Per-role login pages** exist: `AgentLoginPage`, `DistributorLoginPage`, `SuperDistributorLoginPage`, `AdminLoginPage`, `MerchantLoginPage`. `RoleLoginPage` routes `/login/:role` to the right one; customers use `AuthPage`.
- **Route guards** (`RoleGuard`, `RoleGuardLayout`) already redirect unauthenticated users to `/login/<role>` and role‑mismatched users back too.
- **Install page** (`/install`, `/install/:role`) swaps the manifest tag per role and exposes install / share links.

## Known gaps to fix

1. **External agent registration is unreachable.** `AgentRegister` sits at `/agent/register`, i.e. inside the agent `RoleGuard`. An unauthenticated prospective agent gets bounced to `/login/agent` and can never open the self-serve KYC signup. Fix: expose a public route `/register/agent` (and add "Register as agent" link on `AgentLoginPage`). Same audit for distributor/super-distributor: they are upstream-created, so add a clear "Contact distributor/admin" note on their login pages instead of a signup link.
2. **Merchant apply CTA discoverability.** Confirm `MerchantLoginPage` links to `/merchant-apply` for new merchants; add if missing.
3. **Customer signup path from install page.** From `/install` (customer PWA), first-run should land on `/` (AuthPage). Verify no accidental role redirect steals unauthenticated visitors.
4. **`captureAppRoleFromUrl()` must run on cold boot** for installed PWAs so `?app=<role>` binds before the RoleGuard evaluates. Confirm it is called from `main.tsx` (or top-level) and not only inside a guarded page.
5. **Post-login redirect matches bound app role.** After successful login on `/login/<role>`, ensure we send to `APP_ROLE_HOME[role]`, not the customer home. Currently `RoleLoginPage` does this only on the wrapper effect — verify each dedicated login page (agent/distributor/…) also honors it.
6. **Role assignment for new signups.** For self-serve merchant apply and agent register: on approval, `user_roles` must gain the correct role row. Spot-check the approval RPCs / edge functions and their handlers.
7. **Sanity check RoleGuard loading state** so it never traps external users on a spinner if `useUserRoles` returns `[]` for a brand-new session; should still redirect to `/login/<role>`.

## Changes I will make

- Add public route `/register/agent` → `AgentRegister` (outside `/agent` guard).
- Add `Register as new agent` link on `AgentLoginPage` → `/register/agent`.
- Add `Apply as merchant` link on `MerchantLoginPage` → `/merchant-apply` (only if missing).
- Add small "Accounts are created by your distributor / admin" note on distributor, super-distributor, and admin login pages.
- Ensure `captureAppRoleFromUrl()` runs in `main.tsx` before React mounts.
- On each dedicated login page's success handler, redirect to `APP_ROLE_HOME[role]` (or `/agent`, `/merchant`, etc.) — confirm/fix.
- Quick check + fix of the install page routing so `/install` without a role always renders the picker and `/install/<role>` renders the role card. No behavior change if already correct.

## Out of scope

- No manifest icon regeneration, no new roles, no backend schema changes.
- No changes to KYC content, only to route accessibility.

## Verification

- `bunx vitest run` on any existing role/login/redirect tests (`app-role-redirects.test.ts`, `role-login-pages.spec.ts`, `role-install-share.spec.ts`).
- Manual: hit `/install/agent`, `/login/agent`, `/register/agent`, `/login/merchant`, `/login/distributor` while signed out and confirm the correct page renders without redirect loops.
