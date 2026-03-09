

## Fix nested `<p>` tag in AgentTransactionHistory.tsx

**File:** `src/pages/AgentTransactionHistory.tsx` (line 83)

Change the inner `<p>` to a `<span>` to fix invalid HTML nesting:

```tsx
// Before:
<p className="..."><p className="...">Cash In/Out: 0.49% · Bill Pay: 0.019%</p></p>

// After:
<p className="..."><span className="...">Cash In/Out: 0.49% · Bill Pay: 0.019%</span></p>
```

Single line change, no other files affected.

