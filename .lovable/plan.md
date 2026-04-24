
## Make “Preview” Match the Original App Look

### Goal
Update the **Advance for Future** admin module so when a future feature is in **Admin Preview**, the preview does not look like a generic admin card. It should visually resemble the real EasyPay user/merchant/agent app experience: dark glassmorphism, rounded 19px cards, gradient wallet-style panels, compact mobile-first service tiles, and the same premium UI language used in the original app.

### What will change

#### 1. Add an “Original App Preview” section inside Advance for Future
In `src/components/admin/AdminAdvanceForFuture.tsx`, add a dedicated preview area near the top of the page:

```text
Advance for Future
├─ Summary counters
├─ Original App Preview
│  ├─ User App Preview
│  ├─ Merchant App Preview
│  ├─ Agent App Preview
│  └─ Admin Preview
├─ Top 7 Priority Recommendations
├─ 3-Phase Roadmap
├─ Strategic Value Matrix
└─ Full 15-Item Catalog
```

This section will show how launched future features would appear in each app role, without actually exposing them to users yet.

#### 2. Use real EasyPay visual style
The preview cards will follow the original app’s design language:

- `rounded-[19px]`
- `gradient-hero`
- `glass`, `glass-hero`, and translucent cards
- primary emerald/teal fintech gradient
- soft bokeh circles in headers
- compact mobile service-tile layout
- same icon-card rhythm as Quick Actions
- dark mode friendly surfaces
- hidden overflow and polished shadows using existing `shadow-glow`, `shadow-card`, and `shadow-elevated`

#### 3. Add role-based preview mockups

##### User App Preview
Show future user-facing features in a mini home-screen style preview:

- AI Financial Copilot as a wallet insight banner
- Scam Shield as a security warning card
- EasyPay Trust Score as a compact score pill/card
- Smart Rewards as an offer tile
- Predictive Loan Eligibility as a loan readiness tile
- Voice/Bengali Assistant as a floating assistant CTA
- Dynamic Risk Limits as a limit-health badge

This should look like it belongs under the real wallet balance and quick actions area.

##### Merchant App Preview
Show merchant-facing future features in a merchant dashboard style:

- Merchant Growth OS card
- Smart Rewards campaign card
- Bangla QR / Partner API readiness card
- sales trend / reorder suggestion mini metrics

##### Agent App Preview
Show agent/distributor-facing future features:

- Agent Liquidity Intelligence card
- Scam Shield risk-check card
- Bengali Assistant helper tile
- territory/float readiness mini metrics

##### Admin Preview
Show admin-only future intelligence:

- Compliance Command Center
- AI Fraud Case Investigator
- Open Finance Data Hub
- Predictive Support Automation

This stays admin-styled but uses the same premium glass/card treatment.

#### 4. Connect preview visibility to existing feature flags
The preview section will read the same `global_feature_toggles` status already loaded by `AdminAdvanceForFuture`.

Behavior:

- `hidden`: not shown in the preview mockup
- `disabled`: shown as “Admin Preview”
- `visible`: shown as “Live”
- missing toggle: show a small “toggle not seeded” warning only in admin catalog, not inside app preview

This means the admin can click **Preview** on a feature and immediately see how it would look in the app-style preview.

#### 5. Add app/device frame styling
Wrap each role preview in a compact app-frame card:

```text
┌─────────────────────────┐
│ EasyPay User App Preview │
│ ┌─────────────────────┐ │
│ │ gradient insight     │ │
│ │ service tiles        │ │
│ │ security/reward cards│ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

The frame should be responsive:

- desktop: 2-column grid
- tablet: 2-column or stacked based on space
- mobile: stacked full-width cards

#### 6. Improve the existing catalog cards to match app style
The current 15-item catalog is functional but too admin-generic. Update it with:

- softer glass panels
- app-like icon bubbles
- gradient top accents by category
- better compact spacing
- status badges styled consistently with the app
- fewer plain `bg-muted` blocks where a glass surface would look better

The controls remain unchanged:

- Keep Hidden
- Preview
- Launch / Rollback

#### 7. Keep user/merchant/agent apps unchanged for now
This update only changes the admin preview experience.

No new user/merchant/agent visible UI will be added unless a feature is switched to `visible` and app-version wiring is later completed.

### Files to update

Primary:

- `src/components/admin/AdminAdvanceForFuture.tsx`

Optional only if reusable styling is cleaner:

- `src/index.css` for small reusable preview classes, if needed

### Safety rules

- Do not expose future features on public/user/merchant/agent routes in this change.
- Reuse existing feature toggle state.
- Keep one-click launch, phase launch, Top 7 launch, and audit logging behavior intact.
- Do not change the database schema.
- Keep all previews clearly labeled as admin preview/mockup surfaces.

### Expected result

When you open `/admin#advance_future`, the module will no longer feel like a plain admin list only. It will show a polished **original EasyPay app-style preview** so you can see how future features will look inside the real user, merchant, agent, and admin experiences before launching them.
