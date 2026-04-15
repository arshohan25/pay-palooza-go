

# Add Hyphen Range in Marketing Text & Separate Review+PIN Page

## Problem
1. Marketing text shows a single percentage like "2.5%" — user wants it to display as a range "2-5%"
2. PIN entry and Slide to Confirm are on the same crowded page as all settings — user wants a separate review & confirm page

## Changes (1 file: `src/components/SavingsFlow.tsx`)

### 1. Fix marketing text percentage to show "2-5%" range
- Change line 829 from dynamic `{getEstReturn(...)}%` to a fixed range string `2-5%`
- This applies to the emerald motivational banner in the Early Cancellation Policy section

### 2. Add a new "review" step before PIN confirmation
- Add `"review"` to `SavingsStep` type: `"home" | "add" | "create" | "autosave" | "review" | "terms" | "detail"`
- On the autosave page, replace the PIN + Slide to Confirm section with a **"Continue"** button that navigates to `step = "review"`
- Create a new `step === "review"` page that shows:
  - **Summary card**: frequency, amount, duration, strategy, linked goal, estimated profit
  - **Early cancellation policy** (moved from autosave page)
  - **Marketing motivational text** with "2-5%" range
  - **T&C acceptance checkbox**
  - **PIN entry** (`SavingsPinInput`)
  - **Slide to Confirm** button
  - **Back button** to return to autosave step

### 3. Clean up autosave page
- Remove the early cancellation warning, T&C section, PIN input, and Slide to Confirm from the autosave page
- Add a prominent "Continue to Review" button at the bottom instead

