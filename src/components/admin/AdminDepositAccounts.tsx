import { useState } from "react";
import { useDepositAccounts, DepositAccount } from "@/hooks/use-deposit-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Landmark, Wallet } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const METHODS = [
  { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" },
  { id: "rocket", label: "Rocket" },
  { id: "upay", label: "Upay" },
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "card", label: "Card / Other" },
];

const emptyForm = { method: "bkash", label: "", account_number: "", account_name: "", bank_name: "", instructions: "", sort_order: 0 };

export default function AdminDepositAccounts() {
  const { accounts, loading, upsert, remove, toggleActive } = useDepositAccounts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepositAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a: DepositAccount) => {
    setEditing(a);
    setForm({ method: a.method, label: a.label, account_number: a.account_number, account_name: a.account_name ?? "", bank_name: a.bank_name ?? "", instructions: a.instructions ?? "", sort_order: a.sort_order });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.account_number.trim()) return;
    setSaving(true);
    try {
      await upsert({ ...(editing ? { id: editing.id } : {}), ...form });
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Deposit Accounts</h3>
          <p className="text-xs text-muted-foreground">Numbers/accounts shown to users when adding money</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add Account</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deposit accounts configured yet. Users won't see any destination numbers.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Number / Account</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{METHODS.find(m => m.id === a.method)?.label ?? a.method}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{a.label}</TableCell>
                  <TableCell className="font-mono text-sm text-foreground">{a.account_number}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{a.account_name ?? "—"}</TableCell>
                  <TableCell>
                    <Switch checked={a.is_active} onCheckedChange={(v) => toggleActive(a.id, v)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil size={14} /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}><Trash2 size={14} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} Deposit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Method</label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Label</label>
              <Input placeholder="e.g. bKash Personal" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Account Number</label>
              <Input placeholder="01XXXXXXXXX" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Account Holder Name</label>
              <Input placeholder="Optional" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} />
            </div>
            {form.method === "bank_transfer" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bank Name</label>
                <Input placeholder="e.g. Dutch Bangla Bank" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Instructions</label>
              <Textarea placeholder="Optional instructions for users" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sort Order</label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.label.trim() || !form.account_number.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
