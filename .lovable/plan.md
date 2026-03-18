

## Current Feature Audit — What's Already Built vs. What's Missing

Your project is very feature-rich. Here's a summary of what exists and meaningful gaps:

### Already Built
- Authentication, KYC, biometrics, PIN management
- Send Money, Cash Out, Payment, Mobile Recharge, Bill Pay, Bank Transfer, Add Money, Savings
- QR scanning/generation, Dynamic QR payments
- E-commerce: Shop, Products, Cart, Checkout, Wishlist, Orders, Vendor Stores, Flash Sales, Coupons
- Invoice Generator & Printer (PDF via jsPDF)
- Courier Providers & Delivery Zones (zone-based fees)
- Careers Page & Job Applications
- Admin Dashboard with 70+ management panels (fraud, KYC, commissions, treasury, etc.)
- Agent, Distributor, Super Distributor, Merchant dashboards
- Notifications, Support Chat, Referrals, Spending Insights, Budget Manager
- Festival themes, PWA install prompts, i18n

---

### Recommended Features to Add

**1. Order Tracking Timeline (Customer-facing)**
- Currently orders show status badges but no step-by-step tracking timeline
- Add a visual timeline on `OrderDetailPage` showing: Placed → Confirmed → Shipped → Out for Delivery → Delivered, with timestamps
- Also integrate courier tracking URL from `courier_providers.tracking_url_template`

**2. Push Notifications / Email Notifications for Order Status Changes**
- When admin updates order status, no notification reaches the customer
- Add a database trigger or edge function that sends email/push when order status changes

**3. Coupons & Offers Page (marked "coming soon" in MoreSheet)**
- The "Coupons & Offers" item in MoreSheet is marked `soon: true`
- Build a user-facing page listing active coupons they can browse and copy codes from

**4. Donations Feature (marked "coming soon" in MoreSheet)**
- Similarly flagged as coming soon
- Build a donation flow with preset causes/amounts

**5. Return/Refund Request System**
- No way for customers to request returns or refunds on delivered orders
- Add a "Request Return" button on delivered orders and admin panel to manage them

**6. Product Search with Autocomplete**
- ShopPage has category filters but no text search with live suggestions
- Add a search bar with debounced autocomplete across product names

**7. Order Status Email/SMS Notifications**
- Currently no automated communication when order status changes
- Create an edge function triggered on order status update

**8. Merchant Payout / Settlement Reports**
- Merchants can see orders but no settlement/payout summary showing what they're owed
- Add a "Settlements" tab to MerchantDashboard

