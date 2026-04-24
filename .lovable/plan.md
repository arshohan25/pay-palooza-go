
## Integrate “Advance for Future” in Admin Dashboard

### Goal
Add a new admin dashboard section named **Advance for Future** that centralizes all advanced roadmap features, keeps them hidden from user/merchant/agent apps by default, and gives admins one-click launch controls for future app-version releases.

### What will be built

#### 1. New Admin Navigation Section
Add a new admin nav item:

- Section: **⭐ Pro Fintech** or a new group named **Future**
- Item label: **Advance for Future**
- Route/hash: `/admin#advance_future`

This will open a new admin module instead of exposing anything to public app users.

#### 2. New `AdminAdvanceForFuture` Dashboard
Create a new component:

- `src/components/admin/AdminAdvanceForFuture.tsx`

It will include advanced feature cards for:

1. **AI Financial Copilot**
   - Spending insights
   - Low-balance prediction
   - Personalized budget/offer recommendations
   - Admin status and launch toggle

2. **Real-Time Scam Shield**
   - Risk warnings before Send Money / Cash Out / Payment
   - Velocity, recipient history, device, and unusual amount checks
   - Admin sensitivity control: Monitor / Warn / Block

3. **EasyPay Trust Score**
   - Alternative-data score using account age, KYC, transaction history, repayment behavior, fraud flags
   - Used later for loan eligibility, offers, and limits
   - Admin preview and enable control

4. **Compliance Command Center**
   - LEA report integrity
   - Report hash verification
   - Suspicious activity timeline
   - Audit readiness status

5. **Agent Liquidity Intelligence**
   - Float shortage prediction
   - Territory risk ranking
   - Distributor restock recommendations
   - Link to existing Liquidity/Agent modules

6. **Merchant Growth OS**
   - Sales trend insights
   - Inventory reorder recommendations
   - Customer retention opportunities
   - Link to merchant analytics and inventory alerts

7. **Identity & Security Upgrades**
   - Passkey-ready security placeholder
   - Verifiable KYC wallet status
   - Device trust scoring
   - Linked to Device Manager, KYC, and Security Center

8. **Bangla QR / Partner Ecosystem**
   - QR interoperability readiness
   - API/webhook readiness
   - Partner launch controls
   - Linked to Developer Portal/API Hub

#### 3. One-Click Future Release Controls
Use the existing `global_feature_toggles` system so every advanced feature has a hidden toggle by default.

New feature keys will be seeded as hidden/disabled:

- `future_ai_copilot`
- `future_scam_shield`
- `future_easypay_score`
- `future_compliance_center`
- `future_agent_liquidity_intel`
- `future_merchant_growth_os`
- `future_identity_wallet`
- `future_partner_qr_api`

Each card will show:

- Current visibility: Hidden / Disabled / Visible
- Current launch stage: Planned / Admin Ready / App Ready / Live
- Target app: User / Merchant / Agent / Admin
- Risk level
- Dependencies
- One-click action:
  - **Keep Hidden**
  - **Preview in Admin**
  - **Launch to App**
  - **Rollback / Hide**

The actual user/merchant/agent UI will stay hidden until the corresponding feature key is changed to `visible`.

#### 4. Admin-Only Preview Links
Each feature card will link to existing admin modules where possible:

- AI Copilot → AI Agent / User Performance
- Scam Shield → AI Fraud / Risk Control / Fraud Alerts
- EasyPay Score → Loan Management / User Metrics
- Compliance → LEA Request / Audit Log / Data Export
- Agent Liquidity → Liquidity / Agent Hub / Float Management
- Merchant Growth OS → Merchant Management / E-Commerce / Inventory Alerts
- Identity Security → KYC / Device Manager / Security Center
- Partner QR/API → API Hub / Developer Portal / Webhooks

This makes the new hub immediately useful without duplicating every existing admin tool.

#### 5. Hidden App Integration Hooks
Add lightweight, non-visible hooks in the user app so future releases can be turned on cleanly:

- Add feature flag awareness for future feature keys.
- Keep all future app entry points hidden when visibility is `hidden`.
- If changed to `visible`, the related card/route/CTA can appear without needing manual database changes.
- For now, no user/merchant/agent-visible buttons will appear.

Where appropriate, existing flows will receive dormant guards:

- Send Money / Cash Out / Payment: prepare `future_scam_shield` risk-warning hook, disabled by default.
- Loan page: prepare `future_easypay_score` scoring hook, hidden by default.
- Spending insights/home: prepare `future_ai_copilot` entry point, hidden by default.
- Merchant dashboard: prepare `future_merchant_growth_os` entry point, hidden by default.
- Agent dashboard: prepare `future_agent_liquidity_intel` entry point, hidden by default.

#### 6. Backend/Database Work
Add a database migration to seed future feature toggles into the existing `global_feature_toggles` table.

No roles will be stored on profiles/users. Existing role and admin access patterns will be respected.

Audit logging will be added when admins launch, hide, or change stage for a future feature.

#### 7. UI/UX Style
The new module will follow the project’s existing admin style:

- Dark glassmorphism-compatible cards
- Compact responsive layout
- Badges for status/stage/risk
- Mobile card layout
- Desktop grid/table hybrid
- No exposure to public app routes unless explicitly launched

### Files to touch

Primary:

- `src/pages/AdminDashboard.tsx`
- `src/components/admin/AdminAdvanceForFuture.tsx`

Likely supporting updates:

- `src/components/QuickActions.tsx`
- `src/pages/Index.tsx`
- `src/pages/LoanPage.tsx`
- `src/pages/MerchantDashboard.tsx`
- `src/pages/AgentDashboard.tsx`
- `src/hooks/use-global-toggles.ts`
- `supabase/migrations/..._seed_advance_future_toggles.sql`

### Safety Rules

- All future features default to hidden.
- No user/merchant/agent app UI appears until admin changes visibility.
- All launch/hide actions are logged in audit logs.
- Existing feature toggle and role guard systems will be reused.
- No hardcoded admin access or client-side role bypasses.
- AI logic will use Lovable AI through backend functions only if any new AI generation is needed.

### Expected Result

Admins will get a new **Advance for Future** command center where all advanced competitive features are integrated, tracked, linked to existing admin modules, and controlled with one-click launch toggles.

Users, merchants, and agents will not see these features now. When you decide to release one in a future app upgrade, the admin can switch it from hidden to visible and the prepared app entry point will appear.
