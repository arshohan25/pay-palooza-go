

## Plan: Update More Sheet — Change Icon, Remove Items, Card Grid Layout

### Changes

**`src/components/MoreSheet.tsx`**

1. **Change Savings icon**: Replace `PiggyBank` with `Wallet` (or `BadgeDollarSign` / `CircleDollarSign` — a more fitting savings icon)
2. **Remove items**: Delete "Limits & Usage" and "Spending Insights" entries from the `items` array
3. **Remove unused props**: Drop `onLimits` and `onInsights` from the interface
4. **Switch to card grid layout**: Change from vertical list (`space-y-2`) to a 2-column grid (`grid grid-cols-2 gap-3`). Each card will be a vertical card with the icon on top, label below, and description underneath — giving it a more spacious, premium feel
5. Remaining items: Bank Transfer, Savings, Coupons & Offers, Donations (4 items = clean 2x2 grid)

**`src/pages/Index.tsx`**
- Remove `onLimits` and `onInsights` props from `<MoreSheet />` usage

### Layout sketch
```text
┌──────────────┐ ┌──────────────┐
│   🏦 icon    │ │   💰 icon    │
│ Bank Transfer│ │   Savings    │
│  desc text   │ │  desc text   │
└──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐
│   🎫 icon    │ │   ❤️ icon    │
│Coupons&Offers│ │  Donations   │
│  desc text   │ │  desc text   │
└──────────────┘ └──────────────┘
```

