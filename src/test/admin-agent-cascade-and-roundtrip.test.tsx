/**
 * End-to-end style tests for AdminAgentHub location handling.
 *
 * 1. Changing Division or District clears dependent selections and
 *    re-disables the submit button until everything is re-selected.
 * 2. Creating an Agent with Division/District/Upazila and then opening
 *    the Edit form shows the same saved values.
 *
 * The real DivisionDistrictUpazilaPicker is driven; supabase.from("upazilas")
 * is stubbed with a small in-memory dataset.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React, { useState } from "react";

const { rows } = vi.hoisted(() => ({
  rows: [
    { division: "Dhaka",      district: "Dhaka",      upazila: "Dhanmondi", is_active: true },
    { division: "Dhaka",      district: "Dhaka",      upazila: "Mirpur",    is_active: true },
    { division: "Dhaka",      district: "Gazipur",    upazila: "Tongi",     is_active: true },
    { division: "Chittagong", district: "Chattogram", upazila: "Kotwali",   is_active: true },
    { division: "Chittagong", district: "Chattogram", upazila: "Panchlaish",is_active: true },
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

interface AgentRecord {
  phone: string;
  division: string;
  district: string;
  upazila: string;
}

// Simulates the Create + Edit lifecycle in AdminAgentHub with the same
// disabled predicate as the real component.
function AgentLifecycleHarness() {
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({ phone: "", division: "", district: "", upazila: "" });
  const createDisabled =
    !form.phone || !form.division || !form.district || !form.upazila;

  const [editForm, setEditForm] = useState<AgentRecord>({
    phone: "", division: "", district: "", upazila: "",
  });
  const editDisabled =
    !editForm.division || !editForm.district || !editForm.upazila;

  return (
    <div>
      <section aria-label="create-section">
        <label>
          Phone
          <input
            aria-label="Phone Number"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </label>
        <DivisionDistrictUpazilaPicker
          value={{
            division: form.division || null,
            district: form.district || null,
            upazila: form.upazila || null,
          }}
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              division: v.division || "",
              district: v.district || "",
              upazila: v.upazila || "",
            }))
          }
          required
        />
        <button
          disabled={createDisabled}
          onClick={() => setAgent({ ...form } as AgentRecord)}
        >
          Create Agent
        </button>
      </section>

      {agent && (
        <section aria-label="created-agent">
          <div>Phone: <span data-testid="agent-phone">{agent.phone}</span></div>
          <div>Division: <span data-testid="agent-division">{agent.division}</span></div>
          <div>District: <span data-testid="agent-district">{agent.district}</span></div>
          <div>Upazila: <span data-testid="agent-upazila">{agent.upazila}</span></div>
          <button
            onClick={() => {
              setEditForm({ ...agent });
              setEditing(true);
            }}
          >
            Edit Agent
          </button>
        </section>
      )}

      {editing && (
        <section aria-label="edit-section">
          <DivisionDistrictUpazilaPicker
            value={{
              division: editForm.division || null,
              district: editForm.district || null,
              upazila: editForm.upazila || null,
            }}
            onChange={(v) =>
              setEditForm((f) => ({
                ...f,
                division: v.division || "",
                district: v.district || "",
                upazila: v.upazila || "",
              }))
            }
            required
          />
          <button disabled={editDisabled}>Save Changes</button>
        </section>
      )}
    </div>
  );
}

async function findSelectIn(container: HTMLElement, label: RegExp) {
  return (await within(container).findByLabelText(label)) as HTMLSelectElement;
}

describe("AdminAgentHub — cascade clears dependents and re-disables submit", () => {
  it("changing Division clears District + Upazila and disables Create", async () => {
    render(<AgentLifecycleHarness />);
    const createSection = screen.getByLabelText("create-section") as HTMLElement;

    fireEvent.change(within(createSection).getByLabelText(/Phone Number/i), {
      target: { value: "01712345678" },
    });

    const division = await findSelectIn(createSection, /^Division$/i);
    await waitFor(() =>
      expect(Array.from(division.options).map((o) => o.value)).toContain("Dhaka"),
    );

    fireEvent.change(division, { target: { value: "Dhaka" } });
    const district = await findSelectIn(createSection, /^District$/i);
    fireEvent.change(district, { target: { value: "Dhaka" } });
    const upazila = await findSelectIn(createSection, /Upazila/i);
    fireEvent.change(upazila, { target: { value: "Dhanmondi" } });

    const createBtn = within(createSection).getByRole("button", { name: /create agent/i }) as HTMLButtonElement;
    expect(createBtn).not.toBeDisabled();

    // Change Division → dependents cleared, button re-disabled
    fireEvent.change(division, { target: { value: "Chittagong" } });
    expect(createBtn).toBeDisabled();
    expect((await findSelectIn(createSection, /^District$/i)).value).toBe("");
    expect((await findSelectIn(createSection, /Upazila/i)).value).toBe("");

    // Re-pick district + upazila under new division → enabled again
    fireEvent.change(await findSelectIn(createSection, /^District$/i), { target: { value: "Chattogram" } });
    expect(createBtn).toBeDisabled();
    fireEvent.change(await findSelectIn(createSection, /Upazila/i), { target: { value: "Kotwali" } });
    expect(createBtn).not.toBeDisabled();
  });

  it("changing District clears Upazila and disables Create until re-picked", async () => {
    render(<AgentLifecycleHarness />);
    const createSection = screen.getByLabelText("create-section") as HTMLElement;

    fireEvent.change(within(createSection).getByLabelText(/Phone Number/i), {
      target: { value: "01712345678" },
    });
    const division = await findSelectIn(createSection, /^Division$/i);
    await waitFor(() =>
      expect(Array.from(division.options).map((o) => o.value)).toContain("Dhaka"),
    );
    fireEvent.change(division, { target: { value: "Dhaka" } });
    fireEvent.change(await findSelectIn(createSection, /^District$/i), { target: { value: "Dhaka" } });
    fireEvent.change(await findSelectIn(createSection, /Upazila/i), { target: { value: "Mirpur" } });

    const createBtn = within(createSection).getByRole("button", { name: /create agent/i }) as HTMLButtonElement;
    expect(createBtn).not.toBeDisabled();

    // Change District → Upazila cleared → disabled
    fireEvent.change(await findSelectIn(createSection, /^District$/i), { target: { value: "Gazipur" } });
    expect(createBtn).toBeDisabled();
    expect((await findSelectIn(createSection, /Upazila/i)).value).toBe("");

    // Re-pick upazila under new district → enabled again
    fireEvent.change(await findSelectIn(createSection, /Upazila/i), { target: { value: "Tongi" } });
    expect(createBtn).not.toBeDisabled();
  });
});

describe("AdminAgentHub — create → edit round-trip preserves location", () => {
  it("Edit form shows the same Division/District/Upazila that were saved on create", async () => {
    render(<AgentLifecycleHarness />);
    const createSection = screen.getByLabelText("create-section") as HTMLElement;

    fireEvent.change(within(createSection).getByLabelText(/Phone Number/i), {
      target: { value: "01898765432" },
    });
    const division = await findSelectIn(createSection, /^Division$/i);
    await waitFor(() =>
      expect(Array.from(division.options).map((o) => o.value)).toContain("Chittagong"),
    );
    fireEvent.change(division, { target: { value: "Chittagong" } });
    fireEvent.change(await findSelectIn(createSection, /^District$/i), { target: { value: "Chattogram" } });
    fireEvent.change(await findSelectIn(createSection, /Upazila/i), { target: { value: "Panchlaish" } });

    fireEvent.click(within(createSection).getByRole("button", { name: /create agent/i }));

    // Confirm the saved agent record surfaced
    expect(await screen.findByTestId("agent-division")).toHaveTextContent("Chittagong");
    expect(screen.getByTestId("agent-district")).toHaveTextContent("Chattogram");
    expect(screen.getByTestId("agent-upazila")).toHaveTextContent("Panchlaish");
    expect(screen.getByTestId("agent-phone")).toHaveTextContent("01898765432");

    // Open Edit form
    fireEvent.click(screen.getByRole("button", { name: /edit agent/i }));
    const editSection = screen.getByLabelText("edit-section") as HTMLElement;

    // Edit form must reflect the same saved values
    const editDivision = await findSelectIn(editSection, /^Division$/i);
    const editDistrict = await findSelectIn(editSection, /^District$/i);
    const editUpazila = await findSelectIn(editSection, /Upazila/i);

    await waitFor(() => expect(editDivision.value).toBe("Chittagong"));
    expect(editDistrict.value).toBe("Chattogram");
    expect(editUpazila.value).toBe("Panchlaish");

    // And the Save button is enabled because all three are populated
    const saveBtn = within(editSection).getByRole("button", { name: /save changes/i }) as HTMLButtonElement;
    expect(saveBtn).not.toBeDisabled();
  });
});
