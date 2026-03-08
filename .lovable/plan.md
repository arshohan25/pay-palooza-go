

## Fix: Checkout "Invalid Session" + Add Countdown Timer

### Problem
The screenshot shows the user landed on the literal URL `/checkout/:sessionId` (the route pattern itself, not a real UUID). This causes `useParams` to return the string `:sessionId`, which fails the database lookup and shows "Invalid Session". This is a preview navigation issue, not a code bug — the route definition is correct.

However, there are two real improvements to make:

### Changes to `src/pages/CheckoutPage.tsx`

**1. Add session ID validation**
Before querying the database, validate that `sessionId` looks like a valid UUID. If not, immediately show the error state. This prevents unnecessary database calls for malformed URLs.

**2. Add countdown timer**
- Calculate remaining seconds from `session.expires_at - now`
- Use a `setInterval` (1-second tick) to decrement the countdown
- Display as `MM:SS` in the expiry footer area (replacing the static "Expires at" text)
- Color-code: normal when >60s, amber when <60s, red when <30s
- Auto-transition to `"expired"` step when countdown hits 0

**3. Auto-redirect on expiry**
- When countdown reaches 0, set step to `"expired"`
- If `session.cancel_url` exists, auto-redirect after 5 seconds with a message

### Implementation Details

```typescript
// UUID validation
const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Countdown hook inside component
const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

useEffect(() => {
  if (!session?.expires_at || step !== "login" && step !== "confirm") return;
  const expires = new Date(session.expires_at).getTime();
  const tick = () => {
    const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
    setSecondsLeft(remaining);
    if (remaining <= 0) { setStep("expired"); }
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [session?.expires_at, step]);
```

Replace the static expiry footer with a live `MM:SS` countdown badge that changes color as time runs low.

| Section | Detail |
|---------|--------|
| File | `src/pages/CheckoutPage.tsx` |
| UUID check | Early return to `"error"` step if sessionId isn't a valid UUID |
| Timer state | `secondsLeft` updated every second via `setInterval` |
| Display | `MM:SS` countdown replacing static expiry text, color-coded |
| Auto-expire | Sets step to `"expired"` when timer hits 0 |

