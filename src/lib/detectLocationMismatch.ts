import { supabase } from "@/integrations/supabase/client";

export type LocationMismatchField =
  | "division"
  | "district"
  | "upazila"
  | "union_parishad";

export interface LocationMismatch {
  field: LocationMismatchField;
  message: string;
}

/**
 * Given a validator error thrown by the DB (or when the client wants to
 * pre-validate), probe `validate_location_hierarchy` to pinpoint the exact
 * field that fails so the UI can highlight it and tell the user how to fix it.
 */
export async function detectLocationMismatch(loc: {
  division: string | null;
  district: string | null;
  upazila: string | null;
  union_parishad?: string | null;
  area_type?: string | null;
}): Promise<LocationMismatch | null> {
  const probe = async (
    d: string | null,
    dist: string | null,
    up: string | null,
    un: string | null,
    ty: string | null,
  ): Promise<boolean> => {
    const { data } = await (supabase as any).rpc("validate_location_hierarchy", {
      _division: d,
      _district: dist,
      _upazila: up,
      _union_parishad: un,
      _area_type: ty,
    });
    return data === true;
  };

  // Missing fields are obvious — bail early.
  if (!loc.division)
    return { field: "division", message: "Select a Division." };
  if (!loc.district)
    return { field: "district", message: "Select a District." };
  if (!loc.upazila)
    return { field: "upazila", message: "Select an Upazila / Thana." };

  // Division → District → Upazila triple valid?
  if (!(await probe(loc.division, loc.district, loc.upazila, null, null))) {
    return {
      field: "upazila",
      message: `"${loc.upazila}" is not a valid Upazila/Thana under ${loc.district}, ${loc.division}. Re-pick from the Upazila dropdown.`,
    };
  }

  // Union / Powrashava / City Corp check (only when supplied)
  if (loc.union_parishad && loc.area_type) {
    if (
      !(await probe(
        loc.division,
        loc.district,
        loc.upazila,
        loc.union_parishad,
        loc.area_type,
      ))
    ) {
      const typeLabel =
        loc.area_type === "powrashava"
          ? "Powrashava"
          : loc.area_type === "city_corporation"
            ? "City Corporation"
            : "Union";
      return {
        field: "union_parishad",
        message: `"${loc.union_parishad}" (${typeLabel}) doesn't belong to ${loc.upazila}. Pick a valid ${typeLabel} from the dropdown.`,
      };
    }
  }

  return null;
}
