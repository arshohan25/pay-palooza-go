

## Hide "Browse by Operator" After Pack Selection

The screenshot shows that after selecting a drive pack, the number entry step still displays the "Browse by Operator" operator cards below the CTA button. This is unnecessary clutter since the user has already chosen their operator and pack.

### Change

**File: `src/components/MobileRechargeFlow.tsx`** (lines ~625-654)

Wrap the "Operator cards" section in a conditional that only renders when **no pack is selected** (`!selectedPack`). When a drive pack is already selected, the user only needs the phone input and the "Continue with [Pack Name]" button.

```tsx
{/* Operator cards — hide when a pack is already selected */}
{!selectedPack && (
  <div className="space-y-2.5">
    <p className="text-xs font-bold ...">Browse by operator</p>
    ...
  </div>
)}
```

Single condition change, no other files affected.

