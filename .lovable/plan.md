

## Fix: Splash Screen Replaying on Back Navigation

### Problem
When navigating back from pages like Donations or Shop to `/`, the `Index` component remounts from scratch. Since `splashDone` is local state initialized to `false`, the splash screen animation plays every time — unlike other flows that stay within the Index component.

### Solution
**File: `src/pages/Index.tsx`**

Change the `splashDone` initial state to check a session-level flag so the splash only plays once per browser session:

```tsx
// Before
const [splashDone, setSplashDone] = useState(false);

// After  
const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem("splashDone") === "1");
```

And when splash completes, persist the flag:

```tsx
// Before
<SplashScreen onDone={() => setSplashDone(true)} />

// After
<SplashScreen onDone={() => { sessionStorage.setItem("splashDone", "1"); setSplashDone(true); }} />
```

This ensures the splash only shows once per session (first app load), and navigating back from Donations, Shop, etc. goes straight to the home content.

