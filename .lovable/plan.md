

## Fix Share Button in UserQrModal

The same `navigator.share()` issue exists in `UserQrModal.tsx` — the share call at line 45 is not wrapped in a try/catch, so it throws an unhandled `NotAllowedError` in the iframe preview.

### Change

**File: `src/components/UserQrModal.tsx`**

Wrap the `handleShare` function with try/catch, falling back to `handleCopy()` + a toast notification — identical to the fix already applied in `WalletShareSheet.tsx`.

```typescript
const handleShare = async () => {
  try {
    if (navigator.share) {
      await navigator.share({ title: "My EasyPay ID", text: `My wallet ID: ${walletId}` });
      return;
    }
  } catch { /* blocked in iframe */ }
  handleCopy();
};
```

