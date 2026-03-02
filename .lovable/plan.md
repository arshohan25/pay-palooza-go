

## Plan: Redesign AsthaPay in Add Money Flow to Match AsthaPay Brand Identity

### Context
AsthaPay's official branding uses a **blue** color scheme (#4285F4 / #3B6FE0), not the current purple (#6C3FC5). The flow is functionally correct but needs visual alignment with AsthaPay's actual brand.

### Changes

#### 1. Update AsthaPay branding in `src/components/AddMoneyFlow.tsx`
- Change `color` from `#6C3FC5` to `#3B6FE0` (AsthaPay blue)
- Change `gradient` from `bg-[#6C3FC5]` to `bg-[#3B6FE0]`
- Update `short` from `"AP"` to include a styled "A" or keep "AP" with the correct blue

#### 2. Add AsthaPay logo to `public/operators/asthapay.png`
- Use AsthaPay's official logo styling (blue "AP" mark) as a provider icon
- Display the logo image in the MFS provider grid instead of the text-only badge

#### 3. Update MFS provider rendering to support logo images
- For providers that have a logo image (like asthapay), render an `<img>` tag instead of the text shortcode badge
- This matches how operators like GP, Robi, etc. already have images in `public/operators/`

### Files
- **Edit**: `src/components/AddMoneyFlow.tsx` — update AsthaPay color + add logo support in MFS grid
- **New**: `public/operators/asthapay.png` — AsthaPay logo (will need user to provide, or generate a placeholder)

