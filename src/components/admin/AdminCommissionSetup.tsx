import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Coins, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";

interface CommissionRow {
  id: string;
  txn_type: string;
  agent_commission: number | null;
  distributor_commission: number | null;
  platform_share: number | null;
  fee_value: number;
  fee_type: string;
  is_active: boolean;
}

export default function AdminCommissionSetup() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CommissionRow | null>(null);
  const [form, setForm] = useState({ agent: "", distributor: "", platform: "" });
  const { visible: realtimeVisible, flash: realtimeFlash } = useRealtimeIndicator();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fee_config")
      .select("id, txn_type, agent_commission, distributor_commission, platform_share, fee_value, fee_type, is_active")
      .order("txn_type");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-commission-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fee_config" }, () => {
        load();
        realtimeFlash();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const openEdit = (r: CommissionRow) => {
    setEditing(r);
    setForm({
      agent: r.agent_commission != null ? String(r.agent_commission) : "",
      distributor: r.distributor_commission != null ? String(r.distributor_commission) : "",
      platform: r.platform_share != null ? String(r.platform_share) : "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    const { error } = await supabase.from("fee_config").update({
      agent_commission: form.agent ? parseFloat(form.agent) : 0,
      distributor_commission: form.distributor ? parseFloat(form.distributor) : 0,
      platform_share: form.platform ? parseFloat(form.platform) : 0,
    }).eq("id", editing.id);

    if (error) { toast.error("Failed to update"); return; }
    toast.success("Commission updated");
    setEditing(null);
    load();
  };

  // Aggregate totals
  const totalAgent = rows.reduce((s, r) => s + (r.agent_commission ?? 0), 0);
  const totalDist = rows.reduce((s, r) => s + (r.distributor_commission ?? 0), 0);
  const totalPlat = rows.reduce((s, r) => s + (r.platform_share ?? 0), 0);

  return (
    <div className="space-y-4">
      <RealtimeUpdateIndicator visible={realtimeVisible} />
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" /> Commission Setup
        </h3>
        <p className="text-sm text-muted-foreground">Configure agent, distributor, and platform commission splits</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Agent Avg Rate", value: rows.length ? (totalAgent / rows.length).toFixed(2) + "%" : "—", color: "text-emerald-600" },
          { label: "Distributor Avg Rate", value: rows.length ? (totalDist / rows.length).toFixed(2) + "%" : "—", color: "text-blue-600" },
          { label: "Platform Avg Rate", value: rows.length ? (totalPlat / rows.length).toFixed(2) + "%" : "—", color: "text-purple-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3 sm:p-4 text-center sm:text-center flex sm:block items-center justify-between">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-lg sm:text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Txn Type</th>
                  <th className="text-left px-4 py-3 font-medium">Agent %</th>
                  <th className="text-left px-4 py-3 font-medium">Distributor %</th>
                  <th className="text-left px-4 py-3 font-medium">Platform %</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Edit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs capitalize">{r.txn_type}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">{r.agent_commission ?? 0}%</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{r.distributor_commission ?? 0}%</td>
                    <td className="px-4 py-3 font-semibold text-purple-600">{r.platform_share ?? 0}%</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.is_active ? "default" : "secondary"} className="text-xs">
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="sm:hidden divide-y divide-border/50">
            {rows.map(r => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs capitalize">{r.txn_type}</Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">
                      {r.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Agent</p>
                    <p className="font-semibold text-emerald-600">{r.agent_commission ?? 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Distributor</p>
                    <p className="font-semibold text-blue-600">{r.distributor_commission ?? 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Platform</p>
                    <p className="font-semibold text-purple-600">{r.platform_share ?? 0}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && rows.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <Coins className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">No commission rules configured</p>
              <p className="text-xs text-muted-foreground mt-1">Commission rules will appear here</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Commission — <span className="capitalize">{editing?.txn_type}</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Agent Commission (%)</Label>
              <Input type="number" step="0.01" value={form.agent} onChange={e => setForm(f => ({ ...f, agent: e.target.value }))} />
            </div>
            <div>
              <Label>Distributor Commission (%)</Label>
              <Input type="number" step="0.01" value={form.distributor} onChange={e => setForm(f => ({ ...f, distributor: e.target.value }))} />
            </div>
            <div>
              <Label>Platform Share (%)</Label>
              <Input type="number" step="0.01" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleSave}>Update Commission</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
