

## Redesign Description Tab — Card View

### Current State
The Description tab renders plain `<p>` paragraphs with no visual structure — just stacked muted text lines.

### Redesign
Replace the plain text with a styled card layout:

**File: `src/pages/ProductDetailPage.tsx`** (lines 353-357)

Replace the description `TabsContent` with:

1. **Highlight Card** — A bordered rounded card (`bg-card border`) containing:
   - A small "Product Details" header with a `Package` icon
   - Each line of the description rendered as a bullet-point row with a small colored dot indicator and `text-sm` text
   - Lines split on `\n`; if only one line, show as a single paragraph with subtle left accent border

2. **Key Highlights Section** (if category/brand exist) — A small "Highlights" card below with icon-labeled chips showing category, brand, stock status in a flex-wrap layout using `Badge` components

3. **Visual polish** — Subtle `bg-muted/30` background on the content area, rounded-xl cards with `divide-y` between bullet rows, matching the specs tab card style already on the page

Single file change, ~30 lines replaced.

