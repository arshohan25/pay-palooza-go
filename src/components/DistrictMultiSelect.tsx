import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
}

type FlatRow =
  | { kind: "header"; division: string; key: string }
  | { kind: "item"; row: Row; key: string };

export default function DistrictMultiSelect({
  value,
  onChange,
  placeholder = "Select districts",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
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

  const flat: FlatRow[] = useMemo(() => {
    const filtered = query
      ? rows.filter(
          (r) =>
            districtCommandFilter(`${r.district} ${r.code} ${r.division}`, query) > 0,
        )
      : rows;
    const byDiv = new Map<string, Row[]>();
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
  }, [rows, query]);

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => (flat[i]?.kind === "header" ? 24 : 36),
    overscan: 8,
  });

  const selectedRows = rows.filter((r) => value.includes(r.code));

  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else onChange([...value, code]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between rounded-xl h-11 font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <MapPin size={14} className="opacity-60" />
              {value.length > 0
                ? `${value.length} district${value.length > 1 ? "s" : ""} selected`
                : loading
                ? "Loading districts…"
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
              placeholder="Search district, code, or division…"
              className="h-8 border-0 focus-visible:ring-0 shadow-none px-0"
            />
          </div>
          <div ref={setScrollEl} className="max-h-72 overflow-y-auto">
            {flat.length === 0 ? (
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
                  const item = flat[v.index];
                  return (
                    <div
                      key={item.key}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${v.start}px)`,
                        height: v.size,
                      }}
                    >
                      {item.kind === "header" ? (
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.division}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(item.row.code)}
                          className="flex w-full items-center px-2 py-2 text-sm hover:bg-accent rounded-sm"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value.includes(item.row.code) ? "opacity-100" : "opacity-0",
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
