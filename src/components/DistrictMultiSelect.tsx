import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { districtCommandFilter } from "@/lib/districtCommandFilter";


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

/**
 * Multi-select district/route-code picker sourced from `wallet_route_codes`.
 * Emits an array of 2-letter codes.
 */
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

  const grouped = useMemo(() => {
    const byDiv = new Map<string, Row[]>();
    for (const r of rows) {
      if (!byDiv.has(r.division)) byDiv.set(r.division, []);
      byDiv.get(r.division)!.push(r);
    }
    return Array.from(byDiv.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

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
          <Command filter={districtCommandFilter}>
            <CommandInput placeholder="Search district, code, or division…" autoFocus />

            <CommandList className="max-h-72">
              <CommandEmpty>No district found.</CommandEmpty>
              {grouped.map(([division, list]) => (
                <CommandGroup key={division} heading={division}>
                  {list.map((r) => {
                    const checked = value.includes(r.code);
                    return (
                      <CommandItem
                        key={r.code}
                        value={`${r.district} ${r.code} ${r.division}`}
                        onSelect={() => toggle(r.code)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            checked ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex-1">{r.district}</span>
                        <span className="text-[10px] font-mono opacity-60">{r.code}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
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
