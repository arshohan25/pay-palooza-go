

## Fix: KYC Intro Icon Area Styling

### Problem
The icon area in the gradient header doesn't match the bKash reference. Currently it's a translucent white box with a `ShieldCheck` icon. The reference shows a more prominent, slightly opaque rounded square with better contrast against the pink gradient.

### Changes (single file: `src/components/KycFlow.tsx`)

**Lines 837-849** — Update the icon container and badge styling:

1. Change the icon container background from `bg-white/15` to a softer, more visible style — use `bg-white/20` with larger size and softer border
2. Replace `ShieldCheck` with `CheckCircle` (or keep `ShieldCheck` but make it bolder) to better match the reference's checkmark-in-a-box look
3. Make the small badge use the pink gradient background instead of plain white, with a white icon inside — matching the reference's pink badge with a verification symbol

Specifically:
- Icon box: `w-24 h-24` → `w-20 h-20`, increase opacity to `bg-white/25`, keep rounded corners
- Badge: Change from white bg + pink icon to `bg-white` with the sparkle/shield icon in pink — this already matches, but increase size slightly to `w-9 h-9` for better visibility
- Ensure the badge overlaps the corner properly with adjusted positioning

