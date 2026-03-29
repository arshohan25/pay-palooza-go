

# Premium Product Detail Page — Animations & Micro-interactions

## Overview
Add polished micro-interactions and animations to `src/pages/ProductDetailPage.tsx` for a premium shopping experience.

## Changes (1 file: `src/pages/ProductDetailPage.tsx`)

### 1. Wishlist Heart — Bounce on Toggle
- Wrap heart icon button with `motion.button` + `whileTap={{ scale: 0.75 }}` 
- Add scale pop animation on fill change using `AnimatePresence` + `motion.div` with key on wishlisted state

### 2. Quantity Buttons — Press Effect + Number Animation
- Wrap +/- buttons with `motion.button` + `whileTap={{ scale: 0.8 }}`
- Animate qty number with `AnimatePresence` + `motion.span` keyed on qty (vertical slide + fade)

### 3. Add to Cart — Success Checkmark Feedback
- New state: `addedToCart` (boolean, auto-resets after 600ms)
- On click, show animated checkmark icon replacing "Add to Cart" text briefly via `AnimatePresence`
- `whileTap={{ scale: 0.96 }}` on both bottom bar buttons

### 4. Variant Chips — Spring Press
- `motion.button` with `whileTap={{ scale: 0.9 }}` and `layout` prop for smooth selection ring transition

### 5. Image Carousel — Subtle Zoom on Hold
- Add `whileTap={{ scale: 1.03 }}` on the carousel image for pinch-to-zoom feel
- Slightly increase x offset (60→80) and add scale (0.96→1) on image transitions

### 6. Sticky Header — Scroll-based Opacity
- Track scroll with `useEffect` + `scroll` event listener, store in state
- Header bg transitions from `bg-card/0` to `bg-card/70` once scrolled past image (~400px)

### 7. Related Product Cards — Hover/Press Effects
- Add `whileHover={{ y: -3 }}` and `whileTap={{ scale: 0.97 }}` on related product cards

### 8. Delivery Trust Icons — Staggered Entrance
- Each trust row item wrapped in `motion.div` with stagger delay based on index

### 9. Tab Content — Crossfade
- Wrap `TabsContent` children in `motion.div` with `initial={{ opacity: 0 }}` `animate={{ opacity: 1 }}` for smooth tab switching

## Technical Notes
- All changes in one file
- Uses existing `framer-motion` imports
- New state: `addedToCart` (boolean), `headerOpaque` (boolean)
- No new dependencies, no backend changes

