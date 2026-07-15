/**
 * End-to-end style integration test for AdminAgentHub Create/Edit Agent forms.
 *
 * Verifies the Create/Edit submit buttons remain DISABLED until Division,
 * District, and Upazila/Thana are all selected — mirroring the exact
 * `disabled=` predicate used inside AdminAgentHub.tsx:
 *
 *   Create: creating || !form.phone || !form.division || !form.district || !form.upazila
 *   Edit  : editSaving || !editForm.division || !editForm.district || !editForm.upazila
 *
 * We drive the real DivisionDistrictUpazilaPicker (native <select>s) after
 * stubbing supabase.from("upazilas") with a small in-memory dataset.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useState } from "react";

// ---- Stub supabase client to serve the upazilas dataset ----
const { rows } = vi.hoisted(() => ({
  rows: [
    { division: "Dhaka",      district: "Dhaka",     upazila: "Dhanmondi",  is_active: true },
    { division: "Dhaka",      district: "Dhaka",     upazila: "Mirpur",     is_active: true },
    { division: "Dhaka",      district: "Gazipur",   upazila: "Tongi",      is_active: true },
    { division: "Chittagong", district: "Chattogram", upazila: "Kotwali",   is_active: true },
  ],
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (): any => {
    const p: any = Promise.resolve({ data: rows, error: null });
    p.select = () => builder();
    p.eq = () => builder();
    p.order = () => builder();
    return p;
  };
  return { supabase: { from: () => builder() } };
});

import DivisionDistrictUpazilaPicker from "@/components/DivisionDistrictUpazilaPicker";

// -- Minimal harness that mirrors AdminAgentHub's submit disable predicate --
function CreateAgentHarness() {
  const [form, setForm] = useState({ phone: "", division: "", district: "", upazila: "" });
  const disabled = !form.phone || !form.division || !form.district || !form.upazila;
  return (
    <div>
      <label>
        Phone
        <input
          aria-label="Phone Number"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
      </label>
      <DivisionDistrictUpazilaPicker
        value={{ division: form.division || null, district: form.district || null, upazila: form.upazila || null }}
        onChange={(v) => setForm((f) => ({ ...f, division: v.division || "", district: v.district || "", upazila: v.upazila || "" }))}
        required
      />
      <button disabled={disabled}>Create Agent</button>
    </div>
  );
}

function EditAgentHarness() {
  const [form, setForm] = useState({ division: "Dhaka", district: "Dhaka", upazila: "Dhanmondi" });
  const disabled = !form.division || !form.district || !form.upazila;
  return (
    <div>
      <DivisionDistrictUpazilaPicker
        value={{ division: form.division || null, district: form.district || null, upazila: form.upazila || null }}
        onChange={(v) => setForm({ division: v.division || "", district: v.district || "", upazila: v.upazila || "" })}
        required
      />
      <button disabled={disabled}>Save Changes</button>
    </div>
  );
}

async function findSelect(label: RegExp) {
  return (await screen.findByLabelText(label)) as HTMLSelectElement;
}

describe("AdminAgentHub — Create Agent submit gating", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps Create disabled until phone + division + district + upazila are all set", async () => {
    render(<CreateAgentHarness />);
    const btn = screen.getByRole("button", { name: /create agent/i }) as HTMLButtonElement;

    // Initial: everything empty → disabled
    expect(btn).toBeDisabled();

    // Wait for picker to hydrate with divisions
    const division = await findSelect(/^Division$/i);
    await waitFor(() =>
      expect(Array.from(division.options).map((o) => o.value)).toContain("Dhaka"),
    );

    // Fill phone only → still disabled (no location)
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "01712345678" } });
    expect(btn).toBeDisabled();

    // Division only → still disabled
    fireEvent.change(division, { target: { value: "Dhaka" } });
    expect(btn).toBeDisabled();

    // District enabled and picked → still disabled (upazila missing)
    const district = await findSelect(/^District$/i);
    expect(district).not.toBeDisabled();
    fireEvent.change(district, { target: { value: "Dhaka" } });
    expect(btn).toBeDisabled();

    // Upazila enabled and picked → button becomes enabled
    const upazila = await findSelect(/Upazila/i);
    expect(upazila).not.toBeDisabled();
    fireEvent.change(upazila, { target: { value: "Dhanmondi" } });
    expect(btn).not.toBeDisabled();
  });

  it("re-disables Create when Division changes (district + upazila reset)", async () => {
    render(<CreateAgentHarness />);
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "01712345678" } });

    const division = await findSelect(/^Division$/i);
    await waitFor(() =>
      expect(Array.from(division.options).map((o) => o.value)).toContain("Dhaka"),
    );

    fireEvent.change(division, { target: { value: "Dhaka" } });
    fireEvent.change(await findSelect(/^District$/i), { target: { value: "Dhaka" } });
    fireEvent.change(await findSelect(/Upazila/i), { target: { value: "Dhanmondi" } });

    const btn = screen.getByRole("button", { name: /create agent/i }) as HTMLButtonElement;
    expect(btn).not.toBeDisabled();

    // Change division → district + upazila cleared → disabled again
    fireEvent.change(division, { target: { value: "Chittagong" } });
    expect(btn).toBeDisabled();

    // District dropdown reset (value empty), still needs picking
    const districtAfter = await findSelect(/^District$/i);
    expect(districtAfter.value).toBe("");
  });
});

describe("AdminAgentHub — Edit Agent submit gating", () => {
  it("Save is enabled with a fully populated location and disables when any field is cleared", async () => {
    render(<EditAgentHarness />);
    const btn = screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement;

    // Wait for hydration; initial values are complete
    await waitFor(() => expect(btn).not.toBeDisabled());

    // Clearing division cascades district + upazila to null → disabled
    const division = await findSelect(/^Division$/i);
    fireEvent.change(division, { target: { value: "" } });
    expect(btn).toBeDisabled();
  });
});
