import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { districtCommandFilter } from "@/lib/districtCommandFilter";
import { useVirtualizer } from "@tanstack/react-virtual";

interface Row {
  code: string;
  district: string;
  division: string;
}

interface Props {
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, render the Division select + District multi-select as two
   * stacked fields (dynamic cascade) instead of a single combobox. */
  showDivisionField?: boolean;
}

export default function DistrictMultiSelect({
  value,
  onChange,
  placeholder = "Select districts",
  disabled,
  className,
  showDivisionField = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<string>("");
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("wallet_route_codes")
        .select("code, district, division")
        .eq("is_active", true)
        .order("division", { ascending: true })
        .order("district", { ascending: true });
      if (!alive) return;
      setRows((data as Row[]) ?? []);
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

  // Auto-derive division from existing selections when the parent supplies
  // codes but no division has been chosen yet (edit flow).
  useEffect(() => {
    if (!showDivisionField || division || value.length === 0 || rows.length === 0) return;
    const first = rows.find((r) => value.includes(r.code));
    if (first) setDivision(first.division);
  }, [showDivisionField, division, value, rows]);

  const districtsForDivision = useMemo(() => {
    if (!showDivisionField) return rows;
    if (!division) return [];
    return rows.filter((r) => r.division === division);
  }, [rows, division, showDivisionField]);

  const filteredDistricts = useMemo(() => {
    if (!query) return districtsForDivision;
    return districtsForDivision.filter(
      (r) => districtCommandFilter(`${r.district} ${r.code} ${r.division}`, query) > 0,
    );
  }, [districtsForDivision, query]);

  const virtualizer = useVirtualizer({
    count: filteredDistricts.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 36,
    overscan: 20,
    getItemKey: (i) => filteredDistricts[i]?.code ?? i,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 36,
  });

  const selectedRows = rows.filter((r) => value.includes(r.code));

  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else onChange([...value, code]);
  };

  const districtDisabled = disabled || loading || (showDivisionField && !division);

  const handleDivisionChange = (next: string) => {
    setDivision(next);
    // Drop selections that don't belong to the newly-selected division.
    if (value.length > 0) {
      const keep = rows
        .filter((r) => r.division === next && value.includes(r.code))
        .map((r) => r.code);
      if (keep.length !== value.length) onChange(keep);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          showDivisionField
            ? "flex flex-col sm:flex-row sm:items-end gap-2"
            : "",
        )}
      >
        {showDivisionField && (
          <div className="space-y-1.5 sm:w-40 sm:shrink-0">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Division
            </Label>
            <Select
              value={division}
              onValueChange={handleDivisionChange}
              disabled={disabled || loading}
            >
              <SelectTrigger aria-label="Division" className="rounded-xl h-11">
                <SelectValue placeholder={loading ? "Loading…" : "Select division"} />
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
        )}

        <div className="space-y-1.5 flex-1 min-w-0">
          {showDivisionField && (
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Districts
            </Label>
          )}
          <Popover open={open} onOpenChange={(o) => !districtDisabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Districts"
            disabled={districtDisabled}
            className="w-full justify-between rounded-xl h-11 font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <MapPin size={14} className="opacity-60" />
              {value.length > 0
                ? `${value.length} district${value.length > 1 ? "s" : ""} selected`
                : loading
                ? "Loading districts…"
                : showDivisionField && !division
                ? "Select a division first"
                : placeholder}
            </span>
            <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search size={14} className="opacity-60" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search district or code…"
              className="h-8 border-0 focus-visible:ring-0 shadow-none px-0"
            />
          </div>
          <div ref={setScrollEl} className="max-h-72 overflow-y-auto">
            {filteredDistricts.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No district found.
              </div>
            ) : (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                  width: "100%",
                }}
              >
                {virtualizer.getVirtualItems().map((v) => {
                  const row = filteredDistricts[v.index];
                  return (
                    <div
                      key={row.code}
                      data-index={v.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${v.start}px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(row.code)}
                        className="flex w-full items-center px-2 py-2 text-sm hover:bg-accent rounded-sm"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value.includes(row.code) ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex-1 text-left">{row.district}</span>
                        <span className="text-[10px] font-mono opacity-60">
                          {row.code}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </PopoverContent>
        </Popover>
        </div>
      </div>



      {selectedRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedRows.map((r) => (
            <Badge key={r.code} variant="secondary" className="gap-1 pr-1 text-[11px]">
              {r.district} · {r.code}
              <button
                type="button"
                onClick={() => toggle(r.code)}
                className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
                aria-label={`Remove ${r.district}`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
