import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, RefreshCw, ShieldCheck, ShieldAlert, Layers } from "lucide-react";
import { formatMdrPercent } from "@/lib/mdr";

type Decision = "approve" | "reject";

export default function AdminMerchantApprovalQueue() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-target dialog
  const [target, setTarget] = useState<any>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDecision, setBulkDecision] = useState<Decision>("approve");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("merchants").select("*").eq("status", "pending").order("created_at", { ascending: false });
    setPending(data ?? []);
    setSelected(prev => {
      const ids = new Set((data ?? []).map((r: any) => r.id));
      const next = new Set<string>();
      prev.forEach(id => { if (ids.has(id)) next.add(id); });
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-merchant-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const allSelected = pending.length > 0 && selected.size === pending.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(pending.map(m => m.id)));
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectedRows = useMemo(() => pending.filter(m => selected.has(m.id)), [pending, selected]);

  const openDecision = (m: any, d: Decision) => {
    setTarget(m); setDecision(d); setReason("");
  };

  const openBulk = (d: Decision) => {
    if (selected.size === 0) { toast.error("Select at least one merchant"); return; }
    setBulkDecision(d); setBulkReason(""); setBulkOpen(true);
  };

  const applyDecision = async (rows: any[], d: Decision, noteRaw: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const newStatus = d === "approve" ? "active" : "suspended";
    const note = noteRaw.trim() || (d === "approve" ? "Admin approved (no note)" : "Admin rejected (no note)");
    const ids = rows.map(r => r.id);
    if (ids.length === 0) return { ok: 0, fail: 0 };

    const { error } = await supabase.from("merchants")
      .update({ status: newStatus as any, admin_notes: note })
      .in("id", ids);
    if (error) { toast.error("Failed: " + error.message); return { ok: 0, fail: ids.length }; }

    const auditRows = rows.map(r => ({
      merchant_id: r.id,
      merchant_user_id: r.user_id,
      actor_id: session?.user?.id,
      event_type: d === "approve" ? "approval" : "rejection",
      reason: note,
      to_value: { status: newStatus },
    }));
    await supabase.from("merchant_audit_events").insert(auditRows);

    const notifRows = rows.map(r => ({
      user_id: r.user_id,
      title: d === "approve" ? "Merchant Approved" : "Merchant Application Rejected",
      body: d === "approve"
        ? `Your merchant "${r.business_name}" is now active.`
        : `Reason: ${note}`,
      category: "merchant_ops",
    }));
    await supabase.from("notifications").insert(notifRows);

    // Best-effort per-merchant email/SMS notify (non-blocking)
    Promise.all(rows.map(r =>
      supabase.functions.invoke("notify-merchant-approval", {
        body: {
          user_id: r.user_id,
          merchant_id: r.id,
          status: d === "approve" ? "approved" : "rejected",
          reason: note,
          business_name: r.business_name,
        },
      }).catch(e => console.warn("notify-merchant-approval failed", e))
    ));

    return { ok: ids.length, fail: 0 };
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    const res = await applyDecision([target], decision, reason);
    if (res.ok) toast.success(`Merchant ${decision === "approve" ? "approved" : "rejected"}`);
    setTarget(null); setSaving(false); load();
  };

  const submitBulk = async () => {
    if (selectedRows.length === 0) return;
    setBulkSaving(true);
    const res = await applyDecision(selectedRows, bulkDecision, bulkReason);
    if (res.ok) toast.success(`${res.ok} merchant${res.ok === 1 ? "" : "s"} ${bulkDecision === "approve" ? "approved" : "rejected"}`);
    setBulkOpen(false); setBulkSaving(false); setSelected(new Set()); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Merchant Approval Queue</h3>
          <p className="text-xs text-muted-foreground">
            {pending.length} awaiting review{selected.size > 0 ? ` · ${selected.size} selected` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="destructive" onClick={() => openBulk("reject")}>
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject {selected.size}
              </Button>
              <Button size="sm" onClick={() => openBulk("approve")}>
                <Layers className="w-3.5 h-3.5 mr-1" /> Approve {selected.size}
              </Button>
            </>
          )}
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {pending.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No pending merchants
        </CardContent></Card>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1 pt-1">
            <Checkbox id="select-all" checked={allSelected} onCheckedChange={toggleAll} />
            <Label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
              Select all ({pending.length})
            </Label>
          </div>
          <div className="grid gap-2">
            {pending.map(m => (
              <Card key={m.id} className={`border-amber-500/20 ${selected.has(m.id) ? "ring-2 ring-primary/40" : ""}`}>
                <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                  <Checkbox
                    checked={selected.has(m.id)}
                    onCheckedChange={() => toggleOne(m.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{m.business_name}</p>
                      <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                      {m.business_kyc_status === "verified" ? (
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3 mr-0.5" /> KYC OK
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">
                          <ShieldAlert className="w-3 h-3 mr-0.5" /> KYC {m.business_kyc_status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.owner_name ?? "—"} · {m.contact_number ?? "—"} · MDR {formatMdrPercent(m.mdr_rate)} · {m.settlement_frequency}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Submitted {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => openDecision(m, "reject")}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => openDecision(m, "approve")}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Single decision dialog */}
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === "approve" ? "Approve" : "Reject"} {target?.business_name}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3">
            <RadioGroup value={decision} onValueChange={(v) => setDecision(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="approve" id="d-approve" />
                <Label htmlFor="d-approve" className="text-sm">Approve → Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="reject" id="d-reject" />
                <Label htmlFor="d-reject" className="text-sm">Reject → Suspended</Label>
              </div>
            </RadioGroup>
            <div>
              <Label className="text-xs">Reason / audit note <span className="text-muted-foreground">(optional for admin)</span></Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Optional. Leave blank to approve with no note." />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={saving}>
              {saving ? "Saving…" : `Confirm ${decision}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk decision dialog */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Bulk {bulkDecision} {selectedRows.length} merchant{selectedRows.length === 1 ? "" : "s"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground max-h-32 overflow-auto space-y-0.5 border border-border/40 rounded-md p-2">
              {selectedRows.map(r => (
                <div key={r.id} className="truncate">• {r.business_name} <span className="opacity-60">({r.contact_number ?? "—"})</span></div>
              ))}
            </div>
            <div>
              <Label className="text-xs">Shared audit note <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={bulkReason} onChange={e => setBulkReason(e.target.value)} rows={3}
                placeholder="Optional. Applied to every selected merchant." />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitBulk} disabled={bulkSaving}>
              {bulkSaving ? "Saving…" : `Confirm bulk ${bulkDecision}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
