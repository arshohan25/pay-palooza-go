

## Plan: Center-align phone number input

The phone number input section currently has a left-aligned label and left-aligned text. The fix is simple:

**File: `src/pages/CheckoutPage.tsx` (lines 521-532)**

1. Center the "Phone Number" label: add `text-center` instead of default left alignment
2. Center the phone input text: add `text-center` to the input className
3. Center the placeholder text

This is a small styling tweak — no logic changes needed.

