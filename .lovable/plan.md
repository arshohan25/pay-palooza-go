

## Fix: "৩টি সহজ ধাপে" Banner Styling

### Problem
The text "৩টি সহজ ধাপে আপনার তথ্য সাবমিট করুন" is currently a small muted `<p>` inside the white card. In the reference screenshot, it's a prominent **gradient pink banner/pill** that sits between the header section and the steps card — overlapping the boundary like a floating label.

### Changes (single file: `src/components/KycFlow.tsx`)

**Move the banner text out of the card and make it a standalone gradient pill:**

1. Remove the `<p>` with "৩টি সহজ ধাপে..." from inside the card (line ~875-877)
2. Add a new floating gradient banner between the gradient header `</div>` and the steps card
   - Positioned with negative margin to overlap the header/card boundary
   - Pink/magenta gradient background (`from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)]`)
   - White bold text, rounded-full pill shape, centered horizontally
   - `mx-auto` with `max-w-fit`, `px-6 py-2.5`, `shadow-lg`
   - `z-10` to float above both sections
3. Adjust the card's top padding since the banner text is removed from inside it

### Result
The banner will look like a floating gradient pill sitting on the boundary between the pink header and the white card — matching the bKash reference exactly.

