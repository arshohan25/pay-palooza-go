import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AreaType } from "./DivisionDistrictUpazilaPicker";

export interface UnionOption {
  name: string;
  type: AreaType;
  /** Optional Bangla name coming from the DB (unions.name_bn). */
  nameBn?: string | null;
}

interface Props {
  options: UnionOption[];
  value: string | null;
  areaType: AreaType | null;
  onSelect: (name: string, type: AreaType) => void;
  disabled?: boolean;
  placeholder: string;
  labels: {
    tUnion: string;
    tPowrashava: string;
    tCity: string;
    search?: string;
    empty?: string;
    loading?: string;
  };
  className?: string;
  /**
   * Optional formatter for displaying option names. Receives the English name
   * plus the full option so callers can prefer a DB-provided Bangla label.
   */
  displayName?: (name: string, option?: UnionOption) => string;
  /** True while parent is still fetching options. */
  loading?: boolean;
}

type FlatRow =
  | { kind: "header"; group: string; key: string }
  | { kind: "item"; option: UnionOption; key: string };

const groupOrder: AreaType[] = ["city_corporation", "powrashava", "union"];

export default function UnionSearchSelect({
  options,
  value,
  areaType,
  onSelect,
  disabled,
  placeholder,
  labels,
  className,
  displayName,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const groupLabel = (t: AreaType) =>
    t === "city_corporation" ? labels.tCity : t === "powrashava" ? labels.tPowrashava : labels.tUnion;

  const nameFor = (n: string) => (displayName ? displayName(n) : n);

  const flat: FlatRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? options.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            nameFor(o.name).toLowerCase().includes(q) ||
            groupLabel(o.type).toLowerCase().includes(q),
        )
      : options;
    const byGroup = new Map<AreaType, UnionOption[]>();
    for (const o of filtered) {
      if (!byGroup.has(o.type)) byGroup.set(o.type, []);
      byGroup.get(o.type)!.push(o);
    }
    const out: FlatRow[] = [];
    for (const g of groupOrder) {
      const list = byGroup.get(g);
      if (!list || list.length === 0) continue;
      list.sort((a, b) => a.name.localeCompare(b.name));
      out.push({ kind: "header", group: groupLabel(g), key: `h:${g}` });
      for (const o of list) out.push({ kind: "item", option: o, key: `i:${g}:${o.name}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, labels.tCity, labels.tPowrashava, labels.tUnion]);

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => (flat[i]?.kind === "header" ? 26 : 36),
    overscan: 15,
    getItemKey: (i) => flat[i]?.key ?? i,
  });

  const display = value
    ? `${nameFor(value)}${areaType ? ` · ${groupLabel(areaType)}` : ""}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between rounded-md h-9 font-normal text-sm", className)}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin size={13} className="opacity-60 shrink-0" />
            <span className="truncate">{display}</span>
          </span>
          <ChevronsUpDown size={13} className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          // Ensure the popover has enough room to actually scroll a long list
          // even when Radix's collision detection would otherwise shrink it
          // to just a handful of visible rows inside a Sheet.
          maxHeight:
            "var(--radix-popover-content-available-height, min(70vh, 420px))",
          minHeight: "260px",
        }}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search size={14} className="opacity-60" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.search ?? "Search…"}
            className="h-8 border-0 focus-visible:ring-0 shadow-none px-0"
          />
        </div>
        <div
          ref={setScrollEl}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: "touch",
            maxHeight:
              "calc(var(--radix-popover-content-available-height, min(70vh, 420px)) - 44px)",
            minHeight: "216px",
          }}
        >


          {loading ? (
            <div
              data-testid="union-loading"
              role="status"
              aria-live="polite"
              className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{labels.loading ?? "Loading…"}</span>
            </div>
          ) : flat.length === 0 ? (
            <div
              data-testid="union-empty"
              role="status"
              className="flex flex-col items-center justify-center gap-1 py-10 px-4 text-center"
            >
              <MapPin className="h-5 w-5 opacity-40" />
              <p className="text-sm font-medium text-foreground">
                {labels.empty ?? "No results"}
              </p>
              {query.trim() && (
                <p className="text-xs text-muted-foreground">"{query}"</p>
              )}
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
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
                      height: v.size,
                      transform: `translateY(${v.start}px)`,
                    }}
                  >
                    {item.kind === "header" ? (
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                        {item.group}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(item.option.name, item.option.type);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="flex w-full items-center px-2 py-2 text-sm hover:bg-accent rounded-sm"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            value === item.option.name && areaType === item.option.type
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span className="flex-1 text-left truncate">{nameFor(item.option.name)}</span>
                        <span className="text-[10px] opacity-60 ml-2">{groupLabel(item.option.type)}</span>
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
