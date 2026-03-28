

# Redesign Stock + Quantity into One Row

## Current State
- **Quantity** section (line 405-417): shows "Quantity" label on left, +/- selector beside it
- **Stock info** is buried inside Key Highlights card as a badge (line 430-432)
- These are separate sections

## Goal
Combine stock status and quantity selector into a single, clean row:
- **Left side**: Stock indicator (e.g., green dot + "In Stock · 25 available")
- **Right side**: Quantity selector (+/- buttons)

## Changes

### File: `src/pages/ProductDetailPage.tsx`

**Replace the Quantity section (lines 405-417)** with a combined row:

```
┌─────────────────────────────────────────────────┐
│  🟢 In Stock · 25 available      [ - ] 1 [ + ] │
└─────────────────────────────────────────────────┘
```

- Left: green/red dot icon + "In Stock" or "Out of Stock" text + count
- Right: existing rounded pill quantity selector, pushed to the right with `ml-auto`
- Wrapped in a subtle `bg-muted/20 rounded-xl px-4 py-3` container for polish

**Remove stock badge from Key Highlights** (line 430-432): delete the stock Badge from the highlights card since it's now shown in the quantity row.

### Single file edit, no backend changes.

