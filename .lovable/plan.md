

## Auto-redirect unregistered numbers to registration

**Problem**: When a user enters a phone number on the login screen that doesn't exist in the system, they proceed to the PIN screen and only discover the error after entering a PIN (authentication failure). Instead, the app should detect the unregistered number and redirect to the account creation flow.

**Fix in `src/pages/AuthPage.tsx`**:

Modify `handleLoginPhone` (line 443-446) to check if the phone is registered using the existing `isPhoneRegistered()` function. If not registered, automatically switch to `register_phone` mode with the phone number pre-filled, and show a helpful message.

```tsx
const handleLoginPhone = async () => {
  if (!isValidPhone(phone)) { setError(t.validPhone); return; }
  try {
    const registered = await isPhoneRegistered(phone);
    if (!registered) {
      // Redirect to registration with phone pre-filled
      goTo("register_phone");
      setError(t.notRegistered);
      return;
    }
  } catch { /* proceed to login if check fails */ }
  goTo("login_pin");
};
```

This reuses the existing `isPhoneRegistered` helper and `t.notRegistered` translation string (already defined in both en/bn). The phone number stays filled so the user doesn't have to re-enter it.

