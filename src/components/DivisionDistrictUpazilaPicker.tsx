import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export type AreaType = "union" | "powrashava" | "city_corporation";

export interface DivisionDistrictUpazilaValue {
  division: string | null;
  district: string | null;
  upazila: string | null;
  union_parishad?: string | null;
  area_type?: AreaType | null;
}

interface Props {
  value: DivisionDistrictUpazilaValue;
  onChange: (v: DivisionDistrictUpazilaValue) => void;
  disabled?: boolean;
  required?: boolean;
  showLabels?: boolean;
  className?: string;
  /** Show Union Parishad / Powrashava level (defaults to true). */
  includeUnion?: boolean;
}

interface UpazilaRow { division: string; district: string; upazila: string }
interface UnionRow { division: string; district: string; upazila: string; name: string; type: AreaType }

// Simple in-memory caches so repeat opens don't refetch.
let upazilaCache: UpazilaRow[] | null = null;
let upazilaPromise: Promise<UpazilaRow[]> | null = null;
let unionCache: UnionRow[] | null = null;
let unionPromise: Promise<UnionRow[]> | null = null;

async function loadUpazilas(): Promise<UpazilaRow[]> {
  if (upazilaCache) return upazilaCache;
  if (upazilaPromise) return upazilaPromise;
  upazilaPromise = (async () => {
    const { data, error } = await supabase
      .from("upazilas")
      .select("division, district, upazila")
      .eq("is_active", true)
      .order("division").order("district").order("upazila");
    if (error) throw error;
    upazilaCache = (data as UpazilaRow[]) || [];
    return upazilaCache;
  })();
  return upazilaPromise;
}

async function loadUnions(): Promise<UnionRow[]> {
  if (unionCache) return unionCache;
  if (unionPromise) return unionPromise;
  unionPromise = (async () => {
    const { data, error } = await (supabase as any)
      .from("unions")
      .select("division, district, upazila, name, type")
      .eq("is_active", true)
      .order("name");
    if (error) { unionCache = []; return unionCache; }
    unionCache = (data as UnionRow[]) || [];
    return unionCache;
  })();
  return unionPromise;
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function DivisionDistrictUpazilaPicker({
  value,
  onChange,
  disabled,
  required,
  showLabels = true,
  className,
  includeUnion = true,
}: Props) {
  const [rows, setRows] = useState<UpazilaRow[]>([]);
  const [unions, setUnions] = useState<UnionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadUpazilas(), includeUnion ? loadUnions() : Promise.resolve([])])
      .then(([u, un]) => {
        if (!alive) return;
        setRows(u);
        setUnions(un as UnionRow[]);
        setLoading(false);
      })
      .catch((e) => alive && (setError(e.message || "Failed to load areas"), setLoading(false)));
    return () => { alive = false; };
  }, [includeUnion]);

  const divisions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.division))).sort(),
    [rows],
  );
  const districts = useMemo(
    () =>
      value.division
        ? Array.from(new Set(rows.filter((r) => r.division === value.division).map((r) => r.district))).sort()
        : [],
    [rows, value.division],
  );
  const upazilas = useMemo(
    () =>
      value.division && value.district
        ? Array.from(new Set(
            rows.filter((r) => r.division === value.division && r.district === value.district).map((r) => r.upazila),
          )).sort()
        : [],
    [rows, value.division, value.district],
  );
  const unionsForUpazila = useMemo(
    () =>
      value.division && value.district && value.upazila
        ? unions.filter(
            (u) =>
              u.division === value.division &&
              u.district === value.district &&
              u.upazila === value.upazila,
          )
        : [],
    [unions, value.division, value.district, value.upazila],
  );

  const baseDisabled = disabled || loading || !!error;

  return (
    <div className={className ?? "grid grid-cols-1 gap-3"}>
      <div>
        {showLabels && <Label className="text-xs mb-1 block">Division{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled}
          value={value.division ?? ""}
          onChange={(e) => onChange({ division: e.target.value || null, district: null, upazila: null, union_parishad: null, area_type: null })}
          aria-label="Division"
          aria-required={required}
        >
          <option value="">{loading ? "Loading…" : "Select division"}</option>
          {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        {showLabels && <Label className="text-xs mb-1 block">District{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled || !value.division}
          value={value.district ?? ""}
          onChange={(e) => onChange({ ...value, district: e.target.value || null, upazila: null, union_parishad: null, area_type: null })}
          aria-label="District"
          aria-required={required}
        >
          <option value="">{value.division ? "Select district" : "Choose division first"}</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        {showLabels && <Label className="text-xs mb-1 block">Upazila / Thana{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled || !value.district}
          value={value.upazila ?? ""}
          onChange={(e) => onChange({ ...value, upazila: e.target.value || null, union_parishad: null, area_type: null })}
          aria-label="Upazila or Thana"
          aria-required={required}
        >
          <option value="">{value.district ? "Select upazila / thana" : "Choose district first"}</option>
          {upazilas.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {includeUnion && (
        <div>
          {showLabels && (
            <Label className="text-xs mb-1 block">
              Union Parishad / Powrashava{required && " *"}
            </Label>
          )}
          <div className="grid grid-cols-3 gap-2">
            <select
              className={selectClass + " col-span-1"}
              disabled={baseDisabled || !value.upazila}
              value={value.area_type ?? ""}
              onChange={(e) => onChange({ ...value, area_type: (e.target.value || null) as AreaType | null })}
              aria-label="Area type"
              aria-required={required}
            >
              <option value="">Type</option>
              <option value="union">Union</option>
              <option value="powrashava">Powrashava</option>
              <option value="city_corporation">City Corp.</option>
            </select>
            {unionsForUpazila.length > 0 ? (
              <select
                className={selectClass + " col-span-2"}
                disabled={baseDisabled || !value.upazila}
                value={value.union_parishad ?? ""}
                onChange={(e) => {
                  const name = e.target.value || null;
                  const match = unionsForUpazila.find((u) => u.name === name);
                  onChange({
                    ...value,
                    union_parishad: name,
                    area_type: match ? match.type : value.area_type ?? null,
                  });
                }}
                aria-label="Union Parishad or Powrashava"
                aria-required={required}
              >
                <option value="">Select union / powrashava</option>
                {unionsForUpazila.map((u) => (
                  <option key={u.name} value={u.name}>
                    {u.name} ({u.type === "powrashava" ? "Powrashava" : u.type === "city_corporation" ? "City Corp." : "Union"})
                  </option>
                ))}
                <option value="">— Type manually below —</option>
              </select>
            ) : (
              <Input
                className="col-span-2 h-9"
                disabled={baseDisabled || !value.upazila}
                value={value.union_parishad ?? ""}
                onChange={(e) => onChange({ ...value, union_parishad: e.target.value || null })}
                placeholder={value.upazila ? "Type union / powrashava name" : "Choose upazila first"}
                maxLength={80}
                aria-label="Union Parishad or Powrashava name"
                aria-required={required}
              />
            )}
          </div>
          {value.upazila && unionsForUpazila.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              No unions pre-loaded for this upazila — type the name manually.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading areas…
        </div>
      )}
      {error && <div className="text-xs text-destructive" role="alert">{error}</div>}
    </div>
  );
}
