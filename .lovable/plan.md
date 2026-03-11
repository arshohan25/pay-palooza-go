

## Fix: Share Button Not Working in WalletShareSheet

**Problem**: The share button calls `navigator.share()` but silently swallows all errors in the catch block. On many mobile browsers (especially in webview/iframe contexts), `navigator.share` exists but throws a `NotAllowedError`. The user gets no feedback when it fails.

**Root cause**: The catch block is empty — `catch { /* dismissed */ }` — so failures are invisible.

### Changes in `src/components/WalletShareSheet.tsx`

1. **Improve `handleShare`**: Add proper error handling with fallback chain:
   - Try `navigator.share()` first
   - If it throws (not just user dismissal), fall back to `navigator.clipboard.writeText()`
   - Show a toast notification confirming what happened (shared vs copied to clipboard)

2. **Add toast import** for user feedback via `sonner`.

```tsx
const handleShare = async () => {
  haptics.medium();
  const text = `💳 My EasyPay Wallet ID: ${walletId}\n👤 ${userName}\n\nScan my QR code to send money instantly!`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "My EasyPay Wallet", text });
      return;
    }
  } catch (err: any) {
    // Only fall through if it's NOT a user cancellation
    if (err?.name === "AbortError") return;
  }
  // Fallback: copy to clipboard
  handleCopy();
  toast.success("Wallet ID copied to clipboard");
};
```

This ensures the share button always does something visible — either opens the native share sheet or copies the wallet ID with confirmation feedback.

