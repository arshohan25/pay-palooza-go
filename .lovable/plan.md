

# Fix Banners & Toggles Mobile Responsiveness

## Problem
On 390px mobile viewport, toggle items and banner cards have content cut off on the right edge. The switch controls and action buttons overflow or get clipped.

## Root Cause
- The parent admin dashboard content area likely has padding that, combined with the card's internal padding, pushes content beyond viewport
- Toggle items use `px-3` padding + `gap-2` spacing that doesn't leave enough room for the Switch (44px wide) on narrow screens
- Banner cards have similar issues with the Switch + action buttons row

## Plan

### 1. AdminGlobalToggles.tsx
- Reduce horizontal padding on toggle items from `px-3` to `px-2` on mobile
- Make the toggle icon smaller or remove it on mobile to save space
- Reduce Switch size using `scale-[0.8]` on mobile
- Shrink action buttons row
- Ensure the outer container has `overflow-hidden` and `max-w-full`
- Add `w-full max-w-full overflow-hidden` to the root div

### 2. AdminBannerManager.tsx  
- Apply same overflow containment fixes
- Reduce card internal padding
- Ensure Switch + action buttons don't overflow

### Key CSS changes
- Root: `w-full max-w-full overflow-hidden` on the outer `space-y-6` div
- Toggle items: reduce to `px-2 py-2.5`, smaller icon `w-3.5 h-3.5`, tighter gap
- Switch: add `scale-[0.85]` to save ~7px
- Banner cards: reduce padding, scale down Switch

