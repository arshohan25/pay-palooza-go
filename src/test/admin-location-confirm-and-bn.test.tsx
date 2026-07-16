/**
 * Verifies:
 *  1. Changing Division in the admin editor cascades: District, Upazila and
 *     Union all get cleared, and picking a new district derives the correct
 *     wallet route_code / territory_code.
 *  2. DivisionDistrictUpazilaPicker renders every label, placeholder and
 *     area-type option in Bangla when the app is in Bangla mode.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import React, { useState, useEffect } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { __primeDistrictRouteCache, districtToRouteCode } from "@/lib/districtRouteCode";

// ---- Mock supabase to serve upazilas + unions data. ----
const { upazilas, unions } = vi.hoisted(() => ({
  upazilas: [
    { division: "Dhaka",   district: "Dhaka",     upazila: "Savar",         is_active: true },
    { division: "Dhaka",   district: "Dhaka",     upazila: "Dhamrai",       is_active: true },
    { division: "Sylhet",  district: "Sylhet",    upazila: "Sylhet Sadar",  is_active: true },
    { division: "Sylhet",  district: "Sylhet",    upazila: "Beanibazar",    is_active: true },
  ],
  unions: [
    { division: "Sylhet",  district: "Sylhet",    upazila: "Sylhet Sadar",  name: "Khadimpara", type: "union" },
  ],
}));

vi.mock("@/integrations/supabase/client", () => {
  const build = (table: string): any => {
    const data = table === "unions" ? unions : upazilas;
    const p: any = Promise.resolve({ data, error: null });
    p.select = () => build(table);
    p.eq = () => build(table);
    p.order = () => build(table);
    return p;
  };
  return { supabase: { from: (t: string) => build(t) } };
});

import DivisionDistrictUpazilaPicker, { type DivisionDistrictUpazilaValue } from "@/components/DivisionDistrictUpazilaPicker";

beforeEach(() => {
  __primeDistrictRouteCache([
    { code: "DH", district: "Dhaka",  division: "Dhaka" },
    { code: "SY", district: "Sylhet", division: "Sylhet" },
  ]);
});

// Mini editor mirroring AdminAgentHub's edit form: it auto-derives territory
// code from the picked district exactly the way saveEdit does.
function AdminEditorHarness() {
  const [v, setV] = useState<DivisionDistrictUpazilaValue>({
    division: "Dhaka", district: "Dhaka", upazila: "Savar", union_parishad: null, area_type: null,
  });
  const [territory, setTerritory] = useState<string>("DH");
  const [prevDistrict, setPrevDistrict] = useState<string>("Dhaka");

  useEffect(() => {
    if (v.district && v.district !== prevDistrict) {
      districtToRouteCode(v.district).then((code) => {
        if (code) setTerritory(code);
        setPrevDistrict(v.district || "");
      });
    }
  }, [v.district, prevDistrict]);

  return (
    <div>
      <DivisionDistrictUpazilaPicker value={v} onChange={setV} required />
      <div data-testid="territory-code">{territory}</div>
      <div data-testid="v-district">{v.district ?? ""}</div>
      <div data-testid="v-upazila">{v.upazila ?? ""}</div>
      <div data-testid="v-union">{v.union_parishad ?? ""}</div>
    </div>
  );
}

describe("Admin editor — change Division cascades and updates territory_code", () => {
  it("clears District/Upazila/Union when Division changes and re-derives wallet route code", async () => {
    render(<I18nProvider><AdminEditorHarness /></I18nProvider>);

    const division = (await screen.findByLabelText(/Division|বিভাগ/i)) as HTMLSelectElement;
    await waitFor(() =>
      expect(Array.from(division.options).map((o) => o.value)).toEqual(
        expect.arrayContaining(["Dhaka", "Sylhet"]),
      ),
    );

    // Sanity: baseline territory is DH.
    expect(screen.getByTestId("territory-code")).toHaveTextContent("DH");

    // Change Division → dependents cleared.
    fireEvent.change(division, { target: { value: "Sylhet" } });
    await waitFor(() => expect(screen.getByTestId("v-district")).toHaveTextContent(""));
    expect(screen.getByTestId("v-upazila")).toHaveTextContent("");
    expect(screen.getByTestId("v-union")).toHaveTextContent("");

    // Pick new district → territory_code re-derived from wallet_route_codes.
    const district = (await screen.findByLabelText(/^District$|^জেলা$/i)) as HTMLSelectElement;
    fireEvent.change(district, { target: { value: "Sylhet" } });
    await waitFor(() => expect(screen.getByTestId("territory-code")).toHaveTextContent("SY"));

    // And the Upazila list is filtered to Sylhet.
    const upazila = (await screen.findByLabelText(/Upazila|উপজেলা/i)) as HTMLSelectElement;
    const upazilaValues = Array.from(upazila.options).map((o) => o.value);
    expect(upazilaValues).toEqual(expect.arrayContaining(["Sylhet Sadar", "Beanibazar"]));
    expect(upazilaValues).not.toContain("Savar");
  });
});

// Toggle to Bangla, then render the picker.
function BanglaShell({ children }: { children: React.ReactNode }) {
  const { lang, toggleLang } = useI18n();
  useEffect(() => { if (lang === "en") toggleLang(); }, [lang, toggleLang]);
  return <>{children}</>;
}

describe("DivisionDistrictUpazilaPicker — Bangla localization", () => {
  it("renders labels, placeholders and area-type options in Bangla", async () => {
    render(
      <I18nProvider>
        <BanglaShell>
          <DivisionDistrictUpazilaPicker
            value={{ division: null, district: null, upazila: null, union_parishad: null, area_type: null }}
            onChange={() => {}}
            required
          />
        </BanglaShell>
      </I18nProvider>,
    );

    // Labels
    expect(await screen.findByText("বিভাগ *")).toBeTruthy();
    expect(screen.getByText("জেলা *")).toBeTruthy();
    expect(screen.getByText("উপজেলা / থানা *")).toBeTruthy();
    expect(screen.getByText("ইউনিয়ন পরিষদ / পৌরসভা / সিটি কর্পোরেশন *")).toBeTruthy();

    // Placeholder in Division dropdown
    const division = screen.getByLabelText("বিভাগ") as HTMLSelectElement;
    await waitFor(() =>
      expect(Array.from(division.options).map((o) => o.textContent)).toContain("বিভাগ নির্বাচন করুন"),
    );

    // Area-type options
    const areaType = screen.getByLabelText("ধরন") as HTMLSelectElement;
    const areaLabels = Array.from(areaType.options).map((o) => o.textContent);
    expect(areaLabels).toEqual(expect.arrayContaining(["ধরন", "ইউনিয়ন", "পৌরসভা", "সিটি কর্প."]));
  });
});
