## Plan: Redesign KYC UI — Combined NID Capture + Image Cropping

### Changes (single file: `src/components/KycFlow.tsx`)

### New Flow

`nid_capture` (front+back on one page) → `nid_details` → `additional_info`→ `selfie`  → `review` → `submitted`

### 1. Merge NID Front & Back into a single `nid_capture` step

- Remove separate `nid_front` and `nid_back` steps
- New step `nid_capture` shows both camera boxes stacked vertically on one page
- User captures front first, then back appears below
- Continue button enables only when both are captured
- OCR runs automatically after front capture (same as now)

### 2. Add image cropping after each capture

- After capturing NID front or back, show a crop overlay instead of just the preview
- Implement a simple crop UI: draggable crop rectangle over the captured image
- User adjusts crop area, then taps "Crop & Save" to finalize
- Uses canvas to crop the selected region from the full capture
- Crop state managed per-image (`croppingFront`, `croppingBack`)

### 3. Update step type, STEPS array, and navigation

- `Step` type: `"nid_capture" | "nid_details" | "selfie" | "additional_info" | "review" | "submitted"`
- `STEPS`: `["nid_capture", "nid_details","additional_info", "selfie",  "review"]`
- `goBack` updated: `nid_capture` → close, `nid_details` → `nid_capture`, etc.
- Progress bar recalculated for 5 steps instead of 6

### 4. Crop Component (`ImageCropper`)

- Displays captured image full-width
- Overlay with draggable/resizable crop box (touch-friendly handles at corners)
- "Crop & Confirm" gradient button below
- "Retake" secondary button
- On confirm: crops via canvas, returns cropped dataUrl

### 5. UI remains elegant

- Same glassmorphic cards, gradient buttons, animated transitions
- Crop UI uses semi-transparent dark overlay with white crop border + corner handles
- Smooth spring animations on crop box appearance

### **Change database as per new update**