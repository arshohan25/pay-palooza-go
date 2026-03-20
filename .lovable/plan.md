

## Fix: Center-align QR Modal Title

The "Scan to Pay" heading in the QR modal is left-aligned while all other text is centered.

### Change

**`src/pages/PayPage.tsx`** — In the `QrModal` component, the title `<h3>` element needs `text-center` added to its className, or the parent flex container arrangement needs adjustment so the title centers properly.

The parent div already has `text-center` from the previous fix, but the title row uses `flex items-center justify-between` which overrides text centering. The fix is to change the title row to center the text while keeping the close button positioned absolutely.

### Specific edit
- Change the QR modal header from a `flex justify-between` layout to a centered layout with the close button positioned absolutely on the right.

