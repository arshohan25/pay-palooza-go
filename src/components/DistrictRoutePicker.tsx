import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DistrictRoute {
  code: string;     // 2-letter route code, e.g. "DH"
  district: string; // e.g. "Dhaka"
  division: string; // e.g. "Dhaka"
}

interface Props {
  value: string;                        // selected 2-letter code, "" for none
  onChange: (code: string, row?: DistrictRoute) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Bangladesh district → 2-letter wallet route code picker.
 *
 * Backed by `wallet_route_codes` (the same table the DB validator uses), so
 * agent/merchant wallet IDs generated from the selected code will always pass
 * `validate_wallet_id_format`.
 */
export default function DistrictRoutePicker({
  value,
  onChange,
  placeholder = "Select district",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DistrictRoute[]>([]);
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
      setRows((data as DistrictRoute[]) ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const byDiv = new Map<string, DistrictRoute[]>();
    for (const r of rows) {
      if (!byDiv.has(r.division)) byDiv.set(r.division, []);
      byDiv.get(r.division)!.push(r);
    }
    return Array.from(byDiv.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

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
              ? "Loading districts…"
              : placeholder}
          </span>
          <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search district or code…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No district found.</CommandEmpty>
            {grouped.map(([division, list]) => (
              <CommandGroup key={division} heading={division}>
                {list.map((r) => (
                  <CommandItem
                    key={r.code}
                    value={`${r.district} ${r.code} ${r.division}`}
                    onSelect={() => {
                      onChange(r.code, r);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === r.code ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{r.district}</span>
                    <span className="text-[10px] font-mono opacity-60">{r.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
