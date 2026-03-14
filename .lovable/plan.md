

## Redesign Bank List & Fix Slider/PIN Order

### Two Issues to Fix

**1. Bank list redesign** — Replace the hardcoded 8-bank grid in `BankTransferFlow.tsx` (and 10-bank list in `AgentBankTransfer.tsx`) with a comprehensive dropdown/select of all major Bangladeshi banks, each with a logo image.

**2. Fix slider before PIN** — Currently the flow is: Confirm (SlideToConfirm) → PIN → Success. The correct order should be: PIN → SlideToConfirm → Submit. PIN verification must happen before the final slide-to-confirm action.

### Changes

**New file: `src/lib/bangladeshBanks.ts`**
- Export a comprehensive list of ~60 Bangladeshi banks with `id`, `name`, `short`, and `logo` (URL path under `/banks/`)
- Banks include: Sonali, Janata, Agrani, Rupali, BASIC, BDBL, DBBL, BRAC, City, EBL, UCB, Islami Bank, Al-Arafah, Shahjalal, First Security, EXIM, Social Islami, Union, Mercantile, Premier, Standard, Pubali, Uttara, NCC, One Bank, IFIC, Mutual Trust, Trust, Midland, Dhaka, AB, NRB, South Bangla, Meghna, Padma, Bengal Commercial, Global Islami, Community, Probashi, Shimanto, Citizens, Standard Chartered, HSBC, Citibank, Commercial Bank of Ceylon, Woori, Bank Al-Falah, State Bank of India, Habib, National Bank of Pakistan

**New folder: `public/banks/`**
- Since we cannot source actual logo files, generate colored circle SVG placeholders with bank short codes. Instead, use a helper component that renders a styled avatar with the bank's short code and a color derived from the bank name — no external images needed.

**File: `src/components/BankTransferFlow.tsx`**
- Remove inline `BANKS` array, import from `bangladeshBanks.ts`
- Replace the 2-column grid bank selector with a searchable dropdown (Popover + Command from shadcn) showing bank name + logo avatar
- **Reorder steps**: Change `STEPS` from `["bank", "amount", "confirm", "pin"]` to `["bank", "amount", "pin", "confirm"]`
- Move `SlideToConfirm` to after PIN: the confirm step now has PIN entry, and a new final step has the slider
- Update `handleSlideConfirm` to execute the actual submission (currently in `handlePinSubmit`)
- Update `handlePinSubmit` to just verify the PIN and advance to the confirm/slide step
- Update `goBack` navigation accordingly

**File: `src/pages/AgentBankTransfer.tsx`**
- Import bank list from `bangladeshBanks.ts`
- Replace the hardcoded `BANKS` array in the Add Bank sheet with a searchable dropdown using the same pattern
- Fix the confirm step: PIN input should come before SlideToConfirm (currently slider triggers `handleConfirm` directly with PIN already entered in same view — reorder so PIN is validated first, then slider submits)

