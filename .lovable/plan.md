

# Move Dot Indicators Inside Image Carousel

## Change

**File: `src/pages/ProductDetailPage.tsx`** (lines 296-304)

Move the dot indicators from below the image (outside the image container) to inside the image container, positioned at the bottom center — overlaying the image like in the reference screenshot.

Current: dots are in a separate `div` with `py-2.5` below the image `div`
Target: dots sit inside the `aspect-[4/4]` container, absolutely positioned at the bottom center with a subtle backdrop blur

```text
Before:
┌──────────────────┐
│     Image         │  ← aspect-[4/4] relative container
│              1/2  │
└──────────────────┘
      ●  ○            ← dots outside, below image

After:
┌──────────────────┐
│     Image         │
│      ●  ○    1/2  │  ← dots inside, absolute bottom-center
└──────────────────┘
```

### Implementation
- Move the dot `div` (lines 297-304) inside the `aspect-[4/4]` container (before line 294, the closing `</div>`)
- Change styling to `absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5` with a subtle `bg-foreground/20 backdrop-blur-sm rounded-full px-2 py-1` pill behind the dots
- Remove the outer `py-2.5` padding since dots no longer need vertical spacing

### Summary
- 1 file, ~10 lines moved and restyled
- No backend changes

