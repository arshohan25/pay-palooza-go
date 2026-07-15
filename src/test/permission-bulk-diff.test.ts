/**
 * Verifies the pure classification/summary logic that powers the
 * bulk-approve confirmation dialog:
 *   - ADD / REMOVE / NO-OP labelling from (current, requested) pairs
 *   - High-risk flag propagation from the permission registry
 *   - Aggregate summary counts (add, remove, noop, high-risk, loading)
 */
import { describe, it, expect } from "vitest";
import { classifyChange, classifyBulk, summarizeBulk } from "@/lib/permissionBulkDiff";
import { HIGH_RISK_PERMISSIONS } from "@/lib/permissionsRegistry";

// Sanity: the registry must actually mark at least one perm high-risk,
// otherwise the flag assertions below are vacuous.
const HIGH = Array.from(HIGH_RISK_PERMISSIONS)[0];
const LOW = "manage_distributors"; // registered but not high-risk

describe("classifyChange", () => {
  it("returns 'loading' while the current DB value is unknown", () => {
    expect(classifyChange(undefined, true)).toBe("loading");
    expect(classifyChange(undefined, false)).toBe("loading");
  });
  it("returns 'add' when granting a currently-denied permission", () => {
    expect(classifyChange(false, true)).toBe("add");
  });
  it("returns 'remove' when revoking a currently-allowed permission", () => {
    expect(classifyChange(true, false)).toBe("remove");
  });
  it("returns 'noop' when the requested value matches the current value", () => {
    expect(classifyChange(true, true)).toBe("noop");
    expect(classifyChange(false, false)).toBe("noop");
  });
});

describe("classifyBulk + summarizeBulk", () => {
  const items = [
    { id: "1", role: "support",  permission: LOW,  allowed: true,  current: false },     // ADD low-risk
    { id: "2", role: "support",  permission: LOW,  allowed: false, current: true },      // REMOVE low-risk
    { id: "3", role: "support",  permission: LOW,  allowed: true,  current: true },      // NO-OP
    { id: "4", role: "operations", permission: HIGH, allowed: true,  current: false },   // ADD high-risk
    { id: "5", role: "operations", permission: HIGH, allowed: false, current: undefined },// LOADING (still high-risk)
  ];

  it("classifies each item with correct kind and high-risk flag", () => {
    const out = classifyBulk(items);
    expect(out.map((x) => x.kind)).toEqual(["add", "remove", "noop", "add", "loading"]);
    expect(out.map((x) => x.highRisk)).toEqual([false, false, false, true, true]);
    // High-risk reasons only surface on flagged permissions
    expect(out[0].highRiskReasons).toHaveLength(0);
    expect(out[3].highRiskReasons.length).toBeGreaterThan(0);
  });

  it("summarizes aggregate counts correctly", () => {
    const s = summarizeBulk(classifyBulk(items));
    expect(s).toEqual({ total: 5, add: 2, remove: 1, noop: 1, loading: 1, highRisk: 2 });
  });

  it("summarizes an empty batch as all zeros", () => {
    expect(summarizeBulk([])).toEqual({ total: 0, add: 0, remove: 0, noop: 0, loading: 0, highRisk: 0 });
  });

  it("does not flag unregistered permissions as high-risk", () => {
    const out = classifyBulk([{ id: "x", role: "support", permission: "not_a_real_perm", allowed: true, current: false }]);
    expect(out[0].highRisk).toBe(false);
    expect(out[0].kind).toBe("add");
  });
});
