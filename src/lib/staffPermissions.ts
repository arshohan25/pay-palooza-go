// Single source of truth for merchant staff permissions.
// Used by:
//  - MerchantStaffTab (Add/Edit Permissions sheet)
//  - useStaffAccess (returns `can()` helper)
//  - MerchantDashboard (filters tabs/menu items by permission)

export type StaffRole = "Manager" | "Cashier" | "Viewer";

export interface StaffPermissionDef {
  key: string;
  label: string;
  hint?: string;
  group: string;
  /** Auto-checked when this perm is granted. */
  implies?: string[];
}

export const STAFF_PERMISSIONS: StaffPermissionDef[] = [
  // Operations
  { key: "orders_view",     label: "View orders",       group: "Operations", hint: "See order list and details" },
  { key: "orders_manage",   label: "Process orders",    group: "Operations", hint: "Accept, fulfill, cancel orders", implies: ["orders_view"] },
  { key: "refunds_view",    label: "View refunds",      group: "Operations" },
  { key: "refunds_manage",  label: "Issue refunds",     group: "Operations", hint: "Approve refund requests", implies: ["refunds_view"] },
  { key: "inbox",           label: "Customer inbox",    group: "Operations", hint: "Reply to buyer chats" },

  // Catalog
  { key: "products_view",   label: "View products",     group: "Catalog" },
  { key: "products_manage", label: "Edit products",     group: "Catalog", hint: "Add, edit, delete products & stock", implies: ["products_view"] },
  { key: "coupons",         label: "Coupons",           group: "Catalog", hint: "Create and manage discount codes" },

  // Money
  { key: "transactions",    label: "Transactions",      group: "Money", hint: "View transaction ledger" },
  { key: "payouts",         label: "Payouts",           group: "Money", hint: "Bank withdrawals" },
  { key: "settlements",     label: "Settlements",       group: "Money" },
  { key: "mdr",             label: "MDR / fees",        group: "Money" },

  // Growth
  { key: "customers_view",  label: "Customers",         group: "Growth", hint: "View customer list" },
  { key: "analytics",       label: "Analytics",         group: "Growth", hint: "Sales reports & insights" },
  { key: "paylinks",        label: "Pay links",         group: "Growth" },

  // Store
  { key: "qr",              label: "QR codes",          group: "Store", hint: "Generate payment QR" },
  { key: "store_settings",  label: "Store settings",    group: "Store", hint: "Edit business info, hours" },

  // Personal
  { key: "notifications",   label: "Notification prefs", group: "Personal" },
];

export const PERMISSION_KEYS = STAFF_PERMISSIONS.map(p => p.key);

export const ROLE_DEFAULTS: Record<StaffRole, string[]> = {
  Manager: [
    "orders_view","orders_manage","refunds_view","refunds_manage","inbox",
    "products_view","products_manage","coupons",
    "transactions","payouts","settlements","mdr",
    "customers_view","analytics","paylinks",
    "qr","store_settings","notifications",
  ],
  Cashier: [
    "orders_view","orders_manage","products_view","inbox","customers_view","qr","notifications",
  ],
  Viewer: [
    "orders_view","products_view","transactions","analytics","notifications",
  ],
};

/** Map a MerchantDashboard tab id to the permission key required to see it. */
export const TAB_TO_PERMISSION: Record<string, string> = {
  overview: "",            // always visible
  qr: "qr",
  products: "products_view",
  orders: "orders_view",
  transactions: "transactions",
  settlements: "settlements",
  mdr: "mdr",
  paylinks: "paylinks",
  analytics: "analytics",
  api: "__owner_only__",   // never granted to staff
  store: "store_settings",
  inbox: "inbox",
  refunds: "refunds_view",
  staff: "__owner_only__",
  customers: "customers_view",
  coupons: "coupons",
  payouts: "payouts",
  notifications: "notifications",
};

export function permsToObject(keys: string[]): Record<string, boolean> {
  const obj: Record<string, boolean> = {};
  for (const k of keys) if (PERMISSION_KEYS.includes(k)) obj[k] = true;
  return obj;
}

export function expandImplies(keys: Set<string>): Set<string> {
  const out = new Set(keys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of STAFF_PERMISSIONS) {
      if (out.has(def.key) && def.implies) {
        for (const imp of def.implies) {
          if (!out.has(imp)) { out.add(imp); changed = true; }
        }
      }
    }
  }
  return out;
}

export function defaultPermissionsFor(role: StaffRole): Record<string, boolean> {
  return permsToObject(ROLE_DEFAULTS[role] ?? []);
}

export function countActive(perms: Record<string, boolean> | null | undefined): number {
  if (!perms) return 0;
  return Object.entries(perms).filter(([, v]) => v).length;
}

export const STAFF_PERMISSION_GROUPS = Array.from(
  STAFF_PERMISSIONS.reduce((acc, p) => {
    if (!acc.has(p.group)) acc.set(p.group, []);
    acc.get(p.group)!.push(p);
    return acc;
  }, new Map<string, StaffPermissionDef[]>()),
);
