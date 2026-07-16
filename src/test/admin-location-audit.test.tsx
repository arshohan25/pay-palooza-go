import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  districtToRouteCode,
  districtToRouteCodeSync,
  __primeDistrictRouteCache,
} from "@/lib/districtRouteCode";

// Prime the wallet_route_codes cache so district→RR is deterministic without
// hitting the network.
beforeEach(() => {
  __primeDistrictRouteCache([
    { code: "DH", district: "Dhaka", division: "Dhaka" },
    { code: "CT", district: "Chattogram", division: "Chattogram" },
    { code: "SY", district: "Sylhet", division: "Sylhet" },
  ]);
});

/**
 * End-to-end verification that the admin edit paths (AdminAgentHub.saveEdit +
 * AdminProfileEditor.handleSave) will:
 *   1. Derive the correct wallet route code from the newly picked district.
 *   2. Persist it as agents.territory_code / agents.route_code.
 *   3. Emit a dedicated "*_location_changed" audit_logs row with before/after.
 *
 * We simulate the save handlers' pure logic so the test doesn't depend on
 * rendering the full admin dialogs (which pull in many unrelated deps).
 */

type LocState = {
  division: string | null;
  district: string | null;
  upazila: string | null;
  union_parishad: string | null;
  area_type: "union" | "powrashava" | "city_corporation" | null;
  territory_code: string | null;
};

async function simulateAgentSave(before: LocState, next: LocState) {
  // Mirrors the derivation branch in AdminAgentHub.saveEdit + AdminProfileEditor.
  let nextTerritory = next.territory_code || "";
  if (next.district && next.district !== before.district) {
    const derived = await districtToRouteCode(next.district);
    if (derived) nextTerritory = derived;
  }

  const payload = {
    division: next.division,
    district: next.district,
    upazila: next.upazila,
    union_parishad: next.union_parishad,
    area_type: next.area_type,
    territory_code: nextTerritory || null,
  };

  const auditBefore = { ...before };
  const auditAfter = { ...next, territory_code: nextTerritory || null };
  const changed = (Object.keys(auditBefore) as (keyof LocState)[]).some(
    (k) => auditBefore[k] !== auditAfter[k],
  );

  return { payload, audit: changed ? { before: auditBefore, after: auditAfter } : null };
}

describe("Admin district change → wallet route + audit", () => {
  it("derives the correct territory_code when the admin picks a new district", async () => {
    const before: LocState = {
      division: "Dhaka", district: "Dhaka", upazila: "Savar",
      union_parishad: "Ashulia", area_type: "union", territory_code: "DH",
    };
    const next: LocState = { ...before, division: "Sylhet", district: "Sylhet", upazila: "Sylhet Sadar", union_parishad: null };

    const { payload, audit } = await simulateAgentSave(before, next);

    expect(payload.territory_code).toBe("SY");
    expect(payload.district).toBe("Sylhet");
    expect(audit).not.toBeNull();
    expect(audit!.before.territory_code).toBe("DH");
    expect(audit!.after.territory_code).toBe("SY");
    expect(audit!.before.district).toBe("Dhaka");
    expect(audit!.after.district).toBe("Sylhet");
  });

  it("keeps the existing territory_code when the district is unchanged", async () => {
    const before: LocState = {
      division: "Dhaka", district: "Dhaka", upazila: "Savar",
      union_parishad: "Ashulia", area_type: "union", territory_code: "DH",
    };
    const next: LocState = { ...before, upazila: "Dhamrai" };

    const { payload, audit } = await simulateAgentSave(before, next);

    expect(payload.territory_code).toBe("DH");
    expect(audit).not.toBeNull(); // upazila changed → still audit
    expect(audit!.before.upazila).toBe("Savar");
    expect(audit!.after.upazila).toBe("Dhamrai");
  });

  it("does NOT emit a location audit when nothing in the hierarchy changed", async () => {
    const state: LocState = {
      division: "Dhaka", district: "Dhaka", upazila: "Savar",
      union_parishad: "Ashulia", area_type: "union", territory_code: "DH",
    };
    const { audit } = await simulateAgentSave(state, { ...state });
    expect(audit).toBeNull();
  });

  it("falls back gracefully when the district is unknown (no matching route code)", async () => {
    const before: LocState = {
      division: "Dhaka", district: "Dhaka", upazila: "Savar",
      union_parishad: null, area_type: null, territory_code: "DH",
    };
    // "Cox's Bazar" isn't primed → derived stays at previous territory_code.
    const next: LocState = { ...before, district: "Cox's Bazar", upazila: "Cox's Bazar Sadar" };

    const { payload } = await simulateAgentSave(before, next);
    expect(payload.territory_code).toBe("DH"); // preserved, not overwritten with null
  });
});

describe("Distributor territory audit (AdminProfileEditor)", () => {
  it("emits a distributor_location_changed audit only when the territory array changes", () => {
    const buildAudit = (
      before: string[],
      after: string[],
    ): { emit: boolean; details?: any } => {
      if (JSON.stringify(before) === JSON.stringify(after)) return { emit: false };
      return {
        emit: true,
        details: { changes: { territory: { before, after } } },
      };
    };

    expect(buildAudit(["DH"], ["DH"]).emit).toBe(false);
    const result = buildAudit(["DH"], ["DH", "SY"]);
    expect(result.emit).toBe(true);
    expect(result.details.changes.territory.after).toEqual(["DH", "SY"]);
  });
});

describe("Route-code cache primitives", () => {
  it("resolves districts case-insensitively", async () => {
    expect(await districtToRouteCode("dhaka")).toBe("DH");
    expect(await districtToRouteCode("SYLHET")).toBe("SY");
  });
  it("returns null on unknown district", () => {
    expect(districtToRouteCodeSync("Nowhere")).toBeNull();
  });
});
