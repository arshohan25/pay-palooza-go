/**
 * Pure classification helpers used by the Approvals Inbox bulk-confirmation UI.
 * Kept dependency-free so the classification / summary logic can be unit tested
 * without mounting React or Supabase.
 */
import { HIGH_RISK_PERMISSIONS, getHighRiskReasons } from "./permissionsRegistry";

export type ChangeKind = "add" | "remove" | "noop";

export interface BulkChangeInput {
  id: string;
  role: string;
  permission: string;
  /** Requested target value (true = grant, false = revoke). */
  allowed: boolean;
  /** Current DB value; `undefined` while still loading. */
  current: boolean | undefined;
}

export interface ClassifiedChange extends BulkChangeInput {
  kind: ChangeKind | "loading";
  highRisk: boolean;
  highRiskReasons: string[];
}

export function classifyChange(current: boolean | undefined, allowed: boolean): ChangeKind | "loading" {
  if (current === undefined) return "loading";
  if (current === allowed) return "noop";
  return allowed ? "add" : "remove";
}

export function classifyBulk(items: BulkChangeInput[]): ClassifiedChange[] {
  return items.map((it) => ({
    ...it,
    kind: classifyChange(it.current, it.allowed),
    highRisk: HIGH_RISK_PERMISSIONS.has(it.permission),
    highRiskReasons: HIGH_RISK_PERMISSIONS.has(it.permission) ? getHighRiskReasons(it.permission) : [],
  }));
}

export interface BulkSummary {
  total: number;
  add: number;
  remove: number;
  noop: number;
  loading: number;
  highRisk: number;
}

export function summarizeBulk(items: ClassifiedChange[]): BulkSummary {
  const s: BulkSummary = { total: items.length, add: 0, remove: 0, noop: 0, loading: 0, highRisk: 0 };
  for (const it of items) {
    if (it.kind === "add") s.add++;
    else if (it.kind === "remove") s.remove++;
    else if (it.kind === "noop") s.noop++;
    else s.loading++;
    if (it.highRisk) s.highRisk++;
  }
  return s;
}
