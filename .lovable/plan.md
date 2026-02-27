

## Fix: "শুরু করুন" Button Hidden Behind Bottom Nav

### Problem
The KYC intro screen and the BottomNav both use `z-50 fixed`. The sticky "Start" button sits at `bottom-0`, directly behind the BottomNav, making it unclickable.

### Fix (single file: `src/components/KycFlow.tsx`)

**Line 973** — Add `pb-20` (bottom padding ~80px) to the sticky button container so it clears the BottomNav:

```
- <div className="sticky bottom-0 p-5 pt-3 bg-gradient-to-t from-background via-background to-transparent">
+ <div className="sticky bottom-0 p-5 pt-3 pb-20 bg-gradient-to-t from-background via-background to-transparent">
```

This adds enough bottom padding so the button sits above the BottomNav overlay. Same fix should be applied to the Terms page "Proceed" button if it has the same issue.

