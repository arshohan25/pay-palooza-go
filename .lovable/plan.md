
Goal: make the order slider draggable again on mobile checkout.

What I found
- The checkout page uses `SlideToConfirm` inside a fixed bottom bar in `src/pages/ShopCheckoutPage.tsx`.
- That bottom bar currently sets `touchAction: "none"` on the entire container.
- The reusable `SlideToConfirm` component itself does not set any mobile touch-action behavior on its draggable surface/thumb.
- Other working flows use the same slider inline inside normal content, so the regression is most likely caused by the checkout-specific fixed bar + touch handling, not the order logic itself.
- Your clarification says the thumb “doesn't move”, so this is a gesture-capture issue before submit logic runs.

Implementation plan
1. Fix touch handling at the slider component level
- Update `src/components/SlideToConfirm.tsx` so the draggable track/thumb explicitly supports horizontal dragging on mobile.
- Add mobile-safe gesture styles to the actual interactive elements instead of relying on a parent wrapper.
- Keep the component reusable so the same fix benefits checkout and other flows.

2. Remove the checkout-specific touch blocker
- Update `src/pages/ShopCheckoutPage.tsx` to stop applying `touchAction: "none"` on the full fixed bottom bar.
- Keep the sticky/fixed positioning, safe-area padding, and visibility fix.

3. Add a tap fallback for checkout reliability
- Extend `SlideToConfirm` with an optional fallback interaction for touch devices:
  - either click-to-confirm when fully disabled conditions are cleared, or
  - a small “continue” fallback button shown only if drag cannot initialize.
- I’ll keep the default UX as slide-first, but make checkout resilient if some Android browsers block Framer Motion drag.

4. Preserve reset behavior
- Keep the existing reset behavior when PIN is wrong / processing changes.
- Ensure the slider still snaps back cleanly on failed PIN or failed order placement.

5. Verify impact scope in code
- Check all current `SlideToConfirm` usages and keep them compatible.
- Avoid changing payment/order backend logic unless needed; this looks UI-gesture specific.

Files to update
- `src/components/SlideToConfirm.tsx`
- `src/pages/ShopCheckoutPage.tsx`

Technical details
- Likely root cause: `touch-action` is applied to the whole fixed checkout bar instead of the draggable element, which can prevent pointer/drag behavior on some mobile browsers.
- Planned slider-level changes:
  - apply `touch-action: pan-y` or `none` on the draggable surface/thumb
  - add `WebkitUserSelect: "none"` / `userSelect: "none"`
  - keep `drag="x"` and constraints, but make pointer capture more explicit
- Planned checkout changes:
  - remove container-wide `touchAction: "none"`
  - keep fixed bottom layout and safe-area spacing
- Optional resilience:
  - add a non-drag fallback only when necessary so placing an order is never blocked by browser gesture quirks

Expected result
- After entering the 4-digit PIN, the order slider should visibly move with touch on mobile and allow the order to be placed normally.
- Checkout should keep the sticky bottom CTA without breaking drag behavior.
