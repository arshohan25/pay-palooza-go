Plan to add recommended remediation actions to the User Intelligence Center:

1. Make the risk tabs controllable
   - Change the current internal tabs from `defaultValue` to React state so buttons can navigate to `timeline`, `risk`, `records`, `notes`, or `actions` with one click.

2. Generate recommended actions from live risk data
   - Add a helper that reads the selected user’s current score, KYC status, device count, fraud alerts, profile status, and high-value transactions.
   - Recommended actions will include examples such as:
     - Request KYC / KYC resubmission when KYC is missing or rejected.
     - Review registered devices when multiple devices contributed to risk.
     - Verify high-value transfers when transactions >= ৳50,000 are present.
     - Review fraud alerts when fraud records exist.
     - Add to watchlist or restrict account for high-risk / investigation-level users.
     - Open case notes for follow-up documentation.

3. Add a remediation panel near the risk score
   - Display a compact “Recommended remediation” card under the metric cards.
   - Each item will show priority, reason, and a short admin instruction.
   - Use existing glass/card styling and badges so it matches the admin UI.

4. Add one-click navigation and logging
   - Each recommended action will include a button that switches directly to the relevant tab:
     - KYC / transfers / devices / fraud -> `Records`
     - score details -> `Risk`
     - case documentation -> `Notes`
     - operational controls -> `Actions`
   - For audit-oriented actions like “Request KYC” or “Add Watchlist”, reuse the existing `insertAudit` pattern and show success toasts.

Technical details:
- Main file: `src/components/admin/AdminCommandIntelligence.tsx`.
- No database schema changes are needed.
- The implementation will reuse the already-loaded `detail` object, including `detail.score`, `detail.kyc`, `detail.devices`, `detail.fraud`, and `detail.transactions`.
- After implementation, run TypeScript/build validation to catch JSX or type issues.