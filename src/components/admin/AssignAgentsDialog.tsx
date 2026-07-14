import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { bulkAssignAgents } from "@/lib/distributorAdmin";
import { toast } from "sonner";

interface AgentRow { id: string; business_name: string | null; distributor_id: string | null; status: string; phone?: string | null; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetDistributorId: string;
  targetDistributorName: string;
  onDone?: () => void;
}

export default function AssignAgentsDialog({ open, onOpenChange, targetDistributorId, targetDistributorName, onDone }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("agents").select("id, business_name, distributor_id, status, user_id").neq("distributor_id", targetDistributorId).order("business_name");
      const rows = (data ?? []) as any[];
      const ids = rows.map((a) => a.user_id);
      let phoneMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, phone").in("user_id", ids);
        phoneMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.phone]));
      }
      setAgents(rows.map((r) => ({ ...r, phone: phoneMap[r.user_id] })));
      setLoading(false);
    })();
  }, [open, targetDistributorId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) =>
      (!showOnlyUnassigned || !a.distributor_id) &&
      (!q || (a.business_name ?? "").toLowerCase().includes(q) || (a.phone ?? "").includes(q))
    );
  }, [agents, search, showOnlyUnassigned]);

  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const res = await bulkAssignAgents(Array.from(selected), targetDistributorId);
      toast.success(`Assigned ${res.succeeded} agent(s) to ${targetDistributorName}`);
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to assign");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign agents to {targetDistributorName}</DialogTitle>
          <DialogDescription>Pick one or more agents to link under this distributor.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Checkbox checked={showOnlyUnassigned} onCheckedChange={(v) => setShowOnlyUnassigned(!!v)} />
            Unassigned only
          </label>
        </div>
        <ScrollArea className="max-h-[350px] pr-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">No agents found</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((a) => (
                <label key={a.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 cursor-pointer">
                  <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{a.business_name || a.id.slice(0, 8)}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{a.status}</Badge>
                      {a.distributor_id && a.distributor_id !== targetDistributorId && (
                        <Badge variant="secondary" className="text-[10px]">reassign</Badge>
                      )}
                    </div>
                    {a.phone && <p className="text-[11px] text-muted-foreground">{a.phone}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving || selected.size === 0}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning</> : `Assign ${selected.size || ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
