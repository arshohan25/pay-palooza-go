

## Plan: Add RealtimeUpdateIndicator to AdminRechargeApiConnect

### Change

In `src/components/admin/AdminRechargeApiConnect.tsx`:

1. Import `useRealtimeIndicator` and `RealtimeUpdateIndicator`
2. Initialize the hook: `const { visible, flash } = useRealtimeIndicator()`
3. Call `flash()` inside the realtime callback (line 91) after `loadConfigs()`
4. Render `<RealtimeUpdateIndicator visible={visible} />` below the heading text (around line 152)

### Files
- `src/components/admin/AdminRechargeApiConnect.tsx`

