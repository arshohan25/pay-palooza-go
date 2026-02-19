
# Mobile Recharge Flow — Professional Rebuild

## What's Being Built

A complete professional redesign of `MobileRechargeFlow.tsx` inspired by bKash, Nagad, and Robi Apps, with:

1. **Operator logos** — SVG-based coloured logos (GP green, Robi red-purple, Banglalink orange, Teletalk blue, Airtel red) rendered as styled badges with proper branding colours
2. **Restructured flow** — Phone Number → **See Offers & Packs** button (Continue) → Operator Packs page → Amount/PIN confirm → Success
3. **Two offer type tabs per operator** — `⚡ Drive` (special/exclusive offers) and `📦 Regular Packs` — each with sub-categories (Internet, Minutes, Bundles, Call Rates)
4. **Sticky Continue button** — Prominent, rounded, gradient button at bottom of the pack selection screen

---

## Flow Architecture

```text
Step 1: "number"
  └─ Phone input
  └─ Live operator detection badge
  └─ [See Offers & Packs] button  ← main CTA (replaces current pattern)
  └─ Operator list cards (tap to browse directly)

Step 2: "packs"
  └─ Operator header with real logo/brand colours
  └─ Two top-level tabs: [⚡ Drive] [📦 Regular]
  └─ Sub-category pill bar: Internet | Minutes | Bundles | Call Rates
     (Drive tab shows special curated deals, no sub-categories needed)
  └─ Pack cards with price, details, validity, badge
  └─ Custom amount card below packs
  └─ Sticky bottom: selected pack summary + [Continue ৳XXX] button

Step 3: "pin"
  └─ Summary card
  └─ PIN circles + native numeric keyboard input
  └─ Slide-to-confirm

Step 4: "success"
  └─ Receipt + Done + Share
```

---

## Operator Logos (SVG-based styled components)

Each operator gets a proper branded logo badge instead of 2-letter abbreviation:

| Operator | Brand Colour | Logo Symbol |
|---|---|---|
| Grameenphone | `#00A651` (green) | "GP" in bold + green gradient |
| Robi | `#E40046` (red) | "Robi" wordmark red |
| Banglalink | `#F47920` (orange) | "BL" orange diagonal |
| Teletalk | `#004B98` (blue) | "TT" state blue |
| Airtel | `#E40073` (hot pink) | wave "at" style |

These are rendered as React inline SVG/styled div components `<OperatorLogo operator={op} />` with a size prop.

---

## Pack Structure — Two Types

### ⚡ Drive (Special Offers)
- Curated deals, exclusive bundles, limited-time promos
- Shown as large "feature cards" with gradient accent border
- No sub-categories, shown in a vertical scroll list

### 📦 Regular Packs
- Sub-categories via horizontal pill bar: **Internet · Minutes · Bundles · Call Rates**
- Standard card grid

Each operator has both types. The data will be restructured accordingly:

```typescript
type OfferType = "drive" | "regular";
type SubCategory = "internet" | "minutes" | "bundles" | "callrates";

interface Pack {
  id: string;
  name: string;
  details: string;
  validity: string;
  price: number;
  badge?: string;
  highlight?: boolean;
  tag?: string; // "Limited" | "New" | "Hot"
  type: OfferType;
  subCategory?: SubCategory; // only for regular packs
}
```

---

## Key Technical Changes in `MobileRechargeFlow.tsx`

### 1. New `OperatorLogo` component
```tsx
const OperatorLogo = ({ op, size = "md" }: { op: Operator; size?: "sm"|"md"|"lg" }) => {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-12 h-12 text-sm", lg: "w-16 h-16 text-lg" };
  return (
    <div className={`${sizes[size]} rounded-2xl flex items-center justify-center font-black text-white shadow-md`}
      style={{ background: op.brandColor }}>
      {op.logoText}
    </div>
  );
};
```

### 2. Operator data extended with `brandColor` and `logoText`
```typescript
const OPERATORS = [
  { name: "Grameenphone", short: "GP", logoText: "GP", brandColor: "#00A651", prefixes: ["017","013"] },
  { name: "Robi", short: "RB", logoText: "Robi", brandColor: "#E40046", prefixes: ["018"] },
  { name: "Banglalink", short: "BL", logoText: "BL", brandColor: "#F47920", prefixes: ["019","014"] },
  { name: "Teletalk", short: "TT", logoText: "TT", brandColor: "#004B98", prefixes: ["015"] },
  { name: "Airtel", short: "AT", logoText: "AT", brandColor: "#E40073", prefixes: ["016"] },
];
```

### 3. Step 2 — Two-tab system
```tsx
// Top tab toggle
<div className="flex bg-muted rounded-2xl p-1 gap-1">
  <TabButton id="drive" icon={<Zap />} label="Drive" active={offerType==="drive"} />
  <TabButton id="regular" icon={<Package />} label="Regular" active={offerType==="regular"} />
</div>

// Drive: shows curated "feature cards" with larger layout
// Regular: shows sub-category pill bar + standard pack cards
```

### 4. Step 2 — Sticky Continue button (bottom)
```tsx
<div className="absolute bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t px-4 py-4">
  <motion.button
    className="w-full h-14 rounded-2xl text-white font-bold text-base"
    style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ...)` }}
    onClick={handlePackContinue}
  >
    {selectedPack ? `Continue · ৳${selectedPack.price}` : "Select a Pack"}
  </motion.button>
</div>
```

### 5. Step 3 — PIN screen
- Summary card at top
- 4 dot PIN circles animated
- Native `inputMode="numeric"` input (system keyboard)
- SlideToConfirm below

---

## Files Changed

- **`src/components/MobileRechargeFlow.tsx`** — Full rebuild (single file, no new files needed)

---

## Data Plan for Packs

All 5 operators will get:
- **Drive packs**: 3–4 special/exclusive offers (highlight cards)
- **Regular > Internet**: 4–5 data packs
- **Regular > Minutes**: 3–4 voice packs  
- **Regular > Bundles**: 3–4 combo packs
- **Regular > Call Rates**: 2–3 rate options

This gives 15–20 packs per operator, 75–100 total packs across all operators.
