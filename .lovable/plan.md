## Goal

The chat panel currently sits flush against the screen edges on mobile (390px). The screenshot's red arrows point to the lack of side breathing room. Add visible horizontal padding around the white chat drawer so the dark gradient shows on both sides as a frame.

## Changes — `src/pages/MerchantSupportPage.tsx`

1. **Outer wrapper**: Add horizontal padding to the root `fixed inset-0` container so both the header and the body share the same inset:
   - `paddingLeft: max(env(safe-area-inset-left), 12px)`
   - `paddingRight: max(env(safe-area-inset-right), 12px)`
   - On `sm:` breakpoint and up, bump to `20px` so it scales nicely on tablets.

2. **Header**: Remove its own `paddingLeft` / `paddingRight` inline styles (now handled by parent). Keep `paddingTop` for safe-area-top.

3. **Body (white drawer)**: Already uses `rounded-t-3xl`. With the new outer padding, the white panel will now visibly float with dark gradient gutters on both sides — exactly matching the user's request.

4. **No changes** to `PinResetTicketChat.tsx` — its internal safe-area padding still works correctly inside the now-inset white panel.

## Visual result

```text
Before (390px):                    After (390px):
┌──────────────────────┐           ┌──────────────────────┐
│ ← PIN reset · Live   │           │░← PIN reset · Live ░│
├──────────────────────┤           │░├────────────────┤░│
│ EasyPay Support  ✓   │           │░│ EasyPay Support│░│
│ Hi there 👋 ...      │           │░│ Hi there 👋... │░│
│                      │           │░│                │░│
└──────────────────────┘           │░└────────────────┘░│
edge-to-edge                       └──────────────────────┘
                                   12px gradient gutters
```
