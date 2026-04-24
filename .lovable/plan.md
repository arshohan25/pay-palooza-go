
## Fix Advance for Future previews so features show as Android-style app emulators

### Goal
Update `AdminAdvanceForFuture` so every **Preview** action shows the selected future features inside a realistic app-screen emulator instead of a generic confirmation card like the screenshot.

This applies to:

- Per-feature **Preview** buttons
- **Preview Top 7**
- **Preview Phase 1**
- **Preview Phase 2**
- **Preview Phase 3**
- User, Merchant, Agent, and Admin linked app surfaces

---

## What will be fixed

### 1. Replace plain Preview confirmation with emulator preview popup
The current bulk preview confirmation is a standard dialog listing affected features, status, targets, and keys. It does not look like an app emulator.

I will change the Preview flow so clicking any preview button opens a dedicated emulator popup:

```text
Preview Phase 2 — Revenue and Ecosystem Growth
┌──────────────── Android emulator frame ────────────────┐
│ status bar                                               │
│ EasyPay User / Merchant / Agent / Admin app mock screen  │
│ real feature cards rendered in app-style layout          │
│ bottom Android navigation bar                            │
└─────────────────────────────────────────────────────────┘

Cancel | Enable Admin Preview
```

The plain confirmation dialog will remain only for:

- Launch
- Hide / Rollback

---

### 2. Show all selected features inside the emulator before enabling preview
Right now the persistent “Original App Preview” only shows features already set to `Admin Preview` or `Live`. That is correct for the dashboard section, but it makes Preview actions feel empty when features are still hidden.

I will add a separate preview-popup mode:

- Dashboard “Original App Preview”:
  - Shows only `disabled` and `visible`
  - Keeps hidden features excluded

- Preview popup:
  - Shows the clicked feature, Top 7 group, or phase group even if currently hidden
  - Labels them as “Preview candidate”
  - Lets the admin inspect how they will look before confirming

This keeps hidden features safe while making the Preview button useful.

---

### 3. Create a stronger Android emulator frame
Update the current `AppEmulator` component so it looks more like an Android app screen:

- Rounded phone/tablet/desktop device shell
- Top status bar with time, signal, Wi-Fi, battery indicators
- App header inside the frame
- Role-specific screen content
- Bottom Android navigation pill / navigation bar
- Dark glassmorphism styling matching EasyPay
- `rounded-[19px]`, `gradient-hero`, soft bokeh, glass cards, compact tiles

Device modes:

- **Mobile**: tall phone emulator
- **Tablet**: wider tablet emulator with denser layout
- **Desktop**: dashboard-style app preview frame

---

### 4. Render role-specific app layouts, not generic tiles only
The popup will map each selected feature to its linked app type and show it in the correct mock screen.

#### User app emulator
For user-linked features:

- Wallet balance-style hero
- Quick-action style feature tiles
- Scam Shield warning card
- AI Copilot insight card
- Trust Score / Loan Eligibility / Rewards cards
- Bengali assistant floating CTA when relevant

#### Merchant app emulator
For merchant-linked features:

- Merchant sales hero
- Growth OS analytics card
- Campaign / Smart Rewards card
- QR/API readiness card
- Store/order style mini metrics

#### Agent app emulator
For agent/distributor-linked features:

- Float balance hero
- Liquidity intelligence card
- Territory risk / restock suggestion
- Scam Shield risk check
- Voice assistant helper tile

#### Admin app emulator
For admin-linked features:

- Risk/compliance command screen
- Fraud investigator card
- Open Finance governance card
- Predictive support queue card

---

### 5. Handle multi-target features correctly
Some features target more than one app, for example:

- `future_scam_shield` → User + Agent
- `future_identity_wallet` → User + Merchant + Agent
- `future_smart_rewards_engine` → User + Merchant
- `future_dynamic_risk_limits` → User + Admin

I will add a target resolver so the emulator popup can show the feature in every relevant linked app screen, not just the first detected target.

Example:

```text
Preview: Real-Time Scam Shield

Tabs/sections:
- User App Emulator
- Agent App Emulator
```

For bulk preview, it will group selected features by app type and show all relevant emulator screens.

---

### 6. Keep Launch and Hide confirmations consistent
Launch and Hide will still use confirmation dialogs, but Preview will become emulator-first.

Flow will be:

#### Preview
```text
Click Preview
→ Android emulator popup opens
→ Admin reviews app-style screen
→ Click Enable Admin Preview
→ Confirmation/update sets visibility = disabled
```

#### Launch
```text
Click Launch
→ Confirmation dialog opens
→ Sets visibility = visible
```

#### Hide / Rollback
```text
Click Hide/Rollback
→ Confirmation dialog opens
→ Sets visibility = hidden
```

---

### 7. Update bulk preview behavior
For bulk actions:

- **Preview Top 7**
- **Preview Phase 1**
- **Preview Phase 2**
- **Preview Phase 3**

I will replace the current plain bulk confirmation popup with a bulk emulator preview popup.

The popup will show:

- Title and affected count
- Device switcher
- Emulator screens grouped by app role
- Feature chips/keys
- Current visibility summary
- Confirm button: **Enable Admin Preview**

Only after confirming will it bulk-update those features to `disabled`.

---

### 8. Preserve safety rules
No user/merchant/agent app routes will be changed.

Safety behavior remains:

- Hidden features do not render in real user/merchant/agent UI
- Hidden features do not appear in the persistent Original App Preview
- Hidden features may appear only inside admin-only emulator popups for review
- Admin Preview features remain admin-only unless future real app wiring uses `isLive(...)`
- Live app entry points must still be gated by `visibility === "visible"` / `isLive(...)`

---

## Main file to update

- `src/components/admin/AdminAdvanceForFuture.tsx`

No database schema changes are needed.

---

## Expected result
After the fix, clicking **Preview** will no longer show a plain dialog like the screenshot. It will open an Android-emulator-style popup showing exactly how the selected feature, phase, or Top 7 set would appear inside the linked EasyPay User, Merchant, Agent, or Admin app screen before enabling Admin Preview.
