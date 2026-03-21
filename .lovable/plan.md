

## Fix: Add Product Sheet Hidden Behind Overlay

### Problem
The Products tab renders inside a `fixed inset-0 z-[70]` overlay. The Sheet component (used for Add/Edit Product form) uses `z-50` by default. Since `z-50 < z-[70]`, the sheet opens *behind* the overlay, making it invisible and unclickable.

### Solution
Override the Sheet's z-index in `MerchantProductsTab.tsx` so it renders above the `z-[70]` overlay.

### Changes in `src/components/MerchantProductsTab.tsx`

Add `className` overrides to both `SheetContent` and the Sheet overlay so they use `z-[80]` instead of the default `z-50`:

- **Line 431-432**: Change the `Sheet` + `SheetContent` to include a higher z-index. Wrap with a portal-level z-index by adding `className="z-[80]"` style overrides on the SheetContent.

Specifically, on the `<SheetContent>` element (line 432), add a `style={{ zIndex: 80 }}` or use a `[&]:z-[80]` class. Since the Sheet overlay is a separate element, we need to ensure both the overlay and content render above z-70.

The cleanest approach: wrap the `<Sheet>` in a div with a high z-index won't work (portals). Instead, pass custom className to SheetContent to override z-index, and use the Sheet's `modal` prop with a custom overlay class.

**Practical fix**: Add `className` with `z-[80]` to the `SheetContent` component, and since the overlay is rendered separately by Radix, also pass an overlay className. The simplest reliable fix is to add inline styles or use the `[&]` selector pattern on SheetContent.

### File Modified
- `src/components/MerchantProductsTab.tsx` — Add `z-[80]` class to SheetContent (line 432) and ensure the Sheet overlay also gets a higher z-index

