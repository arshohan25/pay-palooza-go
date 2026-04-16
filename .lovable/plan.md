

# Premium Savings Goal Creation — Combined Flow Redesign

## Problem
The current "Create Goal" screen is basic (emoji grid + text input + number input). The auto-save/investment plan is a separate step. The flow feels disconnected and unprofessional.

## Solution
Merge goal creation and auto-save investment plan into a single, premium multi-step wizard with life-goal presets.

### Step 1: Goal Selection (replaces emoji picker + name input)
- Add **preset life-goal cards** in a scrollable grid: Dream Bike 🏍️, Dream House 🏠, Dream Car 🚗, Education 🎓, Wedding 💍, Vacation ✈️, Gadget 📱, Emergency Fund 🛡️, Business 💼, Hajj 🕋, Health 💊, Custom ✏️
- Each card: emoji icon, title, subtle gradient background
- Tapping a preset auto-fills emoji + name; tapping "Custom" reveals the text input
- Target amount input stays below the grid
- Section title: **"What are you saving for?"**

### Step 2: Investment Plan (currently separate "autosave" step, now integrated)
- After goal details, show an optional toggle: **"Auto-Save & Invest"**
- When enabled, the existing frequency / amount / duration / strategy / estimated profit section appears inline — no separate navigation step
- The "Link to Goal" dropdown is removed since it auto-links to the goal being created
- Review summary card appears at bottom before the CTA

### Step 3: Confirm & Create
- Single "Create Goal" button handles both goal creation and optional auto-save setup in one action
- If auto-save is enabled, the review/PIN/T&C flow triggers; otherwise, goal is created directly

### UI Enhancements
- Life-goal cards use glassmorphism with subtle gradient borders
- Staggered entrance animations via Framer Motion
- Section transitions use smooth slide/fade
- Premium card shadows matching existing `--shadow-card` system

### File Changes
- **`src/components/SavingsFlow.tsx`**:
  - Replace `EMOJI_LIST` with `LIFE_GOAL_PRESETS` array containing `{ emoji, name, gradient }` objects
  - Redesign `step === "create"` section with preset grid + optional auto-save toggle
  - When auto-save toggle is on, embed the frequency/amount/duration/strategy UI inline
  - Merge `handleCreateGoal` + `handleCreateAutoSave` into a single flow when both are configured
  - Keep the standalone "autosave" step accessible from the home screen for users who already have goals

