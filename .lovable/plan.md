

## Redesign QR Scanner — Full-Screen with EasyPay Branding

Redesign `QrScannerModal` from a bottom-sheet style into a full-screen immersive scanner matching the Samsung Wallet reference screenshot.

### Design Changes

```text
┌──────────────────────────┐
│  [···] (menu/close)      │  ← Top-right close button
│                          │
│    Scan any QR  ⓘ        │  ← Title centered
│                          │
│  ┌──────────────────┐    │
│  │                  │    │  ← Full-width viewfinder
│  │  [camera feed]   │    │  with corner brackets
│  │                  │    │  (larger, bolder corners)
│  │  [scan line]     │    │
│  └──────────────────┘    │
│                          │
│  Align the QR code to    │  ← Help text below frame
│  fit inside the frame.   │
│  Pinch to zoom for       │
│  better focus.           │
│                          │
│   🔦         📷          │  ← Torch + Gallery buttons
│  Torch    Scan from      │     (circular icon buttons)
│           Gallery        │
│                          │
│      Supports            │  ← EasyPay branding footer
│    [EasyPay logo]        │
│                          │
└──────────────────────────┘
```

### Key Changes to `src/components/QrScannerModal.tsx`

1. **Full-screen layout** — Replace `bg-card rounded-t-3xl` bottom sheet with `fixed inset-0 bg-black` full-screen overlay. Camera feed fills the entire background.

2. **Viewfinder overlay** — Semi-transparent dark overlay with a clear cutout rectangle in the center (like the reference). Larger corner brackets with thicker borders.

3. **Title** — "Scan any QR" centered at top with an info icon, white text over the dark background.

4. **Help text** — "Align the QR code to fit inside the frame. Pinch to zoom for better focus." below the viewfinder.

5. **Action buttons** — Two circular icon buttons at the bottom:
   - **Torch** — toggles flashlight via `MediaStreamTrack.applyConstraints({ advanced: [{ torch: true/false }] })` (graceful fallback if unsupported)
   - **Scan from Gallery** — replaces the old "Upload QR" button with a circular gallery icon

6. **Branding footer** — "Supports" text with EasyPay logo at the very bottom.

7. **Close button** — Three-dot menu or X button in top-right corner.

8. **Scanning animation** — Keep the existing green scan line but make it span the viewfinder cutout width.

9. **Detected state** — Green glow on corner brackets + success icon in center.

### Torch Implementation

```typescript
const toggleTorch = async () => {
  if (!cameraStream) return;
  const track = cameraStream.getVideoTracks()[0];
  const capabilities = track.getCapabilities?.();
  if (capabilities?.torch) {
    await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
    setTorchOn(!torchOn);
  }
};
```

### No Breaking Changes

- Same props interface (`open`, `onClose`, `onScan`, `title`)
- Same scanning logic (jsQR frame scanning, gallery upload)
- All 9 consumer components continue working without changes

### Files to Change

| File | Change |
|---|---|
| `src/components/QrScannerModal.tsx` | Complete UI redesign — full-screen, torch, branding |

