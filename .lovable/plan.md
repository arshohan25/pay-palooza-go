## Hide cross-portal CTAs for verified devices

The screenshot points at the "New here? Apply as a merchant →" pill and the "Manage a store as staff? Manager login →" link at the bottom of the merchant login screen. These are acquisition/discovery prompts — once the device is already verified and bound to a returning user, they're noise. Same applies to the matching block on the manager login screen ("Are you the store owner? Owner login" + "Don't have an EasyPay account? Sign up").

### What changes

**`src/pages/MerchantLoginPage.tsx`** (lines ~679–701)
- Wrap the **"New here? Apply as a merchant"** Button and the **"Manage a store as staff? Manager login"** link in a `{!boundPhone && ( … )}` guard.
- `boundPhone` is already set from `localStorage.mfs_device_phone` on mount, so a returning verified merchant on this device will see only:
  - The phone + PIN form
  - The compact "Forgot PIN? Reset securely →" chip
- A first-time visitor (no `mfs_device_phone`) keeps the full discovery footer.

**`src/pages/MerchantManagerLoginPage.tsx`** (lines ~531–547)
- Wrap the **"Are you the store owner? Owner login"** Button and the **"Don't have an EasyPay account? Sign up"** link in a `{!hasAuthedBefore && ( … )}` guard.
- `hasAuthedBefore` is already populated from `localStorage.mfs_has_authenticated` on mount and is the same flag we use for the manager explainer + trust pills, keeping behavior consistent: returning managers see the clean form + Forgot PIN chip only.

### What stays visible for everyone

- The phone + PIN inputs and primary "Sign in" CTA
- The compact **Forgot PIN? Reset securely →** chip (still essential for verified users)
- Lockout / wrong-PIN banners
- The OTP step when triggered

### Technical notes

- No new state, no new effects — both pages already track the "returning device" signal (`boundPhone` for merchant, `hasAuthedBefore` for manager). This is purely a conditional render around an existing JSX block.
- The acquisition CTAs remain reachable via the public landing page (`/`) and `/auth`, so we're not removing entry points — only decluttering the verified-device experience.
- No backend, route, or auth-flow changes.
