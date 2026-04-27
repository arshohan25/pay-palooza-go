import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, CheckCircle2, XCircle, Clock, Unlock, Inbox, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Row {
  id: string;
  user_id: string;
  merchant_id: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_name?: string;
  user_phone?: string;
  business_name?: string;
}

interface Props { search?: string }

export default function AdminApiAccessRequests({ search = "" }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [active, setActive] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("merchant_api_access_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (data) {
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const merchantIds = [...new Set(data.map((r: any) => r.merchant_id).filter(Boolean))];
      const [{ data: profiles }, { data: merchants }] = await Promise.all([
        supabase.from("profiles").select("user_id, name, phone").in("user_id", userIds as string[]),
        merchantIds.length
          ? supabase.from("merchants").select("id, business_name").in("id", merchantIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const mMap = new Map((merchants ?? []).map((m: any) => [m.id, m.business_name]));
      setRows(
        (data as Row[]).map((r) => ({
          ...r,
          user_name: pMap.get(r.user_id)?.name ?? "—",
          user_phone: pMap.get(r.user_id)?.phone ?? "",
          business_name: r.merchant_id ? mMap.get(r.merchant_id) ?? "" : "",
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-api-access-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_api_access_requests" },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const grant = async (row: Row) => {
    setBusy(true);
    const { error } = await supabase.rpc("grant_merchant_api_access", {
      p_user_id: row.user_id,
      p_request_id: row.id,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("API access granted");
    setActive(null);
    setNote("");
  };

  const reject = async (row: Row) => {
    setBusy(true);
    const { error } = await (supabase as any)
      .from("merchant_api_access_requests")
      .update({ status: "rejected", reviewer_note: note.trim() || null, reviewed_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request rejected");
    setActive(null);
    setNote("");
  };

  const revoke = async (row: Row) => {
    setBusy(true);
    const { error } = await supabase.rpc("revoke_merchant_api_access", { p_user_id: row.user_id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("API access revoked");
  };

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) =>
      !q ||
      r.user_name?.toLowerCase().includes(q) ||
      r.user_phone?.toLowerCase().includes(q) ||
      r.business_name?.toLowerCase().includes(q) ||
      r.message?.toLowerCase().includes(q)
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: "pending", label: "Pending", count: counts.pending, icon: Clock, cls: "text-amber-600 bg-amber-500/10" },
          { key: "approved", label: "Approved", count: counts.approved, icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10" },
          { key: "rejected", label: "Rejected", count: counts.rejected, icon: XCircle, cls: "text-destructive bg-destructive/10" },
        ] as const).map((c) => (
          <Card
            key={c.key}
            className={`cursor-pointer border-0 shadow-sm ${filter === c.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilter(c.key)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.cls}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold text-foreground">{c.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          <Inbox className="w-3 h-3 mr-1" /> {filtered.length} request{filtered.length === 1 ? "" : "s"}
        </Badge>
        <div className="flex items-center gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")} className="h-7 text-xs">All</Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50 max-h-[560px] overflow-y-auto">
            {filtered.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{r.user_name}</p>
                    {r.user_phone && <span className="text-[10px] text-muted-foreground">{r.user_phone}</span>}
                    {r.business_name && <Badge variant="outline" className="text-[9px]">{r.business_name}</Badge>}
                    <Badge
                      variant={r.status === "approved" ? "secondary" : r.status === "rejected" ? "destructive" : "outline"}
                      className="text-[9px] capitalize"
                    >
                      {r.status}
                    </Badge>
                  </div>
                  {r.message && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {format(new Date(r.created_at), "PPp")}
                    {r.reviewed_at && <> · reviewed {format(new Date(r.reviewed_at), "PPp")}</>}
                  </p>
                  {r.reviewer_note && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">Note: {r.reviewer_note}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {r.status === "pending" && (
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setActive(r); setNote(""); }}>
                      <Unlock className="w-3.5 h-3.5" /> Review
                    </Button>
                  )}
                  {r.status === "approved" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => revoke(r)} disabled={busy}>
                      <Lock className="w-3.5 h-3.5" /> Revoke
                    </Button>
                  )}
                  {r.status === "rejected" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setActive(r); setNote(""); }}>
                      Re-review
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {loading ? "Loading…" : "No requests in this view"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Review API Access Request</DialogTitle>
            <DialogDescription className="text-xs">
              {active?.user_name} {active?.business_name && <>· {active.business_name}</>}
            </DialogDescription>
          </DialogHeader>
          {active?.message && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-foreground">
              <p className="font-semibold mb-1">Merchant message</p>
              <p className="text-muted-foreground">{active.message}</p>
            </div>
          )}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for the merchant…"
            rows={3}
            className="text-sm"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => active && reject(active)}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
            <Button size="sm" disabled={busy} onClick={() => active && grant(active)}>
              <Unlock className="w-3.5 h-3.5 mr-1" /> Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
