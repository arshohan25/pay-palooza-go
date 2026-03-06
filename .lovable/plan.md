

## Plan: Generate Properly Sized PWA Icons

### Approach
Create a one-time utility edge function that uses the Lovable AI image model (google/gemini-2.5-flash-image) to:
1. Take the current logo and generate a 192x192 version with white background, centered logo with padding
2. Take the current logo and generate a 512x512 version with white background, centered logo with padding

The edge function will:
- Fetch the current logo from the app's public URL
- Send it to the AI image model with instructions to resize/reformat to exact dimensions with white background
- Return the base64 images
- Then we save the results to `public/icons/icon-192.png` and `public/icons/icon-512.png`

### Alternative (simpler) approach
Since we already have the logo at `public/icons/easypay-logo.png`, we can use an edge function with the Canvas API (via Deno's image libraries) or simply use the AI image model to generate clean square icons at the exact sizes needed with white fill and proper padding.

### Implementation
1. **Create edge function** `generate-pwa-icons` that takes the logo, sends it to the AI image model with prompt: "Resize this logo to exactly {size}x{size} pixels. Place it centered on a solid white square background with 15% padding on all sides. Output a clean PNG."
2. **Call the function** to get both sizes
3. **Save the output** images to `public/icons/icon-192.png` and `public/icons/icon-512.png`

### Files
- `supabase/functions/generate-pwa-icons/index.ts` (new, temporary utility)
- `public/icons/icon-192.png` (overwritten with properly sized version)
- `public/icons/icon-512.png` (overwritten with properly sized version)

