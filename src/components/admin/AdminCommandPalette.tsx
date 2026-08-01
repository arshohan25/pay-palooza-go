import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt, Store, User, Package } from "lucide-react";

export interface PaletteNavItem {
  id: string;
  label: string;
  icon: any;
  group: string;
}

interface EntityHit {
  kind: "user" | "merchant" | "transaction" | "order";
  id: string;
  title: string;
  subtitle: string;
  tab: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: PaletteNavItem[];
  onNavigate: (tabId: string) => void;
  /** Called with an entity hit so the dashboard can jump + prefill search. */
  onEntity?: (hit: EntityHit) => void;
}

const KIND_ICON = {
  user: User,
  merchant: Store,
  transaction: Receipt,
  order: Package,
} as const;

/**
 * Cmd/Ctrl+K palette: jump to any admin tab, or search users, merchants,
 * transactions and orders from a single box.
 */
const AdminCommandPalette = ({ open, onOpenChange, navItems, onNavigate, onEntity }: Props) => {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [searching, setSearching] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearching(false);
      return;
    }
    const reqId = ++reqRef.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const [profilesRes, merchantsRes, txnRes, ordersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, name, phone")
          .or(`name.ilike.${like},phone.ilike.${like}`)
          .not("phone", "like", "staff-%")
          .limit(5),
        supabase
          .from("merchants")
          .select("id, business_name, phone")
          .or(`business_name.ilike.${like},phone.ilike.${like}`)
          .limit(5),
        supabase
          .from("transactions")
          .select("id, short_id, type, amount, status, recipient_phone")
          .or(`short_id.ilike.${like},reference.ilike.${like},recipient_phone.ilike.${like}`)
          .limit(5),
        supabase
          .from("orders")
          .select("id, order_num, status, total_amount")
          .ilike("order_num", like)
          .limit(5),
      ]);


      if (reqId !== reqRef.current) return;

      const next: EntityHit[] = [
        ...(profilesRes.data ?? []).map((p: any) => ({
          kind: "user" as const,
          id: p.user_id,
          title: p.name || "Unnamed user",
          subtitle: p.phone || "",
          tab: "users",
        })),
        ...(merchantsRes.data ?? []).map((m: any) => ({
          kind: "merchant" as const,
          id: m.id,
          title: m.business_name || "Merchant",
          subtitle: m.phone || "",
          tab: "merchants",
        })),
        ...(txnRes.data ?? []).map((t: any) => ({
          kind: "transaction" as const,
          id: t.id,
          title: `৳${Number(t.amount ?? 0).toLocaleString()} · ${t.type}`,
          subtitle: `${t.status} · ${t.id.slice(0, 8)}`,
          tab: "transactions",
        })),
        ...(ordersRes.data ?? []).map((o: any) => ({
          kind: "order" as const,
          id: o.id,
          title: o.order_number || o.id.slice(0, 8),
          subtitle: `${o.status} · ৳${Number(o.total_amount ?? 0).toLocaleString()}`,
          tab: "orders",
        })),
      ];
      setHits(next);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const groupedNav = useMemo(() => {
    const map = new Map<string, PaletteNavItem[]>();
    navItems.forEach((item) => {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    });
    return [...map.entries()];
  }, [navItems]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search tabs, users, merchants, transactions, orders…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60svh]">
        <CommandEmpty>
          {searching ? (
            <span className="inline-flex items-center gap-2 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </span>
          ) : (
            "No results found."
          )}
        </CommandEmpty>

        {hits.length > 0 && (
          <>
            <CommandGroup heading="Records">
              {hits.map((hit) => {
                const Icon = KIND_ICON[hit.kind];
                return (
                  <CommandItem
                    key={`${hit.kind}-${hit.id}`}
                    value={`${hit.kind} ${hit.title} ${hit.subtitle} ${hit.id}`}
                    onSelect={() => {
                      onEntity?.(hit);
                      onNavigate(hit.tab);
                      onOpenChange(false);
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{hit.title}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] capitalize">{hit.kind}</Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {groupedNav.map(([groupLabel, items]) => (
          <CommandGroup key={groupLabel} heading={groupLabel}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${groupLabel} ${item.label} ${item.id}`}
                onSelect={() => {
                  onNavigate(item.id);
                  onOpenChange(false);
                }}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

export default AdminCommandPalette;
