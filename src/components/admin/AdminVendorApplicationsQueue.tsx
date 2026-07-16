import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Store, RefreshCw, Clock } from "lucide-react";

export default function AdminVendorApplicationsQueue() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [target, setTarget] = useState<any>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("merchant_vendor_applications").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data } = await q;
    setApps(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-vendor-apps")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_vendor_applications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const submit = async () => {
    if (!target) return;
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const newStatus = decision === "approve" ? "approved" : "rejected";

    const { error } = await supabase.from("merchant_vendor_applications").update({
      status: newStatus,
      admin_notes: reason.trim(),
      reviewed_by: session?.user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", target.id);
    if (error) { toast.error("Failed: " + error.message); setSaving(false); return; }

    // Grant vendor role on approve
    if (decision === "approve") {
      await (supabase as any).from("user_roles").insert({ user_id: target.user_id, role: "vendor" });
    }

    // Audit event
    await supabase.from("merchant_audit_events").insert({
      merchant_id: target.merchant_id,
      merchant_user_id: target.user_id,
      actor_id: session?.user?.id,
      event_type: "vendor_decision",
      reason: reason.trim(),
      to_value: { status: newStatus, store_name: target.store_name },
    });

    // Notify merchant
    await supabase.from("notifications").insert({
      user_id: target.user_id,
      title: decision === "approve" ? "Vendor Access Approved 🎉" : "Vendor Application Rejected",
      body: decision === "approve"
        ? `Your vendor store "${target.store_name}" is approved. You can now list products.`
        : `Reason: ${reason.trim()}`,
      category: "merchant_ops",
    });

    toast.success(`Vendor application ${newStatus}`);
    setTarget(null); setSaving(false); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vendor Applications</h3>
          <p className="text-xs text-muted-foreground">Merchants requesting vendor access to sell products</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Pending</Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {apps.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Store className="w-8 h-8 mx-auto mb-2 opacity-40" />No applications
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {apps.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{a.store_name}</p>
                    <Badge className={
                      a.status === "approved" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]" :
                      a.status === "rejected" ? "bg-red-500/15 text-red-700 border-red-500/30 text-[10px]" :
                      "bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]"
                    }>{a.status}</Badge>
                    {a.status === "pending" && <Clock className="w-3 h-3 text-amber-500" />}
                  </div>
                  {a.store_description && <p className="text-xs text-muted-foreground mt-1">{a.store_description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {(a.product_categories ?? []).join(", ") || "no categories"} · ~{a.expected_monthly_orders ?? "?"} orders/mo
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    📍 {a.pickup_address} · Submitted {new Date(a.created_at).toLocaleString()}
                  </p>
                  <ShopPhotoRow front={a.shop_front_photo_url} inside={a.shop_inside_photo_url} />
                  {a.admin_notes && (
                    <p className="text-[11px] mt-1 italic text-muted-foreground">Admin note: {a.admin_notes}</p>
                  )}
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => { setTarget(a); setDecision("reject"); setReason(""); }}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => { setTarget(a); setDecision("approve"); setReason(""); }}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === "approve" ? "Approve" : "Reject"} {target?.store_name}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason / feedback for merchant *</Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder={decision === "approve" ? "e.g. All docs verified, product categories fit." : "e.g. Pickup address is incomplete."} />
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

function ShopPhotoRow({ front, inside }: { front?: string | null; inside?: string | null }) {
  const [urls, setUrls] = useState<{ front?: string; inside?: string }>({});
  useEffect(() => {
    let c = false;
    (async () => {
      const out: { front?: string; inside?: string } = {};
      if (front) {
        const { data } = await supabase.storage.from("vendor-kyc").createSignedUrl(front, 600);
        if (data?.signedUrl) out.front = data.signedUrl;
      }
      if (inside) {
        const { data } = await supabase.storage.from("vendor-kyc").createSignedUrl(inside, 600);
        if (data?.signedUrl) out.inside = data.signedUrl;
      }
      if (!c) setUrls(out);
    })();
    return () => { c = true; };
  }, [front, inside]);

  const Tile = ({ src, label, missing }: { src?: string; label: string; missing: boolean }) => (
    <a href={src} target={src ? "_blank" : undefined} rel="noreferrer"
       className={`block w-16 h-16 rounded-md border overflow-hidden ${missing ? "border-red-500/40 bg-red-500/5" : "border-border bg-muted/40"}`}
       title={label}>
      {src ? <img src={src} alt={label} className="w-full h-full object-cover" />
           : <div className="w-full h-full flex items-center justify-center text-[9px] text-red-600 text-center px-1">Missing {label}</div>}
    </a>
  );

  return (
    <div className="flex items-center gap-2 mt-2">
      <Tile src={urls.front}  label="Shop front"  missing={!front} />
      <Tile src={urls.inside} label="Shop inside" missing={!inside} />
    </div>
  );
}
