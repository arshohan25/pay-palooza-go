import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const L = {
  en: {
    division: "Division", district: "District", upazila: "Upazila / Thana",
    union: "Union Parishad / Powrashava / City Corp.",
    selDivision: "Select division", selDistrict: "Select district",
    selUpazila: "Select upazila / thana", selUnion: "Select union / powrashava",
    chooseDivision: "Choose division first", chooseDistrict: "Choose district first",
    chooseUpazila: "Choose upazila first", pickType: "Pick a type first",
    loading: "Loading…", loadingAreas: "Loading areas…",
    type: "Type", tUnion: "Union", tPowrashava: "Powrashava", tCity: "City Corp.",
    typeUnion: "Type union name", typePowrashava: "Type powrashava name", typeCity: "Type city corporation name",
    noPreload: "No entries pre-loaded for this type — type the name manually.",
    search: "Search union / powrashava / city corp…", empty: "No match",
    failed: "Failed to load areas",
  },
  bn: {
    division: "বিভাগ", district: "জেলা", upazila: "উপজেলা / থানা",
    union: "ইউনিয়ন পরিষদ / পৌরসভা / সিটি কর্পোরেশন",
    selDivision: "বিভাগ নির্বাচন করুন", selDistrict: "জেলা নির্বাচন করুন",
    selUpazila: "উপজেলা / থানা নির্বাচন করুন", selUnion: "ইউনিয়ন / পৌরসভা নির্বাচন করুন",
    chooseDivision: "আগে বিভাগ নির্বাচন করুন", chooseDistrict: "আগে জেলা নির্বাচন করুন",
    chooseUpazila: "আগে উপজেলা নির্বাচন করুন", pickType: "আগে ধরন নির্বাচন করুন",
    loading: "লোড হচ্ছে…", loadingAreas: "এলাকা লোড হচ্ছে…",
    type: "ধরন", tUnion: "ইউনিয়ন", tPowrashava: "পৌরসভা", tCity: "সিটি কর্প.",
    typeUnion: "ইউনিয়নের নাম লিখুন", typePowrashava: "পৌরসভার নাম লিখুন", typeCity: "সিটি কর্পোরেশনের নাম লিখুন",
    noPreload: "এই ধরনের জন্য কোনো তালিকা নেই — নাম টাইপ করুন।",
    search: "ইউনিয়ন / পৌরসভা / সিটি কর্প. খুঁজুন…", empty: "কোনো ফলাফল নেই",
    failed: "এলাকা লোড করা যায়নি",
  },
} as const;

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
  const { lang } = useI18n();
  const l = L[lang === "bn" ? "bn" : "en"];
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
      .catch((e) => alive && (setError(e.message || l.failed), setLoading(false)));
    return () => { alive = false; };
  }, [includeUnion]);

  // Base lists from dataset
  const baseDivisions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.division))).sort(),
    [rows],
  );
  const baseDistricts = useMemo(
    () =>
      value.division
        ? Array.from(new Set(rows.filter((r) => r.division === value.division).map((r) => r.district))).sort()
        : [],
    [rows, value.division],
  );
  const baseUpazilas = useMemo(
    () =>
      value.division && value.district
        ? Array.from(new Set(
            rows.filter((r) => r.division === value.division && r.district === value.district).map((r) => r.upazila),
          )).sort()
        : [],
    [rows, value.division, value.district],
  );

  // Merge in prefilled values that aren't in the loaded dataset so the
  // dropdown never silently drops an existing selection (legacy data, seed gap,
  // or dataset still loading).
  const withFallback = (list: string[], current: string | null) =>
    current && !list.includes(current) ? [current, ...list] : list;
  const divisions = useMemo(() => withFallback(baseDivisions, value.division), [baseDivisions, value.division]);
  const districts = useMemo(() => withFallback(baseDistricts, value.district), [baseDistricts, value.district]);
  const upazilas = useMemo(() => withFallback(baseUpazilas, value.upazila), [baseUpazilas, value.upazila]);

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
        {showLabels && <Label className="text-xs mb-1 block">{l.division}{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled}
          value={value.division ?? ""}
          onChange={(e) => onChange({ division: e.target.value || null, district: null, upazila: null, union_parishad: null, area_type: null })}
          aria-label={l.division}
          aria-required={required}
        >
          <option value="">{loading ? l.loading : l.selDivision}</option>
          {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        {showLabels && <Label className="text-xs mb-1 block">{l.district}{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled || !value.division}
          value={value.district ?? ""}
          onChange={(e) => onChange({ ...value, district: e.target.value || null, upazila: null, union_parishad: null, area_type: null })}
          aria-label={l.district}
          aria-required={required}
        >
          <option value="">{value.division ? l.selDistrict : l.chooseDivision}</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        {showLabels && <Label className="text-xs mb-1 block">{l.upazila}{required && " *"}</Label>}
        <select
          className={selectClass}
          disabled={baseDisabled || !value.district}
          value={value.upazila ?? ""}
          onChange={(e) => onChange({ ...value, upazila: e.target.value || null, union_parishad: null, area_type: null })}
          aria-label={l.upazila}
          aria-required={required}
        >
          <option value="">{value.district ? l.selUpazila : l.chooseDistrict}</option>
          {upazilas.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {includeUnion && (() => {
        const filteredUnions = value.area_type
          ? unionsForUpazila.filter((u) => u.type === value.area_type)
          : unionsForUpazila;
        // If the current union_parishad isn't in the loaded list, still surface a
        // dropdown so the prefill isn't lost — inject a synthetic option.
        const currentInList = value.union_parishad
          ? filteredUnions.some((u) => u.name === value.union_parishad)
          : true;
        const optionUnions = !currentInList && value.union_parishad
          ? [{ division: value.division!, district: value.district!, upazila: value.upazila!, name: value.union_parishad, type: (value.area_type ?? "union") as AreaType }, ...filteredUnions]
          : filteredUnions;
        const hasPreloaded = optionUnions.length > 0;
        return (
        <div>
          {showLabels && (
            <Label className="text-xs mb-1 block">
              {l.union}{required && " *"}
            </Label>
          )}
          <div className="grid grid-cols-3 gap-2">
            <select
              className={selectClass + " col-span-1"}
              disabled={baseDisabled || !value.upazila}
              value={value.area_type ?? ""}
              onChange={(e) => onChange({ ...value, area_type: (e.target.value || null) as AreaType | null, union_parishad: null })}
              aria-label={l.type}
              aria-required={required}
            >
              <option value="">{l.type}</option>
              <option value="union">{l.tUnion}</option>
              <option value="powrashava">{l.tPowrashava}</option>
              <option value="city_corporation">{l.tCity}</option>
            </select>
            {hasPreloaded ? (
              <select
                className={selectClass + " col-span-2"}
                disabled={baseDisabled || !value.upazila}
                value={value.union_parishad ?? ""}
                onChange={(e) => {
                  const name = e.target.value || null;
                  const match = optionUnions.find((u) => u.name === name);
                  onChange({
                    ...value,
                    union_parishad: name,
                    area_type: match ? match.type : value.area_type ?? null,
                  });
                }}
                aria-label={l.union}
                aria-required={required}
              >
                <option value="">{l.selUnion}</option>
                {optionUnions.map((u) => (
                  <option key={`${u.type}-${u.name}`} value={u.name}>
                    {u.name}
                    {!value.area_type && ` (${u.type === "powrashava" ? l.tPowrashava : u.type === "city_corporation" ? l.tCity : l.tUnion})`}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                className="col-span-2 h-9"
                disabled={baseDisabled || !value.upazila || !value.area_type}
                value={value.union_parishad ?? ""}
                onChange={(e) => onChange({ ...value, union_parishad: e.target.value || null })}
                placeholder={
                  !value.upazila ? l.chooseUpazila
                  : !value.area_type ? l.pickType
                  : value.area_type === "powrashava" ? l.typePowrashava
                  : value.area_type === "city_corporation" ? l.typeCity
                  : l.typeUnion
                }
                maxLength={80}
                aria-label={l.union}
                aria-required={required}
              />
            )}
          </div>
          {value.upazila && value.area_type && !hasPreloaded && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {l.noPreload}
            </p>
          )}
        </div>
        );
      })()}


      {loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> {l.loadingAreas}
        </div>
      )}
      {error && <div className="text-xs text-destructive" role="alert">{error}</div>}
    </div>
  );
}
