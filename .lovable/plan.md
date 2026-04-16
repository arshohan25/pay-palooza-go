

# Tree-Style Centered Timeline with Random Left/Right Flip

## What Changes
Replace both Goal and DPS detail timelines with a **centered vertical tree** — the trunk line runs down the exact middle of the page. Each node alternates randomly between showing the **date on the right & amount on the left**, or flipped. A seeded pseudo-random pattern based on index ensures consistent rendering.

## Design

```text
   ৳500          │          Jan 5
   ┌──────┐      ●      
   │Manual│──────┤      
   └──────┘      │      
                 │      Feb 12
                 ●──────┌──────┐
                 │      │৳1000 │
                 │      │ Auto │
                 │      └──────┘
   ৳500          │      
   ┌──────┐      ●      Mar 1
   │Repay │──────┤      
   └──────┘      │      
```

Each row: two `w-[45%]` columns flanking a center trunk. Cards appear on one side, date label on the other. Side is determined by a simple hash of the index to feel random but stable.

## Changes (single file: `src/components/SavingsFlow.tsx`)

### 1. Goal Detail Timeline (lines ~1660-1696)
Replace the left-aligned `pl-6` layout with:
- Container: `relative` with centered gradient trunk line (`left-1/2 -translate-x-1/2`, 2px wide, gradient from primary)
- Each item: `flex items-center` row with `justify-center`
- Left half (`w-[45%]`): amount card OR date text (based on side)
- Center: 14px circle node on the trunk with status-colored border and glow
- Right half (`w-[45%]`): the opposite content
- Horizontal branch line (8px) connecting node to card
- Side logic: `(index * 7 + 3) % 2` for pseudo-random but deterministic alternation
- Framer Motion: cards slide in from their side with stagger

### 2. DPS Detail Timeline (lines ~1822-1867)
Same centered tree pattern with status-colored nodes:
- Emerald node + card border for paid
- Amber for repaid  
- Red for missed
- Status badge inside card, date on opposite side

### 3. Visual Details
- Trunk: `w-[2px] bg-gradient-to-b from-primary/50 via-primary/20 to-transparent`
- Nodes: 14px circles with colored borders and subtle `shadow-[0_0_6px]` glow
- Branch: 8px horizontal line from node to card, matching node color
- Cards: glassmorphism, `rounded-[14px]`, `backdrop-blur-sm`
- Date labels: `text-[10px] font-bold text-muted-foreground` on the empty side

