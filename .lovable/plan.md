

# Premium Product Title & Infinite Scroll Cleanup

## Changes

### 1. Product titles: single line with ellipsis (4 files)

**`src/components/shop/ProductCard.tsx`** (line 82):
- Change `line-clamp-2` → `truncate` on the product name `<h3>`

**`src/components/ShopFlow.tsx`** (line 902):
- Change `line-clamp-2` → `truncate` on `<p>` product name

**`src/pages/ProductDetailPage.tsx`** (line 741):
- Change `line-clamp-2` → `truncate` on related product name in the "You May Also Like" section

**`src/pages/InboxPage.tsx`** (line 469):
- Change `line-clamp-2` → `truncate` on the product name in inbox product cards

> The single product detail page title stays multi-line (full title visible as requested).

### 2. Remove "Load More" button — show all products (ShopPage.tsx)

- Remove `visibleCount` state and `hasMore` logic
- Use `filtered` directly instead of `paginatedProducts` in the product grid
- Delete the "Load More" button block (lines 559-570)
- Remove the `useEffect` that resets `visibleCount` on filter change

### 3. Scrollbar — already hidden globally

The `src/index.css` already has global scrollbar hiding (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`), so no changes needed.

## Summary
- 4 files: `line-clamp-2` → `truncate` for single-line product titles
- 1 file: remove pagination logic in ShopPage for infinite scroll
- No backend changes

