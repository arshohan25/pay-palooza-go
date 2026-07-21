import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Row {
  code: string;
  district: string;
  division: string;
}

export interface DivisionDistrictValue {
  division: string | null;
  district: string | null; // route code
}

interface Props {
  value: DivisionDistrictValue;
  onChange: (next: DivisionDistrictValue) => void;
  disabled?: boolean;
  required?: boolean;
  idPrefix?: string;
}

/**
 * Hierarchical Division → District picker.
 * - District is disabled until a Division is chosen.
 * - Changing Division resets District to null.
 * - Accessible labels + aria-describedby error hookup.
 */
export default function DivisionDistrictPicker({
  value,
  onChange,
  disabled,
  required,
  idPrefix = "ddp",
}: Props) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const divisionId = `${idPrefix}-division`;
  const districtId = `${idPrefix}-district`;
  const errorId = `${idPrefix}-error`;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await (supabase as any)
        .from("wallet_route_codes")
        .select("code, district, division")
        .eq("is_active", true)
        .order("division", { ascending: true })
        .order("district", { ascending: true });
      if (!alive) return;
      if (err) {
        setError(t("ddpLoadError"));
        setRows([]);
      } else {
        setRows((data as Row[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const divisions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.division))).sort(),
    [rows],
  );

  const districtsForDivision = useMemo(
    () =>
      value.division
        ? rows
            .filter((r) => r.division === value.division)
            .sort((a, b) => a.district.localeCompare(b.district))
        : [],
    [rows, value.division],
  );

  const handleDivisionChange = (division: string) => {
    // Changing division always resets district to null
    onChange({ division, district: null });
  };

  const handleDistrictChange = (code: string) => {
    onChange({ ...value, district: code });
  };

  const districtDisabled = disabled || loading || !value.division;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={divisionId} className="text-xs font-semibold">
          {t("ddpDivision")}{required && <span className="text-destructive"> *</span>}
        </Label>
        <Select
          value={value.division ?? ""}
          onValueChange={handleDivisionChange}
          disabled={disabled || loading}
        >
          <SelectTrigger
            id={divisionId}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className="rounded-xl h-11"
          >
            <SelectValue
              placeholder={loading ? t("ddpLoadingDivisions") : t("ddpSelectDivision")}
            />
          </SelectTrigger>
          <SelectContent>
            {divisions.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={districtId} className="text-xs font-semibold">
          {t("ddpDistrict")}{required && <span className="text-destructive"> *</span>}
        </Label>
        <Select
          value={value.district ?? ""}
          onValueChange={handleDistrictChange}
          disabled={districtDisabled}
        >
          <SelectTrigger
            id={districtId}
            aria-required={required}
            aria-disabled={districtDisabled}
            aria-describedby={
              !value.division ? `${idPrefix}-district-hint` : undefined
            }
            className="rounded-xl h-11"
          >
            <SelectValue
              placeholder={
                !value.division
                  ? t("ddpSelectDivisionFirst")
                  : districtsForDivision.length === 0
                  ? t("ddpNoDistricts")
                  : t("ddpSelectDistrict")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {districtsForDivision.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.district}
                <span className="ml-2 text-[10px] font-mono opacity-60">
                  {r.code}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!value.division && (
          <p
            id={`${idPrefix}-district-hint`}
            className="text-[10px] text-muted-foreground"
          >
            {t("ddpDistrictHint")}
          </p>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-[11px] text-destructive"
        >
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
