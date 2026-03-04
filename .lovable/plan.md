

## Add Realtime Activity Feed Sidebar

A collapsible sidebar on the right side of the admin dashboard showing a chronological, real-time log of all admin-relevant database changes (new users, transactions, fraud alerts, disputes, KYC, orders, etc.).

### New Component: `src/components/admin/AdminActivityFeed.tsx`

A sidebar panel that:
- Listens to Supabase realtime on all key tables (`transactions`, `profiles`, `fraud_alerts`, `disputes`, `kyc_verifications`, `orders`, `agents`, `merchants`, `fee_config`, `support_conversations`, `platform_treasury`)
- Accumulates events into an in-memory array (capped at ~200 entries) with timestamp, event type (INSERT/UPDATE/DELETE), table name, and a brief human-readable summary
- Renders each event as a compact card with an icon (color-coded by table/event type), description, and relative timestamp
- Uses `ScrollArea` for overflow, with auto-scroll-to-top on new events
- Includes a "Clear" button to reset the feed
- Animated entry via framer-motion for new items

### Event Display Format
Each event shows:
- Icon + color based on table (e.g., green for transactions, red for fraud alerts, blue for profiles)
- Human-readable label: "New transaction: ৳500 send", "User profile updated", "Fraud alert: high severity", "KYC submission received", "Order status changed to shipped"
- Relative time ("2s ago", "1m ago")

### Integration: `src/pages/AdminDashboard.tsx`

- Add a toggle button (e.g., `Radio` or `Activity` icon) in the admin header to show/hide the feed sidebar
- Render the feed as a fixed right panel (w-72, hidden on mobile) or as a `Sheet` on mobile
- The feed sidebar sits alongside the main content area with a smooth slide animation

### Layout Change
```text
┌──────────┬─────────────────────┬──────────┐
│ Left Nav │   Main Content      │ Activity │
│  (w-56)  │                     │  Feed    │
│          │                     │  (w-72)  │
└──────────┴─────────────────────┴──────────┘
```

The right panel is toggled via a button in the header. When hidden, main content expands to full width.

### Files
- **New**: `src/components/admin/AdminActivityFeed.tsx` — the feed component with its own realtime channel
- **Edit**: `src/pages/AdminDashboard.tsx` — add toggle state, header button, and render the feed panel

