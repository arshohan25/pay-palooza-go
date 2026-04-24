
## Revised Plan: Advance for Future Preview, Governance, and Safety Upgrade

### Goal
Upgrade `AdminAdvanceForFuture` with the exact behavior requested:

- Device frame switcher: **Mobile / Tablet / Desktop**
- Preview button opens a **popup Android-emulator-style app screen**
- Popup preview shows the related linked app experience: **User / Merchant / Agent / Admin**
- Per-feature **Launch / Preview / Hide** buttons for all 15 items with confirmation dialogs
- Detailed audit log view for bulk launch actions
- Dependency and readiness checklist inside roadmap cards
- Analytics panel for phase/visibility/business impact
- Safety verification that hidden features do not render user/merchant/agent entry points

---

## 1. Device Frame Switcher for App-Style Preview

Add a segmented control in `AdminAdvanceForFuture.tsx`:

```text
Preview Device:  Mobile | Tablet | Desktop
```

The selected frame controls the preview layout sizes:

- **Mobile**: narrow phone frame, Android-emulator style
- **Tablet**: wider tablet frame with 2-column app content
- **Desktop**: full dashboard-style preview frame

This device setting will be used for:

- The existing Original App Preview section
- The new popup preview opened from each feature’s **Preview** button

---

## 2. Preview Button Opens Popup App Emulator

Change the per-feature **Preview** action behavior.

Current behavior:
- Preview button directly sets feature visibility to `disabled`.

New behavior:
- Clicking **Preview** first opens a popup dialog.
- The popup shows how that feature will look inside the related app.
- The popup uses an Android-emulator-style device frame inside the admin dashboard.
- The admin can then confirm **Enable Admin Preview** from the popup.

Popup content will be role-aware:

### User App Popup Preview
Used for:
- AI Financial Copilot
- Real-Time Scam Shield
- EasyPay Trust Score
- Smart Rewards & Offer Engine
- Predictive Loan Eligibility
- Voice & Bengali Assistant
- Risk-Based Dynamic Limits
- Identity Wallet where applicable

Style:
- Wallet-home mockup
- Balance card style
- Quick-action-like tiles
- Glass cards, `rounded-[19px]`, `gradient-hero`

### Merchant App Popup Preview
Used for:
- Merchant Growth OS
- Smart Rewards & Offer Engine
- Bangla QR / Partner API Ecosystem
- Identity Wallet where applicable

Style:
- Merchant dashboard mockup
- Sales, orders, campaign, QR/API readiness cards

### Agent App Popup Preview
Used for:
- Agent Liquidity Intelligence
- Real-Time Scam Shield
- Voice & Bengali Assistant
- Identity Wallet where applicable

Style:
- Agent operations mockup
- Float, cash-in, territory, risk-check cards

### Admin App Popup Preview
Used for:
- Compliance Command Center
- AI Fraud Case Investigator
- Open Finance Data Hub
- Predictive Support Automation
- Dynamic Risk Limits where applicable

Style:
- Admin intelligence mockup
- Compliance, fraud, support, open-finance cards

The popup will clearly show:

- Feature name
- Toggle key
- Target app
- Current visibility
- Device frame
- Preview mockup
- Confirm button: **Enable Admin Preview**
- Cancel button

---

## 3. Consistent Confirmation Dialogs for Each Feature

For all 15 catalog items, replace direct visibility updates with confirmation flows.

Each feature will have:

- **Preview**
  - Opens popup app emulator first
  - Then confirms setting visibility to `disabled`

- **Launch**
  - Opens confirmation dialog
  - Sets visibility to `visible`
  - Shows warning that related app entry points may appear when wired to live flags

- **Hide / Rollback**
  - Opens confirmation dialog
  - Sets visibility to `hidden`

Confirmation dialogs will include:

- Feature title
- Toggle key
- Current visibility
- New visibility
- Phase
- Target app
- Impact
- Complexity
- Readiness percentage
- Launch stage after change

All actions will continue writing audit logs.

---

## 4. Detailed Bulk Launch Audit Log View

Add a new section:

```text
Launch Audit Log
```

It will query `audit_logs` for:

- `future_feature_bulk_visibility_changed`
- `future_feature_visibility_changed`

The view will show:

