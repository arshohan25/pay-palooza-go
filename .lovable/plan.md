

## Plan: Add KYC Welcome/Intro Screen

### What
Add a new `intro` step as the **first screen** when entering KYC. This screen shows users a visual overview of the entire KYC process before they begin, inspired by the bKash reference screenshots.

### Changes (single file: `src/components/KycFlow.tsx`)

**1. Add `intro` step**
- Update `Step` type: add `"intro"` as the first option
- Update `STEPS` array: `["intro", "nid_capture", "nid_details", "additional_info", "selfie", "review"]`
- Set initial step to `"intro"` instead of `"nid_capture"`
- Update `goBack`: `intro` → `onClose()`; `nid_capture` → `intro`

**2. Build the intro screen UI**
- Gradient header with KYC title (matching bKash style — pink/magenta theme)
- Large centered icon (ShieldCheck or similar inside a phone-shaped illustration)
- Heading in Bengali: "অনুগ্রহ করে আপনার তথ্য হালনাগাদ করুন" (Please update your information)
- Subtitle explaining the purpose
- "৩টি সহজ ধাপে আপনার তথ্য সাবমিট করুন" (Submit your info in 3 easy steps) section
- Three visual step indicators with icons:
  1. 📋 আপনার NID এর ছবি তুলুন (Capture your NID photo)
  2. 📝 প্রয়োজনীয় তথ্য প্রদান করুন (Provide required info)
  3. 🤳 নিজের চেহারার ছবি তুলুন (Take a selfie)
- Large step number watermark in background (decorative)
- Bottom sticky "শুরু করুন →" (Start) gradient button

**3. Progress bar**
- Intro step shows as step 0 (or excluded from progress calculation so progress starts at nid_capture)
- Header hidden on intro step (full-page layout like the reference)

**4. Styling**
- Pink/magenta gradient card for the step indicators section
- Glassmorphic card with rounded corners for the explanation text
- Icons with gradient backgrounds matching each step's theme
- Vertical timeline/connector between the 3 step indicators
- Smooth entrance animations with framer-motion

### No database changes needed.

