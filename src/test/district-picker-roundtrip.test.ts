/**
 * Static wiring guard: every role's create/edit form must send the picker's
 * selected code(s) into the persisted DB field, and hydrate the picker from
 * that same field on reload. If someone rewires a form to a stale state key
 * (or drops the picker), this test fails.
 *
 * Also verifies the shared typeahead scorer handles common queries.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { districtCommandFilter } from "@/lib/districtCommandFilter";

const read = (p: string) =>
  fs.readFileSync(path.resolve(process.cwd(), p), "utf8");

describe("district/territory persistence wiring per role", () => {
  it("admin AdminAgentHub wires DistrictRoutePicker to agents.territory_code", () => {
    const src = read("src/components/admin/AdminAgentHub.tsx");
    expect(src).toMatch(/import DistrictRoutePicker from/);
    // create form: picker -> form.territory_code -> insert territory_code
    expect(src).toMatch(/DistrictRoutePicker[^]*value=\{form\.territory_code\}/);
    expect(src).toMatch(/territory_code:\s*form\.territory_code\s*\|\|\s*null/);
    // edit form: hydrated from row, saved back
    expect(src).toMatch(/territory_code:\s*a\.territory_code\s*\|\|\s*""/);
    expect(src).toMatch(/territory_code:\s*editForm\.territory_code\s*\|\|\s*null/);
  });

  it("admin AdminDistributorManagement wires DistrictMultiSelect to distributors.territory[]", () => {
    const src = read("src/components/admin/AdminDistributorManagement.tsx");
    expect(src).toMatch(/import DistrictMultiSelect from/);
    // both create and edit forms use the multi-select bound to CSV<->array adapters
    expect(src.match(/DistrictMultiSelect/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/territory:\s*createForm\.territory\s*\?\s*createForm\.territory\.split\(","\)/);
    expect(src).toMatch(/territory:\s*editForm\.territory\s*\?\s*editForm\.territory\.split\(","\)/);
    // edit form hydrates from row.territory joined back to CSV
    expect(src).toMatch(/territory:\s*d\.territory\?\.join\(", "\)/);
  });

  it("admin AdminProfileEditor wires DistrictRoutePicker (agent) and DistrictMultiSelect (distributor)", () => {
    const src = read("src/components/admin/AdminProfileEditor.tsx");
    expect(src).toMatch(/DistrictRoutePicker[^]*value=\{agent\.territory_code\}/);
    expect(src).toMatch(/DistrictMultiSelect/);
    // distributor territory is hydrated from row and re-saved as array
    expect(src).toMatch(/territory:\s*distributorRes\.data\.territory\s*\|\|\s*\[\]/);
    expect(src).toMatch(/distUpdate\.territory\s*=\s*newTerritory/);
  });

  it("distributor DistributorCreateAgent wires DistrictRoutePicker to agents.territory_code", () => {
    const src = read("src/pages/DistributorCreateAgent.tsx");
    expect(src).toMatch(/import DistrictRoutePicker from/);
    expect(src).toMatch(/DistrictRoutePicker[^]*value=\{territory\}/);
    expect(src).toMatch(/territory_code:\s*territory\s*\|\|\s*null/);
  });

  it("super-distributor SuperDistributorCreateDistributor wires DistrictMultiSelect to territories[]", () => {
    const src = read("src/pages/SuperDistributorCreateDistributor.tsx");
    expect(src).toMatch(/import DistrictMultiSelect from/);
    expect(src).toMatch(/DistrictMultiSelect\s+value=\{territories\}\s+onChange=\{setTerritories\}/);
  });
});

describe("district typeahead scorer", () => {
  const hay = "Dhaka DH Dhaka"; // district code division

  it("scores empty query as pass-through", () => {
    expect(districtCommandFilter(hay, "")).toBe(1);
  });
  it("exact token match wins", () => {
    expect(districtCommandFilter(hay, "dh")).toBe(1);
    expect(districtCommandFilter(hay, "dhaka")).toBe(1);
  });
  it("prefix match beats substring", () => {
    const prefix = districtCommandFilter("Chattogram CT Chittagong", "chat");
    const substr = districtCommandFilter("Rangamati RM Chittagong", "gam");
    expect(prefix).toBeGreaterThan(substr);
  });
  it("substring still matches", () => {
    expect(districtCommandFilter("Rangamati RM Chittagong", "gam")).toBeGreaterThan(0);
  });
  it("subsequence fallback catches abbreviations", () => {
    expect(districtCommandFilter("Dhaka DH Dhaka", "dhk")).toBeGreaterThan(0);
  });
  it("no match returns 0", () => {
    expect(districtCommandFilter("Dhaka DH Dhaka", "xyz")).toBe(0);
  });
});
