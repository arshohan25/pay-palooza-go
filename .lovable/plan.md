

## Fix: Add "Go Home" button on donation success screen

The success screen (step 4) only shows "Donate Again" and "Share" buttons. There's no way to navigate back home.

### Change
**File: `src/pages/DonationsPage.tsx`** (lines 452-459)

Add a "Go Home" button to the success screen button group:

```tsx
<div className="flex gap-3 justify-center flex-wrap">
  <button onClick={resetFlow} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold">
    Donate Again
  </button>
  <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-semibold flex items-center gap-1.5">
    Go Home
  </button>
  <button onClick={() => setShareOpen(true)} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-semibold flex items-center gap-1.5">
    <Share2 size={15} /> Share
  </button>
</div>
```

This adds a "Go Home" button between "Donate Again" and "Share" that navigates back to the home page. The back arrow in the header also works (calls `resetFlow` which goes back to cause selection), but users expect a prominent home button after completing a flow.

