import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


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
  const [confirmReject, setConfirmReject] = useState<{ mode: "one"; id: string } | { mode: "bulk" } | null>(null);


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

  const rejectOne = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_reject_fund_request", {
        p_request_id: id,
        p_admin_note: "Rejected by admin",
      });
      if (error) throw error;
      toast.success("Rejected");
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
      await load();
    } catch (e: any) {
      toast.error(e.message || "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  const bulkReject = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const id of [...selected]) {
      const { error } = await supabase.rpc("admin_reject_fund_request", {
        p_request_id: id,
        p_admin_note: "Rejected by admin",
      });
      if (error) fail++; else ok++;
    }
    toast.success(`Rejected ${ok}${fail ? `, failed ${fail}` : ""}`);
    setSelected(new Set());
    await load();
    setBusy(false);
  };

  const totalSelected = rows.filter(r => selected.has(r.id)).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Pending Add Money</h2>
          <p className="text-xs text-muted-foreground">{rows.length} pending · shows invoice ID for gateway matching</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmReject({ mode: "bulk" })} disabled={busy || selected.size === 0} data-testid="bulk-reject">
            <XCircle size={14} className="mr-1" /> Bulk Reject ({selected.size})
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
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="text-base font-bold">৳{Number(r.amount).toLocaleString()}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => setConfirmReject({ mode: "one", id: r.id })}
                        disabled={busy}
                        data-testid={`reject-${r.id}`}
                      >
                        <XCircle size={12} className="mr-1" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={!!confirmReject} onOpenChange={(o) => !o && setConfirmReject(null)}>
        <AlertDialogContent data-testid="reject-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmReject?.mode === "bulk"
                ? `Reject ${selected.size} pending request${selected.size === 1 ? "" : "s"}?`
                : "Reject this pending request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the request{confirmReject?.mode === "bulk" ? "s" : ""} as rejected and notify the user. Your admin account and the rejection time will be recorded in history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="reject-confirm-action"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const c = confirmReject;
                setConfirmReject(null);
                if (!c) return;
                if (c.mode === "one") await rejectOne(c.id);
                else await bulkReject();
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Confirm reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

