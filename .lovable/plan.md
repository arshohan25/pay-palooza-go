## Redesign Product Detail Page — Premium & Elegant

Inspired by the Daraz-style reference screenshot, the redesign will elevate the page with better visual hierarchy, richer information density, and a polished e-commerce feel.

### Key Design Changes

**1. Image Gallery — Full-bleed with dot indicators**

- Replace thumbnail strip with swipeable image carousel using dot pagination (like the reference)
- Larger image area with smooth fade transitions via framer-motion AnimatePresence
- Badge overlay repositioned to bottom-left with a frosted glass style
- Image counter pill (e.g., "1/4") in bottom-right corner

**2. Price & Discount Section — Bolder treatment**

- Larger price (text-3xl), original price with strikethrough, and a vibrant discount percentage badge
- Add a "savings" line: "You save ৳X" in green text
- Low stock urgency bar with animated progress indicator

**3. Vendor Row — Enhanced with "Visit Store" button**

- Store icon + name on left, small outlined "Visit Store" button on right (matches reference)
- Subtle divider card style

**4. Delivery & Trust Section — Card-based layout**

- Replace the 3-column icon grid with a stacked list of delivery promises inside a bordered card:
  - "Free Delivery" with date estimate (controlled from admin panel)
  - "Cash on Delivery Available"
  - "Easy Return"
  - "100% Authentic" with shield icon
- Each row has icon + text + optional sub-detail

**5. Variant Selector — Pill chips with selected state glow**

- Keep existing logic, add subtle ring shadow on selected variant
- Show variant image thumbnail if available

**6. Quantity Selector — More refined**

- Bordered pill with rounded buttons, slightly larger touch targets

**7. Tabs Redesign — Segmented with richer content**

- Three tabs: Description, Specifications, Reviews
- Description tab: bullet-point highlights if description contains line breaks
- Reviews tab: add rating distribution bar chart (5-star breakdown) at the top before individual reviews

**8. Bottom Action Bar — Gradient accent**

- Frosted glass background with subtle top shadow
- Three sections: Cart icon button (outlined), "Add to Cart" button, "Buy Now" primary button
- Remove total price from bottom bar (already visible in main content)

**9. Motion & Polish**

- Page entry: staggered fade-up for each section
- Image transitions: crossfade on gallery swipe
- Skeleton loading: shimmer effect matching new layout sections

10. **Estimated delivery**
  add estimated delivery from 10-16 something like this based on area

### Files Modified

- `**src/pages/ProductDetailPage.tsx**` — Complete rewrite of the JSX layout and styling. Data-fetching logic stays the same.

### No Backend Changes

All changes are purely presentational. No database or edge function modifications needed.