import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Settings, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";

interface FeeConfig {
  id: string;
  txn_type: string;
  fee_type: string;
  fee_value: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  agent_commission: number | null;
  distributor_commission: number | null;
  platform_share: number | null;
}

const TXN_TYPES = ["send", "cashout", "cashin", "payment", "recharge", "paybill", "addmoney", "banktransfer"];
const FEE_TYPES = ["flat", "percentage"];

export default function AdminChargeConfig() {
  const [configs, setConfigs] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeeConfig | null>(null);
  const [form, setForm] = useState({
    txn_type: "send",
    fee_type: "flat",
    fee_value: "",
    min_amount: "",
    max_amount: "",
    is_active: true,
  });
  const { visible: realtimeVisible, flash: realtimeFlash } = useRealtimeIndicator();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fee_config")
      .select("*")
      .order("txn_type")
      .order("min_amount", { ascending: true, nullsFirst: true });
    setConfigs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-charge-config-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fee_config" }, () => {
        load();
        realtimeFlash();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ txn_type: "send", fee_type: "flat", fee_value: "", min_amount: "", max_amount: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (c: FeeConfig) => {
    setEditing(c);
    setForm({
      txn_type: c.txn_type,
      fee_type: c.fee_type,
      fee_value: String(c.fee_value),
      min_amount: c.min_amount != null ? String(c.min_amount) : "",
      max_amount: c.max_amount != null ? String(c.max_amount) : "",
      is_active: c.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      txn_type: form.txn_type,
      fee_type: form.fee_type,
      fee_value: parseFloat(form.fee_value) || 0,
      min_amount: form.min_amount ? parseFloat(form.min_amount) : null,
      max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await supabase.from("fee_config").update(payload).eq("id", editing.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Charge updated");
    } else {
      const { error } = await supabase.from("fee_config").insert(payload);
      if (error) { toast.error("Failed to create"); return; }
      toast.success("Charge created");
    }
    setDialogOpen(false);
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("fee_config").update({ is_active: active }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <RealtimeUpdateIndicator visible={realtimeVisible} />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" /> Charge Configuration
          </h3>
          <p className="text-sm text-muted-foreground">Manage transaction fees and service charges</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Charge</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Charge" : "Add Charge"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Transaction Type</Label>
                  <Select value={form.txn_type} onValueChange={v => setForm(f => ({ ...f, txn_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TXN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fee Type</Label>
                  <Select value={form.fee_type} onValueChange={v => setForm(f => ({ ...f, fee_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FEE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Fee Value {form.fee_type === "percentage" ? "(%)" : "(৳)"}</Label>
                <Input type="number" value={form.fee_value} onChange={e => setForm(f => ({ ...f, fee_value: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min Amount (৳)</Label>
                  <Input type="number" placeholder="No min" value={form.min_amount} onChange={e => setForm(f => ({ ...f, min_amount: e.target.value }))} />
                </div>
                <div>
                  <Label>Max Amount (৳)</Label>
                  <Input type="number" placeholder="No max" value={form.max_amount} onChange={e => setForm(f => ({ ...f, max_amount: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
              <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Fee</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Range</th>
                  <th className="text-left px-4 py-3 font-medium">Active</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(c => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs capitalize">{c.txn_type}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {c.fee_type === "percentage" ? `${c.fee_value}%` : `৳${c.fee_value}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      {c.min_amount != null || c.max_amount != null
                        ? `৳${c.min_amount ?? 0} – ৳${c.max_amount ?? "∞"}`
                        : "All amounts"}
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={c.is_active} onCheckedChange={v => toggleActive(c.id, v)} />
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && configs.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <Settings className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">No charge rules configured</p>
              <p className="text-xs text-muted-foreground mt-1">Add a charge to get started</p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
