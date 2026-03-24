import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Star, Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "cashback_rule", entity_id: entityId, details
    });
  }
}

export default function AdminLoyaltyPoints() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", txn_type: "send", points: "1", min_amount: "0", is_active: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ phone: "", points: "0", reason: "", action: "add" as "add" | "deduct" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cashback_rules").select("*").eq("cashback_type", "loyalty").order("created_at", { ascending: false });
    setRules(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", txn_type: "send", points: "1", min_amount: "0", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ name: r.name, txn_type: r.txn_type, points: String(r.cashback_value), min_amount: String(r.min_amount ?? 0), is_active: r.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name || `Loyalty: ${form.txn_type}`,
      txn_type: form.txn_type,
      cashback_type: "loyalty",
      cashback_value: parseFloat(form.points) || 0,
      min_amount: parseFloat(form.min_amount) || 0,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("cashback_rules").update(payload).eq("id", editing.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Loyalty rule updated");
      await auditLog("loyalty_rule_update", editing.id, { previous: { name: editing.name, cashback_value: editing.cashback_value }, updated: payload });
    } else {
      const { data, error } = await supabase.from("cashback_rules").insert(payload).select("id").single();
      if (error) { toast.error("Failed to create"); return; }
      toast.success("Loyalty rule created");
      await auditLog("loyalty_rule_create", data.id, payload);
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const rule = rules.find(r => r.id === deleteId);
    const { error } = await supabase.from("cashback_rules").delete().eq("id", deleteId);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Loyalty rule deleted");
    await auditLog("loyalty_rule_delete", deleteId, { deleted_rule: rule?.name });
    setDeleteId(null);
    load();
  };

  const handleAdjust = async () => {
    const pts = parseInt(adjustForm.points);
    if (!adjustForm.phone.trim() || !pts || pts <= 0 || !adjustForm.reason.trim()) {
      toast.error("Phone, points, and reason are required");
      return;
    }
    // This is a manual adjustment - log it as audit
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: `loyalty_points_${adjustForm.action}`,
      entity_type: "loyalty_adjustment",
      entity_id: adjustForm.phone,
      details: { phone: adjustForm.phone, points: pts, action: adjustForm.action, reason: adjustForm.reason }
    });
    toast.success(`${adjustForm.action === "add" ? "Added" : "Deducted"} ${pts} points for ${adjustForm.phone} (logged)`);
    setAdjustOpen(false);
    setAdjustForm({ phone: "", points: "0", reason: "", action: "add" });
  };

  const totalActive = rules.filter(r => r.is_active).length;
  const TXN_TYPES = ["send", "cashout", "cashin", "payment", "recharge", "paybill", "addmoney", "banktransfer"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Loyalty Points</p>
          <p className="text-xs text-muted-foreground">Reward users with points for transactions</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}><UserPlus className="w-4 h-4 mr-1" /> Adjust</Button>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Rule</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Rules</p><p className="text-lg font-bold text-foreground">{rules.length}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Active</p><p className="text-lg font-bold text-emerald-600">{totalActive}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Name</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Points</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
              </tr></thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{r.name}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px] capitalize">{r.txn_type}</Badge></td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-amber-600">{r.cashback_value} pts</td>
                    <td className="px-3 py-2.5"><Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">{r.is_active ? "Active" : "Off"}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && rules.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No loyalty rules — add one to start rewarding users</div>}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Loyalty Rule" : "Add Loyalty Rule"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Rule Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Send Money Points" /></div>
            <div>
              <Label>Transaction Type</Label>
              <Select value={form.txn_type} onValueChange={v => setForm(f => ({ ...f, txn_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TXN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Points per Transaction</Label><Input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))} /></div>
            <div><Label>Min Amount (৳)</Label><Input type="number" value={form.min_amount} onChange={e => setForm(f => ({ ...f, min_amount: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Active</Label></div>
            <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"} Rule</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loyalty Rule?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The rule will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manual Point Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>User Phone</Label><Input value={adjustForm.phone} onChange={e => setAdjustForm(f => ({ ...f, phone: e.target.value }))} placeholder="01XXXXXXXXX" /></div>
            <div>
              <Label>Action</Label>
              <Select value={adjustForm.action} onValueChange={(v: "add" | "deduct") => setAdjustForm(f => ({ ...f, action: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Points</SelectItem>
                  <SelectItem value="deduct">Deduct Points</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Points</Label><Input type="number" value={adjustForm.points} onChange={e => setAdjustForm(f => ({ ...f, points: e.target.value }))} /></div>
            <div><Label>Reason</Label><Textarea value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for adjustment..." rows={2} /></div>
            <Button className="w-full" onClick={handleAdjust}>Submit Adjustment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
