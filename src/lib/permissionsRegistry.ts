/**
 * Registry of app-level permission keys used by the admin RBAC UI.
 * Adding a new key here surfaces a toggle in the Roles & Permissions page.
 */
export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  group: string;
  /** High-risk toggles require a second-admin approval before taking effect. */
  highRisk?: boolean;
  /** Concrete reasons this permission is flagged high-risk (shown in the diff modal). */
  highRiskReasons?: string[];
}

export const REGISTERED_PERMISSIONS: PermissionDef[] = [
  { key: "manage_distributors", label: "Manage distributors", description: "Create, edit, suspend distributors and link/unlink agents & territories.", group: "Network" },
  {
    key: "manage_super_distributors",
    label: "Manage super distributors",
    description: "Link, unlink and transfer distributors between super distributors.",
    group: "Network",
    highRisk: true,
    highRiskReasons: [
      "Restructures the entire distribution hierarchy — mistakes ripple to every downstream agent.",
      "Can reassign commission flows and territory ownership across regions.",
      "Requires a second admin because a rogue actor could redirect settlements at scale.",
    ],
  },
  { key: "manage_agents", label: "Manage agents", description: "Change agent status, distributor and other core fields.", group: "Network" },
  { key: "manage_territories", label: "Move / remove territories", description: "Add, remove or reassign territory codes on distributors.", group: "Network" },
  {
    key: "manage_roles",
    label: "Manage roles & permissions",
    description: "Edit this page — grant or revoke permissions across roles.",
    group: "Admin",
    highRisk: true,
    highRiskReasons: [
      "Meta-permission — the holder can grant themselves any other permission.",
      "Bypasses every downstream RBAC check if abused.",
      "Two-admin approval prevents unilateral privilege escalation.",
    ],
  },
  { key: "view_audit_logs", label: "View audit logs", description: "Read the platform-wide audit log stream.", group: "Compliance" },
];

export const HIGH_RISK_PERMISSIONS = new Set(
  REGISTERED_PERMISSIONS.filter((p) => p.highRisk).map((p) => p.key),
);

export function getHighRiskReasons(key: string): string[] {
  const p = REGISTERED_PERMISSIONS.find((x) => x.key === key);
  if (!p?.highRisk) return [];
  return p.highRiskReasons ?? [
    "Marked high-risk — changes require a second-admin approval and are audit-logged.",
  ];
}

/** Roles that show up as columns in the matrix. Kept in sync with app_role enum. */
export const ROLE_KEYS = [
  "admin",
  "manager",
  "operations",
  "compliance",
  "finance",
  "support",
  "marketing",
  "hr",
  "audit",
  "risk",
  "developer",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];
