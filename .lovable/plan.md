

# Restructure Savings Tabs — Add "Goals" Tab Between Savings & Gold

## Problem
The auto-save settings (CalendarClock) and create goal (+) buttons are crammed in the header. The user wants a cleaner layout where Goals are a dedicated tab, and Savings focuses on auto-DPS by default.

## Plan

### 1. Add "Goals" tab to the tab bar

Change the 3-tab layout (Savings | Gold | Stocks) to 4 tabs:

```text
[ Savings ]  [ Goals ]  [ Gold ]  [ Stocks ]
```

- **Savings tab** — Shows total saved, active auto-save plans, and quick "Create Auto-Save" CTA. This is the DPS/auto system.
- **Goals tab** — Shows the life-goal presets grid, existing goals list, and "Create Goal" button. Contains the current `step === "create"` and `step === "add"` flows.

### 2. Remove header buttons

Delete the CalendarClock and + buttons from the header (lines 582–589). The header becomes clean — just back arrow, title, and subtitle.

### 3. Restructure `MainTab` type

```typescript
type MainTab = "savings" | "goals" | "gold" | "stocks";
```

### 4. Goals tab home screen (new section)

When `mainTab === "goals" && step === "home"`:
- Show the life-goal presets grid as quick-create cards (tap to start creating)
- Below, show existing goals list with progress bars (currently in Savings home)
- "Create Custom Goal" button at bottom

When user taps a preset or custom, transition to `step === "create"` (existing flow).

### 5. Savings tab home (simplified)

Remove the goals list from Savings home. Keep:
- Total Saved summary card
- Active auto-save plans banner (with manage button)
- Gold & Stocks overview cards
- "Start Auto-Save" CTA if no active plans

### 6. Header dynamic updates

- Goals tab header: gradient matches emerald/teal, title "My Goals", subtitle shows goal count
- Tab icon: use `Target` icon for Goals tab

### 7. Premium aesthetic for Goals tab

- Life-goal preset cards with glassmorphism and staggered Framer Motion entrance
- Goals list cards with gradient progress bars and completion percentage
- Empty state with premium illustration text

### File Changes
- **`src/components/SavingsFlow.tsx`** — All changes in this single file:
  - Add `"goals"` to `MainTab` union
  - Remove header action buttons (CalendarClock, Plus)
  - Add Goals tab button between Savings and Gold in tab bar
  - Move goals list rendering from Savings home to Goals tab home
  - Add life-goal preset quick-create grid to Goals tab
  - Update `handleBack` for goals tab navigation
  - Update `headerGradient`, `headerTitle`, `headerSub` for goals tab

