import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LocationMismatchAlert from "@/components/LocationMismatchAlert";
import { detectLocationMismatch } from "@/lib/detectLocationMismatch";
import { districtToRouteCode, __primeDistrictRouteCache } from "@/lib/districtRouteCode";

// Mock validate_location_hierarchy: valid when upazila is "Savar" under
// Dhaka/Dhaka; invalid otherwise. Union checks: valid only for name "Ashulia".
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (_fn: string, args: any) => {
      const { _division, _district, _upazila, _union_parishad } = args;
      const upazilaOk =
        _division === "Dhaka" && _district === "Dhaka" && _upazila === "Savar";
      if (!upazilaOk) return { data: false };
      if (_union_parishad && _union_parishad !== "Ashulia") return { data: false };
      return { data: true };
    }),
  },
}));

describe("LocationMismatchAlert", () => {
  it("renders nothing when there is no mismatch", () => {
    const { container } = render(<LocationMismatchAlert mismatch={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("names the specific field on an upazila mismatch", () => {
    render(
      <LocationMismatchAlert
        mismatch={{ field: "upazila", message: "Pick Savar." }}
      />,
    );
    const alert = screen.getByTestId("location-mismatch-alert");
    expect(alert.getAttribute("data-field")).toBe("upazila");
    expect(alert.textContent).toMatch(/Upazila \/ Thana needs correction/);
    expect(alert.textContent).toMatch(/Pick Savar\./);
  });

  it("names the specific field on a union mismatch", () => {
    render(
      <LocationMismatchAlert
        mismatch={{ field: "union_parishad", message: "Pick Ashulia." }}
      />,
    );
    const alert = screen.getByTestId("location-mismatch-alert");
    expect(alert.getAttribute("data-field")).toBe("union_parishad");
    expect(alert.textContent).toMatch(/Union \/ Powrashava \/ City Corp\. needs correction/);
  });
});

describe("detectLocationMismatch", () => {
  it("reports the missing field first (division)", async () => {
    const m = await detectLocationMismatch({
      division: null, district: null, upazila: null,
    });
    expect(m?.field).toBe("division");
  });

  it("reports upazila mismatch when div/dist/up triple is invalid", async () => {
    const m = await detectLocationMismatch({
      division: "Dhaka", district: "Dhaka", upazila: "Bogra",
    });
    expect(m?.field).toBe("upazila");
    expect(m?.message).toMatch(/Bogra/);
  });

  it("passes for a valid div/dist/up triple with no union", async () => {
    const m = await detectLocationMismatch({
      division: "Dhaka", district: "Dhaka", upazila: "Savar",
    });
    expect(m).toBeNull();
  });

  it("reports union mismatch when the union doesn't belong", async () => {
    const m = await detectLocationMismatch({
      division: "Dhaka", district: "Dhaka", upazila: "Savar",
      union_parishad: "Wrong Union", area_type: "union",
    });
    expect(m?.field).toBe("union_parishad");
    expect(m?.message).toMatch(/Wrong Union/);
    expect(m?.message).toMatch(/Union/);
  });

  it("passes for a valid full 4-level selection", async () => {
    const m = await detectLocationMismatch({
      division: "Dhaka", district: "Dhaka", upazila: "Savar",
      union_parishad: "Ashulia", area_type: "union",
    });
    expect(m).toBeNull();
  });
});

describe("districtToRouteCode", () => {
  beforeEach(() => {
    __primeDistrictRouteCache([
      { code: "DH", district: "Dhaka", division: "Dhaka" },
      { code: "CT", district: "Chattogram", division: "Chittagong" },
      { code: "SY", district: "Sylhet", division: "Sylhet" },
    ]);
  });

  it("resolves a known district to its 2-letter code", async () => {
    expect(await districtToRouteCode("Dhaka")).toBe("DH");
    expect(await districtToRouteCode("Chattogram")).toBe("CT");
  });

  it("is case-insensitive", async () => {
    expect(await districtToRouteCode("dhaka")).toBe("DH");
    expect(await districtToRouteCode("  SYLHET  ")).toBe("SY");
  });

  it("returns null for unknown districts", async () => {
    expect(await districtToRouteCode("Atlantis")).toBeNull();
  });

  it("returns null for empty input", async () => {
    expect(await districtToRouteCode(null)).toBeNull();
    expect(await districtToRouteCode("")).toBeNull();
  });
});
