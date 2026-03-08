

## Plan: Add Illustrated BankTransferIcon

### Problem
The Bank Transfer button in the main quick actions grid uses a plain `Landmark` lucide icon, which looks inconsistent with the other custom illustrated SVG icons (paper plane, ATM, QR scanner, etc.).

### Solution
Create a new `BankTransferIcon` in `QuickActionIcons.tsx` that matches the illustrated style — a bank/building with columns, a Taka (৳) symbol, and an arrow animation on hover. Then use it in `QuickActions.tsx` instead of the inline `Landmark` icon.

### Changes

**1. `src/components/QuickActionIcons.tsx`** — Add new `BankTransferIcon` component
- Classical bank building shape with columns and triangular roof
- Blue gradient (`#1565C0` → `#0D47A1`) matching the blue theme already used for Bank Transfer
- Taka (৳) symbol on the building
- Arrow animation on hover (arrow moving right, indicating transfer)
- Uses same `motion` + `isHovered` pattern as all other icons

**2. `src/components/QuickActions.tsx`** — Replace inline Landmark with BankTransferIcon
- Import `BankTransferIcon` from `QuickActionIcons`
- Replace line 32's inline `({ isHovered }) => <Landmark .../>` with `BankTransferIcon`

