import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";
import { bulkTransferDistributor, fetchDistributorsLite, DistributorLite } from "@/lib/distributorAdmin";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fromDistributorId: string;
  fromDistributorName: string;
  onDone?: () => void;
}

export default function BulkTransferDistributorDialog({ open, onOpenChange, fromDistributorId, fromDistributorName, onDone }: Props) {
  const [list, setList] = useState<DistributorLite[]>([]);
  const [toId, setToId] = useState<string>("");
  const [moveAgents, setMoveAgents] = useState(true);
  const [moveTerritories, setMoveTerritories] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToId(""); setMoveAgents(true); setMoveTerritories(true);
    fetchDistributorsLite().then(setList);
  }, [open]);

  const submit = async () => {
    if (!toId) { toast.error("Select target distributor"); return; }
    if (!moveAgents && !moveTerritories) { toast.error("Pick at least one thing to move"); return; }
    setSaving(true);
    try {
      const res = await bulkTransferDistributor(fromDistributorId, toId, { agents: moveAgents, territories: moveTerritories });
      toast.success(`Moved ${res.agentCount} agent(s) and ${res.territoryCount} territory code(s)`);
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Transfer failed");
    } finally { setSaving(false); }
  };

  const options = list.filter((d) => d.id !== fromDistributorId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk transfer</DialogTitle>
          <DialogDescription>
            Move everything from <strong>{fromDistributorName}</strong> to another distributor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Target distributor</Label>
            <select
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              <option value="">Select…</option>
              {options.map((d) => (
                <option key={d.id} value={d.id}>{d.business_name} {d.territory?.length ? `(${d.territory.join(", ")})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={moveAgents} onCheckedChange={(v) => setMoveAgents(!!v)} />
              Transfer all linked agents
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={moveTerritories} onCheckedChange={(v) => setMoveTerritories(!!v)} />
              Transfer all territories
            </label>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
            <span className="font-medium truncate">{fromDistributorName}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium truncate">{options.find((o) => o.id === toId)?.business_name || "—"}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !toId}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transferring</> : "Transfer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
