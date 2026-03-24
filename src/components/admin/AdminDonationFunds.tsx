import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RefreshCw, Heart, Plus, Pencil, Trash2, ArrowDownToLine } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface CauseFund {
  id: string;
  cause_name: string;
  cause_icon: string | null;
  balance: number;
  total_raised: number;
  donor_count: number;
  updated_at: string;
}

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "donation_cause_fund", entity_id: entityId, details });
  }
}

export default function AdminDonationFunds() {
  const [funds, setFunds] = useState<CauseFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ cause_name: "", cause_icon: "❤️", balance: "0" });
  const [editRow, setEditRow] = useState<{ fund: CauseFund; cause_name: string; cause_icon: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CauseFund | null>(null);
  const [disburseTarget, setDisburseTarget] = useState<CauseFund | null>(null);
  const [disburseForm, setDisburseForm] = useState({ amount: "", reason: "" });

  const fetchFunds = async () => {
    setLoading(true);
    const { data } = await supabase.from("donation_cause_funds").select("*").order("total_raised", { ascending: false });
    setFunds((data as CauseFund[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchFunds(); }, []);

  const grandTotal = funds.reduce((s, f) => s + Number(f.total_raised), 0);
  const totalBalance = funds.reduce((s, f) => s + Number(f.balance), 0);
  const totalDonors = funds.reduce((s, f) => s + f.donor_count, 0);

  const handleCreate = async () => {
    const { cause_name, cause_icon, balance } = createForm;
    if (!cause_name.trim()) { toast.error("Cause name required"); return; }
    setSaving(true);
    const { data: created, error } = await supabase.from("donation_cause_funds").insert({ cause_name: cause_name.trim(), cause_icon, balance: Number(balance) || 0 }).select().single();
    if (!error && created) await auditLog("donation_cause_create", created.id, { cause_name, cause_icon });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cause created");
    setCreateOpen(false);
    setCreateForm({ cause_name: "", cause_icon: "❤️", balance: "0" });
    fetchFunds();
  };

  const handleEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    const { fund, cause_name, cause_icon } = editRow;
    const { error } = await supabase.from("donation_cause_funds").update({ cause_name, cause_icon }).eq("id", fund.id);
    if (!error) await auditLog("donation_cause_edit", fund.id, { previous: { cause_name: fund.cause_name, cause_icon: fund.cause_icon }, new: { cause_name, cause_icon } });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cause updated");
    setEditRow(null);
    fetchFunds();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (Number(deleteTarget.balance) > 0) { toast.error("Cannot delete cause with remaining balance. Disburse first."); setDeleteTarget(null); return; }
    setSaving(true);
    const { error } = await supabase.from("donation_cause_funds").delete().eq("id", deleteTarget.id);
    if (!error) await auditLog("donation_cause_delete", deleteTarget.id, { cause_name: deleteTarget.cause_name });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cause deleted");
    setDeleteTarget(null);
    fetchFunds();
  };

  const handleDisburse = async () => {
    if (!disburseTarget) return;
    const amount = Number(disburseForm.amount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (amount > Number(disburseTarget.balance)) { toast.error("Amount exceeds available balance"); return; }
    if (!disburseForm.reason.trim()) { toast.error("Reason is required"); return; }
    setSaving(true);
    const newBalance = Number(disburseTarget.balance) - amount;
    const { error } = await supabase.from("donation_cause_funds").update({ balance: newBalance }).eq("id", disburseTarget.id);
    if (!error) await auditLog("donation_cause_disburse", disburseTarget.id, { cause_name: disburseTarget.cause_name, amount, previous_balance: disburseTarget.balance, new_balance: newBalance, reason: disburseForm.reason.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`৳${amount.toLocaleString()} disbursed from ${disburseTarget.cause_name}`);
    setDisburseTarget(null);
    setDisburseForm({ amount: "", reason: "" });
    fetchFunds();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Heart size={18} className="text-primary" /> Donation Cause Funds
        </h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Cause</Button>
          <Button variant="outline" size="sm" onClick={fetchFunds} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-xs text-muted-foreground">Total Raised</p><p className="text-lg font-bold text-foreground">৳{grandTotal.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-xs text-muted-foreground">Unallocated</p><p className="text-lg font-bold text-foreground">৳{totalBalance.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-xs text-muted-foreground">Total Donations</p><p className="text-lg font-bold text-foreground">{totalDonors.toLocaleString()}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : funds.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No donations yet. Cause funds will appear here after the first donation.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cause</TableHead>
                  <TableHead className="text-right">Total Raised</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Donations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funds.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium"><span className="mr-1.5">{f.cause_icon}</span>{f.cause_name}</TableCell>
                    <TableCell className="text-right font-semibold">৳{Number(f.total_raised).toLocaleString()}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary" className="font-mono">৳{Number(f.balance).toLocaleString()}</Badge></TableCell>
                    <TableCell className="text-right">{f.donor_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setEditRow({ fund: f, cause_name: f.cause_name, cause_icon: f.cause_icon || "❤️" })}><Pencil className="w-3 h-3" /></Button>
                        {Number(f.balance) > 0 && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setDisburseTarget(f); setDisburseForm({ amount: "", reason: "" }); }}><ArrowDownToLine className="w-3 h-3 mr-1" /> Disburse</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 px-1 text-destructive" onClick={() => setDeleteTarget(f)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create cause dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Donation Cause</DialogTitle><DialogDescription>Add a new cause for donations</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Cause name" value={createForm.cause_name} onChange={e => setCreateForm(f => ({ ...f, cause_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Icon emoji" value={createForm.cause_icon} onChange={e => setCreateForm(f => ({ ...f, cause_icon: e.target.value }))} />
              <Input placeholder="Initial balance (৳)" type="number" value={createForm.balance} onChange={e => setCreateForm(f => ({ ...f, balance: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit cause dialog */}
      <Dialog open={!!editRow} onOpenChange={v => !v && setEditRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Cause</DialogTitle><DialogDescription>Update cause name and icon</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Cause name" value={editRow?.cause_name ?? ""} onChange={e => editRow && setEditRow({ ...editRow, cause_name: e.target.value })} />
            <Input placeholder="Icon emoji" value={editRow?.cause_icon ?? ""} onChange={e => editRow && setEditRow({ ...editRow, cause_icon: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse dialog */}
      <Dialog open={!!disburseTarget} onOpenChange={v => !v && setDisburseTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disburse Funds</DialogTitle><DialogDescription>Withdraw from "{disburseTarget?.cause_name}" (available: ৳{Number(disburseTarget?.balance).toLocaleString()})</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Amount (৳)" type="number" value={disburseForm.amount} onChange={e => setDisburseForm(f => ({ ...f, amount: e.target.value }))} />
            <Input placeholder="Reason (required)" value={disburseForm.reason} onChange={e => setDisburseForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisburseTarget(null)}>Cancel</Button>
            <Button onClick={handleDisburse} disabled={saving}>{saving ? "Processing…" : "Disburse"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cause</AlertDialogTitle>
            <AlertDialogDescription>
              {Number(deleteTarget?.balance) > 0
                ? `Cannot delete "${deleteTarget?.cause_name}" — it has ৳${Number(deleteTarget?.balance).toLocaleString()} remaining. Disburse first.`
                : `Permanently delete "${deleteTarget?.cause_name}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {Number(deleteTarget?.balance) === 0 && (
              <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{saving ? "Deleting…" : "Delete"}</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
