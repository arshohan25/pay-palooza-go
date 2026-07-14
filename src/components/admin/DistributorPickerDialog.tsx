import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Building2 } from "lucide-react";
import { fetchDistributorsLite, DistributorLite } from "@/lib/distributorAdmin";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  /** Distributor IDs to hide (e.g. current owner). */
  excludeIds?: string[];
  /** Allow "Unassigned" option. */
  allowUnassign?: boolean;
  onPick: (distributorId: string | null, name: string) => void | Promise<void>;
}

export default function DistributorPickerDialog({
  open, onOpenChange, title = "Select Distributor", description, excludeIds = [], allowUnassign, onPick,
}: Props) {
  const [list, setList] = useState<DistributorLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchDistributorsLite().then((d) => { setList(d); setLoading(false); });
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((d) =>
      !excludeIds.includes(d.id) &&
      (!q || d.business_name.toLowerCase().includes(q) || (d.territory ?? []).some((t) => t.toLowerCase().includes(q)))
    );
  }, [list, search, excludeIds]);

  const pick = async (id: string | null, name: string) => {
    setSaving(id ?? "__unassign__");
    try {
      await onPick(id, name);
      onOpenChange(false);
    } finally { setSaving(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or territory" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <ScrollArea className="max-h-[350px] pr-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-1">
              {allowUnassign && (
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-muted/60 text-left disabled:opacity-50"
                  disabled={saving !== null}
                  onClick={() => pick(null, "Unassigned")}
                >
                  <span className="text-sm font-medium text-foreground">— Unassigned —</span>
                  {saving === "__unassign__" && <Loader2 className="w-4 h-4 animate-spin" />}
                </button>
              )}
              {filtered.length === 0 && !loading && (
                <p className="text-center text-xs text-muted-foreground py-6">No distributors found</p>
              )}
              {filtered.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-muted/60 text-left disabled:opacity-50"
                  disabled={saving !== null}
                  onClick={() => pick(d.id, d.business_name)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium text-foreground truncate">{d.business_name}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{d.status}</Badge>
                    </div>
                    {d.territory && d.territory.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{d.territory.join(", ")}</p>
                    )}
                  </div>
                  {saving === d.id && <Loader2 className="w-4 h-4 animate-spin" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
