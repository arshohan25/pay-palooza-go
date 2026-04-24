
## Expand “Advance for Future” to Full 15-Item Strategic Roadmap

### Goal
Upgrade the existing **Advance for Future** admin module from the current 8-card foundation into a complete strategic release-planning command center with:

- 15 advanced recommendations
- 3-phase roadmap view
- Top 7 priority section
- Business impact vs implementation complexity grouping
- One-click launch controls for a full phase or Top 7 set
- Status and feature toggle key shown for every item
- All user/merchant/agent visibility still controlled through feature flags

---

## 1. Expand the Future Feature Catalog from 8 to 15

The existing `futureFeatures` list in `src/components/admin/AdminAdvanceForFuture.tsx` will be expanded to a full 15-item catalog.

### 15 advanced recommendation items

1. **AI Financial Copilot**
   - Key: `future_ai_copilot`
   - Target: User app
   - Value: Personalized financial guidance, spending insights, budget nudges

2. **Real-Time Scam Shield**
   - Key: `future_scam_shield`
   - Target: User / Agent app
   - Value: Transaction risk warnings before send/cash-out/payment

3. **EasyPay Trust Score**
   - Key: `future_easypay_score`
   - Target: User app
   - Value: Alternative-data trust scoring for loans, limits, and offers

4. **Compliance Command Center**
   - Key: `future_compliance_center`
   - Target: Admin app
   - Value: LEA integrity, audit trail, report hashing, SAR review readiness

5. **Agent Liquidity Intelligence**
   - Key: `future_agent_liquidity_intel`
   - Target: Agent / Distributor app
   - Value: Predict float shortages and restock needs

6. **Merchant Growth OS**
   - Key: `future_merchant_growth_os`
   - Target: Merchant app
   - Value: Sales trends, reorder suggestions, retention opportunities

7. **Identity Wallet & Passkey Security**
   - Key: `future_identity_wallet`
   - Target: User / Merchant / Agent app
   - Value: Reusable KYC profile, passkey-ready security, device trust

8. **Bangla QR / Partner API Ecosystem**
   - Key: `future_partner_qr_api`
   - Target: Merchant / Partner app
   - Value: Interoperable QR payments, API/webhook partner readiness

9. **Predictive Loan Eligibility**
   - Key: `future_predictive_loan_eligibility`
   - Target: User app
   - Value: Pre-qualified Qard Hasan eligibility and smart repayment guidance

10. **AI Fraud Case Investigator**
    - Key: `future_ai_fraud_investigator`
    - Target: Admin app
    - Value: Summarizes suspicious activity, user patterns, and recommended actions

11. **Smart Rewards & Offer Engine**
    - Key: `future_smart_rewards_engine`
    - Target: User / Merchant app
    - Value: Personalized cashback, retention campaigns, lifecycle offers

12. **Voice & Bengali Assistant**
    - Key: `future_bangla_voice_assistant`
    - Target: User / Agent app
    - Value: Bengali voice guidance for payments, support, and accessibility

13. **Open Finance Data Hub**
    - Key: `future_open_finance_hub`
    - Target: Admin / Partner app
    - Value: Future-ready consented data sharing and external financial integrations

14. **Predictive Support Automation**
    - Key: `future_predictive_support`
    - Target: User / Admin app
    - Value: Detect likely support issues before tickets are opened

15. **Risk-Based Dynamic Limits**
    - Key: `future_dynamic_risk_limits`
    - Target: User / Admin app
    - Value: Adjust limits based on trust score, fraud signals, KYC, and behavior

---

## 2. Add 3-Phase Roadmap View

Inside `AdminAdvanceForFuture`, add a dedicated **Roadmap** section with three phase columns/cards.

### Phase 1 — Immediate Competitive Advantage
Focus: Safety, compliance, trust, and admin-ready intelligence.

Includes:

- Real-Time Scam Shield
- Compliance Command Center
- AI Fraud Case Investigator
- AI Financial Copilot
- Smart Rewards & Offer Engine

### Phase 2 — Revenue and Ecosystem Growth
Focus: Lending, merchant growth, agent network performance, partner expansion.

Includes:

- EasyPay Trust Score
- Predictive Loan Eligibility
- Merchant Growth OS
- Agent Liquidity Intelligence
- Bangla QR / Partner API Ecosystem
- Risk-Based Dynamic Limits

### Phase 3 — Future Platform Differentiation
Focus: Identity, voice, open finance, predictive support.

Includes:

- Identity Wallet & Passkey Security
- Voice & Bengali Assistant
- Open Finance Data Hub
- Predictive Support Automation

Each phase will show:

- Number of recommendations
- Live / Preview / Hidden count
- Average readiness
- Business goal
- One-click controls:
  - Launch phase to apps
  - Preview phase in admin
  - Hide phase / rollback

---

## 3. Add Business Impact and Complexity Grouping

Add a new planning section named **Strategic Value Matrix**.

Each of the 15 recommendations will include:

- Business impact: `High`, `Medium`, `Low`
- Implementation complexity: `High`, `Medium`, `Low`
- Strategic category:
  - Revenue Growth
  - Risk & Compliance
  - User Retention
  - Merchant Growth
  - Agent Operations
  - Platform Infrastructure
  - Identity & Security

### Matrix groups

1. **High Impact / Low-Medium Complexity**
   - Quick wins and near-term release candidates

2. **High Impact / High Complexity**
   - Strategic bets requiring phased rollout

3. **Medium Impact / Low Complexity**
   - Useful enhancements for version upgrades

4. **Medium Impact / High Complexity**
   - Future roadmap items that need more preparation