- Action type
- Actor/admin ID
- Bulk group: Top 7, Phase 1, Phase 2, Phase 3
- Feature keys affected
- Previous visibility values
- New visibility
- Affected count
- Launch stage
- Timestamp

Layout:

- Mobile: stacked timeline cards
- Desktop: compact table/card hybrid
- Long feature key lists shown inside expandable/scrollable detail areas
- Add a refresh button

No database schema change is needed because `audit_logs` already stores `details`.

---

## 5. Dependency and Readiness Checklist in Roadmap Cards

Enhance each Phase 1 / Phase 2 / Phase 3 roadmap card.

Each feature inside a phase will show compact checklist groups:

```text
Data Sources
- Transactions
- KYC
- Orders
- Audit logs
- Support history
- Agent float data

APIs / Backend
- Toggle seeded
- Audit logging active
- Linked backend/RPC/admin module ready where applicable

UI Entry Points
- Admin preview ready
- User/Merchant/Agent entry point dormant
- Live rendering must use visibility === "visible"
```

Implementation approach:

- Extend each `futureFeatures` item with structured checklist metadata:
  - `readinessChecklist.dataSources`
  - `readinessChecklist.apis`
  - `readinessChecklist.uiEntryPoints`
- Render this checklist inside roadmap cards in a compact accordion-like or nested card layout.
- Keep the roadmap readable by showing concise checklist rows instead of large blocks.

---

## 6. Analytics Panel

Add an `Advanced Feature Analytics` panel near the summary counters.

It will show:

- Total recommendations: 15
- Live count
- Admin Preview count
- Hidden count
- Top 7 visibility split
- Phase 1 / Phase 2 / Phase 3 enablement progress
- Estimated business impact by phase
- High-impact features live / preview / hidden
- Complexity distribution

Estimated impact formula:

```text
High impact = 3 points
Medium impact = 2 points
Low impact = 1 point

Live = 100% of points
Admin Preview = 50% of points
Hidden = 0% of points
```

This produces planning-only metrics such as:

```text
Phase 1 estimated impact readiness: 62%
Phase 2 estimated impact readiness: 34%
Phase 3 estimated impact readiness: 18%
```

No customer-facing behavior depends on these analytics.

---

## 7. Hidden Feature Safety Verification

Keep the user/merchant/agent routes safe.

Verified current pattern:
- `Index.tsx`
- `LoanPage.tsx`
- `MerchantDashboard.tsx`
- `AgentDashboard.tsx`

They currently only reference future feature visibility with `void` and do not render visible UI entry points.

Add a safety panel inside `AdminAdvanceForFuture`:

```text
Visibility Safety Check
```

It will show:

- Hidden features are excluded from app-style previews
- Admin Preview features appear only inside admin preview/emulator popup
- Live features are eligible for future app entry points
- User / merchant / agent pages must use `isLive(...)` before rendering future UI
- Current user / merchant / agent app routes do not render hidden future feature entry points

Implementation rule:
- Hidden features must not appear in emulator previews.
- Disabled/Admin Preview features appear only in admin preview areas.
- User/Merchant/Agent pages remain unchanged unless future UI is explicitly gated by `isLive(featureKey)`.

---

## 8. Files to Update

Primary file:

- `src/components/admin/AdminAdvanceForFuture.tsx`

Verification only:

- `src/hooks/use-future-features.ts`
- `src/pages/Index.tsx`
- `src/pages/LoanPage.tsx`
- `src/pages/MerchantDashboard.tsx`
- `src/pages/AgentDashboard.tsx`

No database schema change is required.

---

## 9. Expected Result

After implementation, the admin dashboard will have:

- Mobile/tablet/desktop device frame switcher
- Android-emulator-style popup preview when clicking each feature’s **Preview**
- Role-specific previews for User, Merchant, Agent, and Admin
- Per-feature Preview / Launch / Hide controls with confirmations
- Detailed bulk and per-feature audit log view
- Dependency/readiness checklist in roadmap cards
- Analytics panel for enablement and business impact
- Safety verification that hidden features are not exposed to user/merchant/agent UI

The 15 advanced recommendations remain controlled by feature flags, and nothing appears in user/merchant/agent apps unless explicitly toggled live and wired through `isLive(...)`.
