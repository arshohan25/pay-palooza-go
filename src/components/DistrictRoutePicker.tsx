import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { districtCommandFilter } from "@/lib/districtCommandFilter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useI18n } from "@/lib/i18n";


export interface DistrictRoute {
  code: string;
  district: string;
  division: string;
}

interface Props {
  value: string;
  onChange: (code: string, row?: DistrictRoute) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

type FlatRow =
  | { kind: "header"; division: string; key: string }
  | { kind: "item"; row: DistrictRoute; key: string };

export default function DistrictRoutePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: Props) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("drpSelectDistrict");
  const [open, setOpen] = useState(false);

  const [rows, setRows] = useState<DistrictRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
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
      setRows((data as DistrictRoute[]) ?? []);
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

  const flat: FlatRow[] = useMemo(() => {
    const base = divisionFilter === "all" ? rows : rows.filter((r) => r.division === divisionFilter);
    const filtered = query
      ? base.filter(
          (r) =>
            districtCommandFilter(`${r.district} ${r.code} ${r.division}`, query) > 0,
        )
      : base;
    const byDiv = new Map<string, DistrictRoute[]>();
    for (const r of filtered) {
      if (!byDiv.has(r.division)) byDiv.set(r.division, []);
      byDiv.get(r.division)!.push(r);
    }
    const out: FlatRow[] = [];
    for (const [division, list] of Array.from(byDiv.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      out.push({ kind: "header", division, key: `h:${division}` });
      for (const r of list) out.push({ kind: "item", row: r, key: `i:${r.code}` });
    }
    return out;
  }, [rows, query, divisionFilter]);

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => (flat[i]?.kind === "header" ? 26 : 36),
    overscan: 20,
    getItemKey: (i) => flat[i]?.key ?? i,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 36,
  });

  const selected = rows.find((r) => r.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-xl h-11 font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin size={14} className="opacity-60" />
            {selected
              ? `${selected.district} · ${selected.code}`
              : loading
              ? t("drpLoadingDistricts")
              : resolvedPlaceholder}

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
            placeholder={t("drpSearchPh")}
            className="h-8 border-0 focus-visible:ring-0 shadow-none px-0"
          />
        </div>
        <div className="flex items-center gap-2 border-b px-3 py-1.5 bg-muted/30">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("drpDivision")}</span>
          <select
            aria-label={t("drpFilterByDivision")}
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="h-7 flex-1 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">{t("drpAllDivisions")}</option>

            {divisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div ref={setScrollEl} className="max-h-72 overflow-y-auto">
          {flat.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("drpNoDistrictFound")}
            </div>

          ) : (
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
            >
              {virtualizer.getVirtualItems().map((v) => {
                const item = flat[v.index];
                return (
                  <div
                    key={item.key}
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

                    {item.kind === "header" ? (
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {item.division}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onChange(item.row.code, item.row);
                          setOpen(false);
                        }}
                        className="flex w-full items-center px-2 py-2 text-sm hover:bg-accent rounded-sm"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === item.row.code ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex-1 text-left">{item.row.district}</span>
                        <span className="text-[10px] font-mono opacity-60">
                          {item.row.code}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
