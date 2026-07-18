import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircleDollarSign, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PinConfirmSheet from "@/components/PinConfirmSheet";

interface FloatReq {
  id: string;
  agent_id: string;
  agent_user_id: string;
  amount: number;
  note: string | null;
  status: string;
  created_at: string;
  agent_name?: string | null;
  agent_phone?: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

interface Props {
  distributorId: string;
  onProcessed?: () => void;
}

const DistributorFloatRequests = ({ distributorId, onProcessed }: Props) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<FloatReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [pinTarget, setPinTarget] = useState<FloatReq | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("agent_float_requests")
      .select("id, agent_id, agent_user_id, amount, note, status, created_at")
      .eq("distributor_id", distributorId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const list = (data || []) as FloatReq[];

    // Hydrate agent names + phones
    if (list.length > 0) {
      const agentIds = Array.from(new Set(list.map((r) => r.agent_id)));
      const userIds = Array.from(new Set(list.map((r) => r.agent_user_id)));
      const [agentsRes, profilesRes] = await Promise.all([
        supabase.from("agents").select("id, business_name").in("id", agentIds),
        supabase.from("profiles").select("user_id, phone").in("user_id", userIds),
      ]);
      const nameMap = new Map((agentsRes.data || []).map((a: any) => [a.id, a.business_name]));
      const phoneMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.phone]));
      list.forEach((r) => {
        r.agent_name = nameMap.get(r.agent_id) || null;
        r.agent_phone = phoneMap.get(r.agent_user_id) || null;
      });
    }
    setRows(list);
    setLoading(false);
  }, [distributorId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`float-reqs-${distributorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_float_requests", filter: `distributor_id=eq.${distributorId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [distributorId, load]);

  const approve = async (row: FloatReq) => {
    if (!row.agent_phone) {
      toast({ title: "Missing phone", description: "Agent phone not found", variant: "destructive" });
      return;
    }
    setProcessingId(row.id);
    try {
      const reference = `FR-${Date.now()}`;
      const { error: txErr } = await supabase.rpc("transfer_money", {
        p_recipient_phone: row.agent_phone,
        p_amount: Number(row.amount),
        p_fee: 0,
        p_type: "send" as any,
        p_description: `Float request approved${row.agent_name ? ` for ${row.agent_name}` : ""}`,
        p_reference: reference,
      });
      if (txErr) throw txErr;
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updErr } = await supabase
        .from("agent_float_requests")
        .update({
          status: "approved",
          decided_at: new Date().toISOString(),
          decided_by: user?.id,
          txn_reference: reference,
        })
        .eq("id", row.id);
      if (updErr) throw updErr;
      toast({ title: "Approved", description: `৳${fmt(row.amount)} sent to ${row.agent_name || "agent"}` });
      onProcessed?.();
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Could not process", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const reject = async (row: FloatReq) => {
    setProcessingId(row.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("agent_float_requests")
        .update({
          status: "rejected",
          decided_at: new Date().toISOString(),
          decided_by: user?.id,
        })
        .eq("id", row.id);
      if (error) throw error;
      toast({ title: "Rejected", description: `Request from ${row.agent_name || "agent"} rejected` });
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card className="p-4 border-0 shadow-card mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <CircleDollarSign size={14} className="text-primary" /> Float Requests
          {rows.length > 0 && (
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] ml-1">{rows.length}</Badge>
          )}
        </h3>
        <button onClick={load} className="text-muted-foreground hover:text-foreground">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No pending requests</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="p-3 rounded-xl bg-muted/40 border border-border/50">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {r.agent_name || "Agent"} <span className="text-muted-foreground font-normal">· {r.agent_phone || "—"}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-extrabold text-primary shrink-0">৳{fmt(r.amount)}</p>
              </div>
              {r.note && <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">"{r.note}"</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={processingId === r.id}
                  onClick={() => reject(r)}
                  className="flex-1 h-8 text-[11px]"
                >
                  <X size={12} className="mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  disabled={processingId === r.id}
                  onClick={() => setPinTarget(r)}
                  className="flex-1 h-8 text-[11px] gradient-primary text-primary-foreground"
                >
                  <Check size={12} className="mr-1" />
                  {processingId === r.id ? "…" : "Approve & Send"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <PinConfirmSheet
        open={!!pinTarget}
        onClose={() => setPinTarget(null)}
        title="Confirm float approval"
        description={pinTarget ? `Approve ৳${fmt(pinTarget.amount)} to ${pinTarget.agent_name || "agent"}? Enter your PIN to send funds.` : undefined}
        onConfirmed={async () => { if (pinTarget) { const r = pinTarget; setPinTarget(null); await approve(r); } }}
      />
    </Card>
  );
};

export default DistributorFloatRequests;
