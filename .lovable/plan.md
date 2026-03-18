

## Add Product Inquiry Badge to Merchant Dashboard

### Approach
Add a "Buyer Inquiries" card to the Merchant Services quick actions grid on the overview tab, showing the total unread chat count. Tapping it navigates to `/inbox`.

### Changes

**File: `src/pages/MerchantDashboard.tsx`**

1. Import `MessageCircle` from lucide-react and `useChat` from `@/hooks/use-chat`
2. In the `MerchOverview` component, call `useChat()` to get `totalUnread`
3. Add a 5th quick action card "Inquiries" with `MessageCircle` icon and a badge overlay showing `totalUnread` when > 0
4. On click, navigate to `/inbox`

The badge will be a small red circle with the count, positioned on the icon (same pattern used in `BottomNav` and `SideNav` for inbox badges).

### Files
- **Modified**: `src/pages/MerchantDashboard.tsx`

