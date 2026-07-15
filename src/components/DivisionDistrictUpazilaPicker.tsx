import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface DivisionDistrictUpazilaValue {
  division: string | null;
  district: string | null;
  upazila: string | null;
}

interface Props {
  value: DivisionDistrictUpazilaValue;
  onChange: (v: DivisionDistrictUpazilaValue) => void;
  disabled?: boolean;
  required?: boolean;
  showLabels?: boolean;
  className?: string;
}

interface Row { division: string; district: string; upazila: string }

// Simple in-memory cache so repeat opens don't refetch.
let cache: Row[] | null = null;
let cachePromise: Promise<Row[]> | null = null;

async function loadUpazilas(): Promise<Row[]> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const { data, error } = await supabase
      .from("upazilas")
      .select("division, district, upazila")
      .eq("is_active", true)
      .order("division")
      .order("district")
      .order("upazila");
    if (error) throw error;
    cache = (data as Row[]) || [];
    return cache;
  })();
  return cachePromise;
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
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadUpazilas()
      .then((r) => alive && (setRows(r), setLoading(false)))
      .catch((e) => alive && (setError(e.message || "Failed to load areas"), setLoading(false)));
    return () => { alive = false; };
  }, []);

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
        ? Array.from(
            new Set(
              rows
                .filter((r) => r.division === value.division && r.district === value.district)
                .map((r) => r.upazila),
            ),
          ).sort()
        : [],
    [rows, value.division, value.district],
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
          onChange={(e) => {
            const d = e.target.value || null;
            onChange({ division: d, district: null, upazila: null });
          }}
          aria-label="Division"
          aria-required={required}
        >
          <option value="">{loading ? "Loading…" : "Select division"}</option>
          {divisions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        {showLabels && <Label className="text-xs mb-1 block">District{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled || !value.division}
          value={value.district ?? ""}
          onChange={(e) => {
            const d = e.target.value || null;
            onChange({ ...value, district: d, upazila: null });
          }}
          aria-label="District"
          aria-required={required}
        >
          <option value="">{value.division ? "Select district" : "Choose division first"}</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        {showLabels && <Label className="text-xs mb-1 block">Upazila / Thana{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled || !value.district}
          value={value.upazila ?? ""}
          onChange={(e) => onChange({ ...value, upazila: e.target.value || null })}
          aria-label="Upazila or Thana"
          aria-required={required}
        >
          <option value="">{value.district ? "Select upazila / thana" : "Choose district first"}</option>
          {upazilas.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading areas…
        </div>
      )}
      {error && (
        <div className="text-xs text-destructive" role="alert">{error}</div>
      )}
    </div>
  );
}