This will help plan release order directly from the admin dashboard.

---

## 4. Add Top 7 Priority Section

Add a prominent **Top 7 Priority Recommendations** section near the top of the module.

### Top 7 ranking

1. **Real-Time Scam Shield**
   - Why: Highest trust and safety value; prevents fraud before money leaves the wallet

2. **AI Financial Copilot**
   - Why: Drives engagement and differentiates user experience

3. **Compliance Command Center**
   - Why: Strengthens legal defensibility and regulator readiness

4. **EasyPay Trust Score**
   - Why: Foundation for lending, dynamic limits, offers, and risk controls

5. **Merchant Growth OS**
   - Why: Direct merchant retention and revenue-growth opportunity

6. **Agent Liquidity Intelligence**
   - Why: Improves field reliability and distributor operations

7. **Smart Rewards & Offer Engine**
   - Why: Improves retention, campaign targeting, and transaction frequency

Each Top 7 item will show:

- Rank number
- Toggle key
- Current visibility status
- Target app
- Business impact
- Complexity
- Reason for priority
- Quick launch/preview/hide controls

---

## 5. Add One-Click Bulk Launch Controls

Add bulk action controls to `AdminAdvanceForFuture`.

### Bulk controls to implement

1. **Launch Top 7 to App**
   - Sets all Top 7 feature toggles to:
     - `visibility = 'visible'`
     - `is_enabled = true`

2. **Preview Top 7 in Admin**
   - Sets all Top 7 feature toggles to:
     - `visibility = 'disabled'`
     - `is_enabled = false`

3. **Hide Top 7**
   - Sets all Top 7 feature toggles to:
     - `visibility = 'hidden'`
     - `is_enabled = false`

4. **Launch Phase 1 / 2 / 3**
   - Bulk-launches every item in that phase

5. **Preview Phase 1 / 2 / 3**
   - Bulk-previews every item in that phase

6. **Hide Phase 1 / 2 / 3**
   - Bulk-hides every item in that phase

### Safety behavior

Before a bulk launch, show a confirmation dialog summarizing:

- Action being taken
- Number of features affected
- Feature keys affected
- Target apps affected
- Current hidden/preview/live counts
- Warning that user/merchant/agent apps may show feature entry points once visible

---

## 6. Seed Missing Feature Toggle Keys

Add a database migration to seed the new missing feature toggle keys.

Existing keys will remain untouched.

New keys to seed:

- `future_predictive_loan_eligibility`
- `future_ai_fraud_investigator`
- `future_smart_rewards_engine`
- `future_bangla_voice_assistant`
- `future_open_finance_hub`
- `future_predictive_support`
- `future_dynamic_risk_limits`

All will default to:

- `is_enabled = false`
- `visibility = 'hidden'`

Existing 8 keys will remain compatible.

---

## 7. Update Future Feature Hook

Update `src/hooks/use-future-features.ts` so the frontend knows all 15 future feature keys.

This keeps the dormant integration pattern ready for future app-version upgrades while still hiding user-facing UI unless the admin changes a toggle to visible.

---

## 8. Improve Admin UI Layout

Update `AdminAdvanceForFuture.tsx` with a clear structure:

```text
Advance for Future
├─ Summary counters
│  ├─ Total 15
│  ├─ Top 7
│  ├─ Live
│  ├─ Preview
│  └─ Hidden
│
├─ Top 7 Priority Recommendations
│  └─ ranked high-impact cards
│
├─ 3-Phase Roadmap
│  ├─ Phase 1
│  ├─ Phase 2
│  └─ Phase 3
│
├─ Strategic Value Matrix
│  ├─ High Impact / Lower Complexity
│  ├─ High Impact / High Complexity
│  ├─ Medium Impact / Lower Complexity
│  └─ Medium Impact / High Complexity
│
└─ Full 15-Item Catalog
   └─ every recommendation with status, key, phase, impact, complexity, target, readiness, links, and launch controls
```

The UI will follow the existing admin style:

- Dark glassmorphism-compatible cards
- Compact badges
- Mobile-friendly stacked sections
- Desktop grid/table hybrid
- Existing button/card patterns
- No new public route exposure

---

## 9. Audit Logging for Bulk Actions

Extend the existing audit logging in `AdminAdvanceForFuture` so every bulk action logs:

- Action type
- Bulk group: `top_7`, `phase_1`, `phase_2`, or `phase_3`
- Feature keys changed
- Previous visibility values
- New visibility value
- Admin actor ID
- Timestamp

This keeps one-click launch behavior traceable.

---

## Files to Update

Primary:

- `src/components/admin/AdminAdvanceForFuture.tsx`
- `src/hooks/use-future-features.ts`

Database:

- `supabase/migrations/..._seed_future_advanced_recommendations.sql`

Optional if needed:

- Existing user/merchant/agent pages only if any dormant references need to recognize the new 15 keys:
  - `src/pages/Index.tsx`
  - `src/pages/LoanPage.tsx`
  - `src/pages/MerchantDashboard.tsx`
  - `src/pages/AgentDashboard.tsx`

---

## Expected Result

The **Advance for Future** admin dashboard will clearly include:

- Full 15-item advanced recommendation catalog
- 3-phase roadmap
- Top 7 priority ranking
- Business impact and complexity grouping
- Feature toggle key and status for every recommendation
- One-click launch controls for Top 7 and each phase
- Safe confirmation before bulk rollout
- Audit logs for traceability

User, merchant, and agent apps will still remain unchanged unless a feature toggle is switched to visible from the admin dashboard.
