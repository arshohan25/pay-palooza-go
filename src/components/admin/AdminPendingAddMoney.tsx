import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PendingRow {
  id: string;
  user_id: string;
  amount: number;
  transaction_id_proof: string | null;
  source_method: string | null;
  created_at: string;
}

interface Profile { name: string | null; phone: string; }

export default function AdminPendingAddMoney() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fund_requests")
      .select("id,user_id,amount,transaction_id_proof,source_method,created_at")
      .eq("type", "add_money")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data as PendingRow[]) ?? [];
    setRows(list);
    const ids = [...new Set(list.map(r => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,name,phone").in("user_id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = { name: p.name, phone: p.phone }; });
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_bulk_approve_addmoney", {
        p_request_ids: [...selected],
        p_admin_note: "Bulk approval",
      });
      if (error) throw error;
      const r = data as { approved: number; failed: number };
      toast.success(`Approved ${r.approved}, failed ${r.failed}`);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      toast.error(e.message || "Bulk approve failed");
    } finally {
      setBusy(false);
    }
  };

  const totalSelected = rows.filter(r => selected.has(r.id)).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Pending Add Money</h2>
          <p className="text-xs text-muted-foreground">{rows.length} pending · shows invoice ID for gateway matching</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={bulkApprove} disabled={busy || selected.size === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
            Bulk Approve ({selected.size}) · ৳{totalSelected.toLocaleString()}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No pending add-money requests.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <Checkbox checked={selected.size === rows.length && rows.length > 0} onCheckedChange={toggleAll} />
            <span>Select all</span>
          </div>
          <div className="space-y-2">
            {rows.map(r => {
              const p = profiles[r.user_id];
              const isSel = selected.has(r.id);
              return (
                <Card key={r.id} className={`border ${isSel ? "border-primary" : ""}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(r.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{p?.name || "Unknown"}</p>
                        <span className="text-xs text-muted-foreground">{p?.phone || "—"}</span>
                        {r.source_method && <Badge variant="outline" className="text-[10px]">{r.source_method}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Invoice: <span className="font-mono text-foreground">{r.transaction_id_proof || "—"}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold">৳{Number(r.amount).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
