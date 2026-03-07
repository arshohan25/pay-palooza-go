

## Plan: Refine Recipient Input Step

### Changes — `src/components/SendMoneyFlow.tsx`

**1. Move QR scan icon to right side of the search input field**
Replace the standalone `<Search>` icon on the left with the QR icon on the right side of the input. Keep the search icon on the left. The QR icon inside the input should match the primary color scheme (use `text-primary`).

**2. Add tagline below header**
Re-add the subtitle/tagline text below the "Send Money" title in the header area — something like "Send money to any EasyPay or mobile number" in smaller text.

**3. Update placeholder text**
Change the input placeholder from `"Enter name or number"` to `"Name or Number or Wallet ID"`.

**4. Input validation — max 11 characters for numbers/wallet IDs**
Update `handleInputChange`:
- If the input starts with digits (phone number), auto-strip non-digits and cap at 11 characters.
- If the input matches the wallet ID pattern prefix (contains `-`), allow the format `MFS-XXXX-XXXX` (max 13 chars with hyphens, auto-insert hyphens).
- If the input is purely alphabetic (name search), allow unlimited length.

**5. Add a "Continue" button**
Add a visible Continue button at the bottom of the recipient step that is **disabled** until:
- A phone number with exactly 11 digits is entered, OR
- A valid wallet ID (`MFS-XXXX-XXXX`) is entered, OR
- A contact is selected from the list.

This replaces the auto-advance on `handleManualSend` — tapping Continue triggers the same logic.

### Files Modified
- `src/components/SendMoneyFlow.tsx`

