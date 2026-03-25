import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Gift, Search, RefreshCw, Eye, Plus, Pencil, Trash2, Copy } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  redeemed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  expired: "bg-muted text-muted-foreground",
};

const STATUSES = ["all", "active", "redeemed", "expired"] as const;

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "gift_card", entity_id: entityId, details });
  }
}

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 16; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function AdminGiftCardManagement() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detail, setDetail] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ brand: "", denomination: "", recipient_phone: "" });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ brand: "", denomination: "", count: "5" });
  const [editDialog, setEditDialog] = useState<{ card: any; brand: string; denomination: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("gift_cards").select("*").order("created_at", { ascending: false }).limit(300);
    setCards(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = cards.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.code?.toLowerCase().includes(search.toLowerCase()) && !c.brand?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: cards.length,
    active: cards.filter(c => c.status === "active").length,
    redeemed: cards.filter(c => c.status === "redeemed").length,
    totalValue: cards.reduce((s, c) => s + Number(c.denomination), 0),
  };

  const revokeCard = async (id: string) => {
    const card = cards.find(c => c.id === id);
    const { error } = await supabase.from("gift_cards").update({ status: "expired" as any }).eq("id", id);
    if (!error) await auditLog("gift_card_revoke", id, { brand: card?.brand, denomination: card?.denomination });
    if (error) { toast.error(error.message); return; }
    toast.success("Gift card revoked");
    setDetail(null);
    fetchData();
  };

  const handleCreate = async () => {
    const { brand, denomination, recipient_phone } = createForm;
    if (!brand || !denomination) { toast.error("Brand and denomination required"); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data: created, error } = await supabase.from("gift_cards").insert({
      brand, denomination: Number(denomination), recipient_phone: recipient_phone || null, code: generateCode(), purchaser_id: session?.user?.id ?? "",
    }).select().single();
    if (!error && created) await auditLog("gift_card_issue", created.id, { brand, denomination, recipient_phone });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Gift card issued");
    setCreateOpen(false);
    setCreateForm({ brand: "", denomination: "", recipient_phone: "" });
    fetchData();
  };

  const handleBulkGenerate = async () => {
    const { brand, denomination, count } = bulkForm;
    if (!brand || !denomination) { toast.error("Brand and denomination required"); return; }
    const n = Math.min(Number(count) || 1, 50);
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const rows = Array.from({ length: n }, () => ({
      brand, denomination: Number(denomination), code: generateCode(), purchaser_id: session?.user?.id ?? "",
    }));
    const { error } = await supabase.from("gift_cards").insert(rows);
    if (!error) await auditLog("gift_card_bulk_generate", "bulk", { brand, denomination, count: n });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${n} gift cards generated`);
    setBulkOpen(false);
    setBulkForm({ brand: "", denomination: "", count: "5" });
    fetchData();
  };

  const handleEdit = async () => {
    if (!editDialog) return;
    const { card, brand, denomination } = editDialog;
    setSaving(true);
    const { error } = await supabase.from("gift_cards").update({ brand, denomination: Number(denomination) }).eq("id", card.id);
    if (!error) await auditLog("gift_card_edit", card.id, { previous: { brand: card.brand, denomination: card.denomination }, new: { brand, denomination } });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Card updated");
    setEditDialog(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const { error } = await supabase.from("gift_cards").delete().eq("id", deleteTarget.id);
    if (!error) await auditLog("gift_card_delete", deleteTarget.id, { brand: deleteTarget.brand, denomination: deleteTarget.denomination, status: deleteTarget.status });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Gift card deleted");
    setDeleteTarget(null);
    fetchData();
  };

  const maskCode = (code: string) => code ? code.slice(0, 4) + "****" + code.slice(-4) : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Cards", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Redeemed", value: stats.redeemed },
          { label: "Total Value", value: `৳${stats.totalValue.toLocaleString()}` },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by code or brand..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5">
          {STATUSES.map(s => (
            <button key={s} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Issue Card</Button>
        <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}><Copy className="w-4 h-4 mr-1" /> Bulk Generate</Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4" /> Gift Cards</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Code</TableHead>
                  <TableHead className="text-xs">Brand</TableHead>
                  <TableHead className="text-xs">Denomination</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Purchaser</TableHead>
                  <TableHead className="text-xs">Recipient</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No gift cards found</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-mono">{maskCode(c.code)}</TableCell>
                    <TableCell className="text-xs font-semibold">{c.brand}</TableCell>
                    <TableCell className="text-xs">৳{Number(c.denomination).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[c.status] ?? ""}`}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{c.purchaser_id?.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs">{c.recipient_phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setDetail(c)}><Eye className="w-3 h-3" /></Button>
                        {c.status === "active" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setEditDialog({ card: c, brand: c.brand, denomination: String(c.denomination) })}><Pencil className="w-3 h-3" /></Button>
                            <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => revokeCard(c.id)}>Revoke</Button>
                          </>
                        )}
                        {["expired", "redeemed"].includes(c.status) && (
                          <Button size="sm" variant="ghost" className="h-6 px-1 text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="w-3 h-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Gift Card Details</SheetTitle>
            <SheetDescription>Full card information</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="space-y-3 mt-4 text-sm">
              <div><span className="text-muted-foreground">Code:</span> <span className="font-mono font-bold">{detail.code}</span></div>
              <div><span className="text-muted-foreground">Brand:</span> {detail.brand}</div>
              <div><span className="text-muted-foreground">Denomination:</span> ৳{Number(detail.denomination).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant="secondary" className={STATUS_BADGE[detail.status] ?? ""}>{detail.status}</Badge></div>
              <div><span className="text-muted-foreground">Purchaser:</span> <span className="font-mono text-xs">{detail.purchaser_id}</span></div>
              <div><span className="text-muted-foreground">Recipient:</span> {detail.recipient_phone || "—"}</div>
              <div><span className="text-muted-foreground">Created:</span> {new Date(detail.created_at).toLocaleString()}</div>
              {detail.redeemed_at && <div><span className="text-muted-foreground">Redeemed:</span> {new Date(detail.redeemed_at).toLocaleString()}</div>}
              {detail.redeemed_by && <div><span className="text-muted-foreground">Redeemed By:</span> <span className="font-mono text-xs">{detail.redeemed_by}</span></div>}
              {detail.status === "active" && (
                <Button variant="destructive" size="sm" onClick={() => revokeCard(detail.id)} className="mt-2">Revoke Card</Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Issue card dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Gift Card</DialogTitle>
            <DialogDescription>Create a new gift card</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Brand name" value={createForm.brand} onChange={e => setCreateForm(f => ({ ...f, brand: e.target.value }))} />
            <Input placeholder="Denomination (৳)" type="number" value={createForm.denomination} onChange={e => setCreateForm(f => ({ ...f, denomination: e.target.value }))} />
            <Input placeholder="Recipient phone (optional)" value={createForm.recipient_phone} onChange={e => setCreateForm(f => ({ ...f, recipient_phone: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Issuing…" : "Issue Card"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk generate dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Generate Gift Cards</DialogTitle>
            <DialogDescription>Generate multiple cards at once (max 50)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Brand name" value={bulkForm.brand} onChange={e => setBulkForm(f => ({ ...f, brand: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Denomination (৳)" type="number" value={bulkForm.denomination} onChange={e => setBulkForm(f => ({ ...f, denomination: e.target.value }))} />
              <Input placeholder="Count" type="number" value={bulkForm.count} onChange={e => setBulkForm(f => ({ ...f, count: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkGenerate} disabled={saving}>{saving ? "Generating…" : "Generate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={v => !v && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Gift Card</DialogTitle>
            <DialogDescription>Update brand and denomination</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Brand" value={editDialog?.brand ?? ""} onChange={e => editDialog && setEditDialog({ ...editDialog, brand: e.target.value })} />
            <Input placeholder="Denomination (৳)" type="number" value={editDialog?.denomination ?? ""} onChange={e => editDialog && setEditDialog({ ...editDialog, denomination: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gift Card</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete this {deleteTarget?.brand} gift card (৳{Number(deleteTarget?.denomination).toLocaleString()})? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{saving ? "Deleting…" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
