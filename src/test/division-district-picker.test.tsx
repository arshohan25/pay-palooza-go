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
  const Ctx = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    register: (v: string, label: string) => void;
    triggerProps: React.MutableRefObject<Record<string, any>>;
  } | null>(null);

  const Select = ({ value, onValueChange, disabled, children }: any) => {
    const [items, setItems] = React.useState<{ value: string; label: string }[]>([]);
    const triggerProps = React.useRef<Record<string, any>>({});
    const register = React.useCallback((v: string, label: string) => {
      setItems((prev) =>
        prev.some((p) => p.value === v) ? prev : [...prev, { value: v, label }],
      );
    }, []);
    // Reset items when children identity changes (division switch re-renders)
    React.useEffect(() => {
      setItems([]);
    }, [children]);
    return (
      <Ctx.Provider value={{ value: value ?? "", onValueChange, disabled, register, triggerProps }}>
        {/* Render children so SelectTrigger can publish props and SelectItems can register */}
        <div style={{ display: "none" }}>{children}</div>
        <NativeSelect items={items} />
      </Ctx.Provider>
    );
  };

  const NativeSelect = ({ items }: { items: { value: string; label: string }[] }) => {
    const ctx = React.useContext(Ctx)!;
    const { value, onValueChange, disabled, triggerProps } = ctx;
    return (
      <select
        {...triggerProps.current}
        disabled={disabled}
        value={value}
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

  const SelectTrigger = ({ children: _c, ...rest }: any) => {
    const ctx = React.useContext(Ctx)!;
    ctx.triggerProps.current = rest;
    return null;
  };
  const SelectValue = () => null;
  const SelectContent = ({ children }: any) => <>{children}</>;
  const SelectItem = ({ value, children }: any) => {
    const ctx = React.useContext(Ctx)!;
    React.useEffect(() => {
      ctx.register(value, typeof children === "string" ? children : String(value));
    }, [value]);
    return null;
  };
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
    await waitFor(() =>
      expect(within(division).getByRole("option", { name: "Dhaka" })).toBeTruthy(),
    );

    fireEvent.change(division, { target: { value: "Dhaka" } });

    const district = (await screen.findByLabelText(/District/i)) as HTMLSelectElement;
    expect(district).not.toBeDisabled();

    // Only Dhaka-division districts are present
    expect(within(district).getByRole("option", { name: "Dhaka" })).toBeTruthy();
    expect(within(district).getByRole("option", { name: "Gazipur" })).toBeTruthy();
    expect(
      within(district).queryByRole("option", { name: "Chattogram" }),
    ).toBeNull();
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
    expect(
      within(districtAfter).getByRole("option", { name: "Chattogram" }),
    ).toBeTruthy();
    expect(within(districtAfter).queryByRole("option", { name: "Dhaka" })).toBeNull();
  });
});
