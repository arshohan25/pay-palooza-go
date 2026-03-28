# Clean Up Route List — Only Main Apps at Top Level

## Problem

The Lovable preview route picker shows all routes including sub-pages (/shop/:slug, /orders/:id, /careers, /coupons, /donations, /loan, /insurance, /giftcards, etc.). The user wants only main app entry points visible.

## Approach

Use React Router nested routes — sub-pages become children of their parent `<Route>`. The Lovable route picker only shows top-level routes, so nesting hides sub-routes from the picker while keeping them fully functional.

## Top-level routes to keep (7 main apps + utilities)

1. `/` — User App (home)
2. `/admin` — Admin Dashboard
3. `/agent/*` — Agent (with nested cashin, b2b, register, billpay, history, bank, analytics)
4. `/merchant` — Merchant Dashboard
5. `/distributor/*` — Distributor (with nested create-agent)
6. `/super-distributor/*` — Super Distributor (with nested create-distributor)
7. `/developers` — Developer Portal
8. `/install`, `/install/:role`
9. `/team-login`

## Routes to nest under User App (`/`)

These become child routes of `/` using an `<Outlet>`:

- `/shop`, `/shop/checkout`, `/shop/:slug`
- `/product/:id`
- `/wishlist`, `/orders`, `/orders/:id`
- `/careers`, `/coupons`, `/donations`, `/loan`, `/insurance`, `/giftcards`
- `/checkout/:sessionId`, `/pay/qr/:sessionId`, `/pay`
  &nbsp;

## Changes

### File: `src/App.tsx`

1. Create a simple layout wrapper component that renders `<Outlet />` for nested routes
2. Restructure routes:

```text
<Route path="/" element={<AppLayout />}>
  <Route index element={<Index />} />
  <Route path="shop" element={<ShopPage />} />
  <Route path="shop/checkout" element={<ShopCheckoutPage />} />
  <Route path="shop/:slug" element={<VendorStorePage />} />
  <Route path="product/:id" element={<ProductDetailPage />} />
  ... all other user sub-routes
</Route>

<Route path="/admin" element={<RoleGuard ...><AdminDashboard /></RoleGuard>} />

<Route path="/agent" element={<RoleGuard ...>}>
  <Route index element={<AgentDashboard />} />
  <Route path="cashin" element={<AgentCashIn />} />
  ... other agent sub-routes
</Route>

<Route path="/distributor" element={<RoleGuard ...>}>
  <Route index element={<DistributorDashboard />} />
  <Route path="create-agent" element={<DistributorCreateAgent />} />
</Route>

<Route path="/super-distributor" element={<RoleGuard ...>}>
  <Route index element={<SuperDistributorDashboard />} />
  <Route path="create-distributor" element={<SuperDistributorCreateDistributor />} />
</Route>

<Route path="/merchant" element={<RoleGuard ...><MerchantDashboard /></RoleGuard>} />
<Route path="/developers" element={<DeveloperPortal />} />
```

3. For agent/distributor/super-distributor parent routes with nested children, create a thin wrapper that renders `<RoleGuard>` + `<Outlet />` so child routes inherit the guard.

### New file: `src/components/AppLayout.tsx` (tiny)

Just renders `<Outlet />` — a passthrough layout wrapper required by React Router for nested routes.

### New file: `src/components/RoleGuardLayout.tsx` (tiny)

Wraps `<RoleGuard>` around `<Outlet />` for role-protected route groups.

## Summary

- 1 file restructured: `App.tsx`
- 2 small new files: `AppLayout.tsx`, `RoleGuardLayout.tsx`
- All existing URLs continue to work — no link changes needed
- Route picker shows only: `/`, `/admin`, `/agent`, `/merchant`, `/distributor`, `/super-distributor`, `/developers`