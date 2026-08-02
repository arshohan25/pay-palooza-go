import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Multiplier {
  id: string;
  name: string;
  txn_type: string | null;
  multiplier: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

const TXN_TYPES = ["all", "send", "payment", "cashout", "paybill"] as const;

const toLocalInput = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";

export default function AdminLoyaltyCampaigns() {
  const [rows, setRows] = useState<Multiplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Multiplier | null>(null);
  const [form, setForm] = useState({
    name: "",
    txn_type: "all",
    multiplier: "2",
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: "",
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loyalty_point_multipliers" as any)
      .select("*")
      .order("starts_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, multiplier: Number(r.multiplier) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      txn_type: "all",
      multiplier: "2",
      starts_at: toLocalInput(new Date().toISOString()),
      ends_at: "",
      is_active: true,
    });
    setOpen(true);
  };

  const openEdit = (r: Multiplier) => {
    setEditing(r);
    setForm({
      name: r.name,
      txn_type: r.txn_type ?? "all",
      multiplier: String(r.multiplier),
      starts_at: toLocalInput(r.starts_at),
      ends_at: toLocalInput(r.ends_at),
      is_active: r.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    const mult = Number(form.multiplier);
    if (!form.name.trim()) return toast.error("Campaign name is required");
    if (!Number.isFinite(mult) || mult < 1 || mult > 5)
      return toast.error("Multiplier must be between 1 and 5");
    if (form.ends_at && form.starts_at && new Date(form.ends_at) <= new Date(form.starts_at))
      return toast.error("End time must be after the start time");

    const payload = {
      name: form.name.trim(),
      txn_type: form.txn_type === "all" ? null : form.txn_type,
      multiplier: mult,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
    };

    const { error } = editing
      ? await supabase.from("loyalty_point_multipliers" as any).update(payload).eq("id", editing.id)
      : await supabase.from("loyalty_point_multipliers" as any).insert(payload as any);

    if (error) return toast.error(error.message);
    toast.success(editing ? "Campaign updated" : "Campaign created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("loyalty_point_multipliers" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campaign removed");
    load();
  };

  const toggle = async (r: Multiplier) => {
    const { error } = await supabase
      .from("loyalty_point_multipliers" as any)
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const isLive = (r: Multiplier) =>
    r.is_active &&
    new Date(r.starts_at) <= new Date() &&
    (!r.ends_at || new Date(r.ends_at) > new Date());

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Points campaigns</CardTitle>
            <p className="text-xs text-muted-foreground">
              Temporary earn multipliers. The highest active multiplier applies; base tier rates stay untouched.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> New campaign
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{r.name}</span>
                  <Badge variant="secondary">×{r.multiplier}</Badge>
                  <Badge variant="outline">{r.txn_type ?? "all flows"}</Badge>
                  {isLive(r) && <Badge className="bg-emerald-500/15 text-emerald-500">Live</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(r.starts_at).toLocaleString()} →{" "}
                  {r.ends_at ? new Date(r.ends_at).toLocaleString() : "no end date"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Eid double points"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Flow</Label>
                <Select value={form.txn_type} onValueChange={(v) => setForm({ ...form, txn_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TXN_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t === "all" ? "All flows" : t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Multiplier (1–5)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  max="5"
                  value={form.multiplier}
                  onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Ends (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <Label className="mb-0">Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
