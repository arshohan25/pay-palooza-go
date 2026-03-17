

## Redesign Shop Homepage — Premium Daraz-inspired Layout

Taking inspiration from the reference screenshot but elevating it further with a cleaner, more premium aesthetic.

### Key Design Changes

**1. Sticky Search Header — Rounded pill with cart badge**
- Search input in a rounded-full pill with a subtle shadow, search icon left
- Cart button with item count badge on the right
- Back arrow on the left
- Clean white/card background with no heavy borders

**2. Trust Bar — Horizontal icon strip below header**
- Three trust indicators in a row: "Safe Payment", "Fast Delivery", "Free Return"
- Each with a small icon + label, separated by vertical dividers
- Subtle muted background strip (`bg-muted/50`)

**3. Promo Banner Carousel — Reuse existing `PromoSlider`**
- Integrate the existing `PromoSlider` component into the shop page below the trust bar
- Full-bleed rounded carousel with auto-play and dot indicators (already built)

**4. Category Icons Grid — Visual category browsing**
- Replace the pill-style category scroll with a grid of circular/rounded category icons
- Each category shows an emoji or icon + label underneath
- Horizontally scrollable, larger touch targets than current pills
- "All" becomes the first item with a grid/apps icon

**5. Flash Sale / Trending Section — Horizontal product row**
- A "Flash Sale" or "Trending Now" section with a horizontal scroll of compact product cards
- Timer/fire icon in the header, "See All" link
- Smaller cards (~130px wide) with image, price, discount badge

**6. Voucher/Deals Banner (Static)**
- A small highlighted card showing "Claim Vouchers" or current deals
- Gradient background with bold text, purely decorative/informational

**7. Main Product Grid — Enhanced with section headers**
- "Just For You" header above the main 2-column product grid (existing `ProductCard` component)
- Sort & filter controls moved into a subtle inline bar above the grid
- Staggered fade-in animation on scroll

**8. AI Recommendations — Keep existing section, restyle header**
- Add sparkle icon animation, keep horizontal or grid layout

**9. Overall Polish**
- `bg-background` base with card sections having subtle shadows
- Rounded-2xl containers for each section
- Generous spacing between sections (`space-y-4`)
- Staggered `framer-motion` entry animations per section

### Files Modified

- **`src/pages/ShopPage.tsx`** — Major layout rewrite: add trust bar, integrate PromoSlider, category icon grid, flash sale row, voucher banner, restructured product grid with section headers. Data-fetching logic preserved.
- **`src/components/shop/CategoryNav.tsx`** — Redesign from horizontal pills to circular icon-style category chips with emoji indicators and labels.

### No Backend Changes
All changes are purely presentational. Existing data queries and components (ProductCard, CartDrawer, FilterDrawer) remain unchanged.

