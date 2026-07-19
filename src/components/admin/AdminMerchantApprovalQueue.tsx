import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

export default function AdminMerchantApprovalQueue() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<any>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("merchants").select("*").eq("status", "pending").order("created_at", { ascending: false });
    setPending(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-merchant-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const openDecision = (m: any, d: "approve" | "reject") => {
    setTarget(m); setDecision(d); setReason("");
  };

  const submit = async () => {
    if (!target) return;
    // Admin override: reason is optional. Reject still recommends a reason but is not enforced.
    setSaving(true);
    const newStatus = decision === "approve" ? "active" : "suspended";
    const { data: { session } } = await supabase.auth.getSession();
    const note = reason.trim() || (decision === "approve" ? "Admin approved (no note)" : "Admin rejected (no note)");

    const { error } = await supabase.from("merchants")
      .update({ status: newStatus as any, admin_notes: note })
      .eq("id", target.id);
    if (error) { toast.error("Failed: " + error.message); setSaving(false); return; }

    // Audit event (approval / rejection)
    await supabase.from("merchant_audit_events").insert({
      merchant_id: target.id,
      merchant_user_id: target.user_id,
      actor_id: session?.user?.id,
      event_type: decision === "approve" ? "approval" : "rejection",
      reason: note,
      to_value: { status: newStatus },
    });

    // Notify merchant (in-app + email + SMS via notify function)
    try {
      await supabase.functions.invoke("notify-merchant-approval", {
        body: {
          user_id: target.user_id,
          merchant_id: target.id,
          status: decision === "approve" ? "approved" : "rejected",
          reason: reason.trim(),
          business_name: target.business_name,
        },
      });
    } catch (e) {
      console.warn("notify-merchant-approval failed", e);
    }
    // Fallback in-app notification (in case function is unavailable)
    await supabase.from("notifications").insert({
      user_id: target.user_id,
      title: decision === "approve" ? "Merchant Approved" : "Merchant Application Rejected",
      body: decision === "approve"
        ? `Your merchant "${target.business_name}" is now active.`
        : `Reason: ${reason.trim()}`,
      category: "merchant_ops",
    });

    toast.success(`Merchant ${decision === "approve" ? "approved" : "rejected"}`);
    setTarget(null); setSaving(false); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Merchant Approval Queue</h3>
          <p className="text-xs text-muted-foreground">{pending.length} awaiting review</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {pending.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No pending merchants
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {pending.map(m => (
            <Card key={m.id} className="border-amber-500/20">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
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
                    {m.owner_name ?? "—"} · {m.contact_number ?? "—"} · MDR {m.mdr_rate}% · {m.settlement_frequency}
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
      )}

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
              <Label className="text-xs">Reason / audit note *</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="e.g. All documents verified, MDR aligned with tier." />
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
    </div>
  );
}
