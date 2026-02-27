

## Plan: Redesign KYC Flow with Additional Information Step

### Current Flow
`nid_front` → `nid_back` → `nid_details` → `selfie` → `review` → `submitted`

### New Flow
`nid_front` → `nid_back` → `nid_details` → `selfie` → **`additional_info`** → `review` → `submitted`

### Changes (single file: `src/components/KycFlow.tsx`)

**1. Add new step type and state**
- Add `"additional_info"` to the `Step` type and `STEPS` array
- Add state for: `occupation`, `gender`, `monthlyIncome`, `address`, `maritalStatus`

**2. Create a styled dropdown component (`SelectField`)**
- Glassmorphic card-style select with gradient accent icons
- Options for each field:
  - **Gender**: Male, Female, Other
  - **Occupation**: Student, Business, Government Job, Private Job, Freelancer, Homemaker, Retired, Other
  - **Monthly Income**: Below ৳10,000 / ৳10,001–৳25,000 / ৳25,001–৳50,000 / ৳50,001–৳1,00,000 / Above ৳1,00,000
  - **Marital Status**: Single, Married, Divorced, Widowed

**3. Build the `additional_info` step UI**
- Animated gradient header icon (Sparkles/UserCog)
- Section title: "Additional Information"
- Glassmorphic card containing all dropdown fields with icons
- Each field uses the `SelectField` component with animated entrance
- Continue button with gradient styling

**4. Update navigation logic**
- `selfie` → advances to `additional_info` instead of `review`
- `additional_info` → advances to `review`
- Back navigation updated accordingly

**5. Include additional data in submission**
- Add `occupation`, `gender`, `monthly_income`, `marital_status`, `address` to the `ocr_raw_data` JSON object saved to `kyc_verifications`

**6. Show additional info in the review step**
- New card section displaying the extra fields before the submit button

### Database
No schema changes needed — additional fields stored in the existing `ocr_raw_data` JSONB column.

