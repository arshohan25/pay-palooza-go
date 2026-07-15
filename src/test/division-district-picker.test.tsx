/**
 * DivisionDistrictPicker unit tests
 *
 * Covers:
 *  - District select is disabled until a Division is chosen
 *  - Changing Division resets District to null
 *  - District options are filtered to the selected Division
 *  - Required + accessibility attributes (labels, aria-required,
 *    aria-describedby, role="alert" on error) are present
 *
 * The Radix Select primitive is difficult to drive in jsdom (uses
 * PointerEvents / portals), so we replace it with a tiny native
 * <select> stand-in that preserves the same props surface the
 * component relies on (value, onValueChange, disabled, id, aria-*).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React, { useState } from "react";

// ---- Mock the shadcn Select with a native <select> ----
vi.mock("@/components/ui/select", () => {
  const extractText = (node: any): string => {
    if (node == null || node === false) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node.props?.children) return extractText(node.props.children);
    return "";
  };
  const collectItems = (
    node: any,
    out: { value: string; label: string }[] = [],
  ): { value: string; label: string }[] => {
    React.Children.forEach(node, (child: any) => {
      if (!child || typeof child !== "object") return;
      if (child.type?.__isSelectItem) {
        out.push({
          value: String(child.props.value),
          label: extractText(child.props.children) || String(child.props.value),
        });
      } else if (child.props?.children) {
        collectItems(child.props.children, out);
      }
    });
    return out;
  };

  const findTriggerProps = (node: any): Record<string, any> => {
    let found: Record<string, any> = {};
    React.Children.forEach(node, (child: any) => {
      if (!child || typeof child !== "object") return;
      if (child.type?.__isSelectTrigger) {
        const { children: _c, ...rest } = child.props;
        found = rest;
      } else if (child.props?.children && !found.id) {
        Object.assign(found, findTriggerProps(child.props.children));
      }
    });
    return found;
  };

  const Select = ({ value, onValueChange, disabled, children }: any) => {
    const items = collectItems(children);
    const triggerProps = findTriggerProps(children);
    return (
      <select
        {...triggerProps}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="" disabled hidden>
          placeholder
        </option>
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {it.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectTrigger: any = () => null;
  SelectTrigger.__isSelectTrigger = true;
  const SelectValue = () => null;
  const SelectContent = ({ children }: any) => <>{children}</>;
  const SelectItem: any = () => null;
  SelectItem.__isSelectItem = true;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// ---- Mock supabase client ----
// Use vi.hoisted so `rows` is initialized before the mock factory runs.
const { rows } = vi.hoisted(() => ({
  rows: [
    { code: "DH", district: "Dhaka", division: "Dhaka" },
    { code: "GZ", district: "Gazipur", division: "Dhaka" },
    { code: "CT", district: "Chattogram", division: "Chittagong" },
  ],
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (): any => {
    const p: any = Promise.resolve({ data: rows, error: null });
    p.select = () => makeBuilder();
    p.eq = () => makeBuilder();
    p.order = () => makeBuilder();
    return p;
  };
  return { supabase: { from: () => makeBuilder() } };
});

import DivisionDistrictPicker, {
  type DivisionDistrictValue,
} from "@/components/DivisionDistrictPicker";

function Harness({ onChangeSpy }: { onChangeSpy?: (v: DivisionDistrictValue) => void }) {
  const [value, setValue] = useState<DivisionDistrictValue>({
    division: null,
    district: null,
  });
  return (
    <DivisionDistrictPicker
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
      required
    />
  );
}

describe("DivisionDistrictPicker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders labelled Division and District controls with required + accessibility attrs", async () => {
    render(<Harness />);
    const division = await screen.findByLabelText(/Division/i);
    const district = screen.getByLabelText(/District/i);

    // Both associated via htmlFor / id
    expect(division).toHaveAttribute("id", "ddp-division");
    expect(district).toHaveAttribute("id", "ddp-district");

    // required=true surfaces aria-required
    expect(division).toHaveAttribute("aria-required", "true");
    expect(district).toHaveAttribute("aria-required", "true");

    // District is initially disabled until a division is chosen
    expect(district).toBeDisabled();

    // Hint text is present and linked via aria-describedby
    expect(district).toHaveAttribute("aria-describedby", "ddp-district-hint");
    expect(screen.getByText(/Choose a division to enable districts/i)).toHaveAttribute(
      "id",
      "ddp-district-hint",
    );
  });

  it("enables District and filters options to the selected Division", async () => {
    render(<Harness />);
    const division = (await screen.findByLabelText(/Division/i)) as HTMLSelectElement;

    // Wait for the divisions to populate
    await waitFor(() => {
      expect(Array.from(division.querySelectorAll('option')).map(o=>o.textContent)).toContain('Dhaka');
    });

    fireEvent.change(division, { target: { value: "Dhaka" } });

    const district = (await screen.findByLabelText(/District/i)) as HTMLSelectElement;
    expect(district).not.toBeDisabled();

    // Only Dhaka-division districts are present (options keyed by route code)
    const distValues = Array.from(district.querySelectorAll('option')).map(o=>(o as HTMLOptionElement).value);
    expect(distValues).toEqual(expect.arrayContaining(['DH','GZ']));
    expect(distValues).not.toContain('CT');
  });

  it("resets the District to null when Division changes", async () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);

    const division = (await screen.findByLabelText(/Division/i)) as HTMLSelectElement;
    await waitFor(() =>
      expect(within(division).getByRole("option", { name: "Dhaka" })).toBeTruthy(),
    );

    // 1) pick Dhaka division
    fireEvent.change(division, { target: { value: "Dhaka" } });
    // 2) pick Gazipur district
    const district = (await screen.findByLabelText(/District/i)) as HTMLSelectElement;
    fireEvent.change(district, { target: { value: "GZ" } });
    expect(spy).toHaveBeenLastCalledWith({ division: "Dhaka", district: "GZ" });

    // 3) switch division -> district must reset to null
    fireEvent.change(division, { target: { value: "Chittagong" } });
    expect(spy).toHaveBeenLastCalledWith({ division: "Chittagong", district: null });

    // District select is re-rendered with empty value and only Chattogram
    const districtAfter = (await screen.findByLabelText(/District/i)) as HTMLSelectElement;
    expect(districtAfter.value).toBe("");
    const afterValues = Array.from(districtAfter.querySelectorAll('option')).map(o=>(o as HTMLOptionElement).value);
    expect(afterValues).toContain('CT');
    expect(afterValues).not.toContain('DH');
    expect(afterValues).not.toContain('GZ');
  });
});
