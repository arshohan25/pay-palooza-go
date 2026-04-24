import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Eye, Check, X, RefreshCw, FileText, User, Building2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

type StatusFilter = "pending" | "approved" | "rejected";

export default function AdminVendorKycReview() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [commission, setCommission] = useState("5.00");
  const [rejectReason, setRejectReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("merchants")
      .select("*")
      .eq("business_kyc_status", filter)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = data ?? [];
    // Hydrate owner profile + kyc separately
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    if (userIds.length > 0) {
      const [{ data: profs }, { data: kycs }] = await Promise.all([
        supabase.from("profiles").select("user_id, name, phone, kyc_exempt").in("user_id", userIds),
        supabase.from("kyc_verifications").select("user_id, status").in("user_id", userIds),
      ]);
      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const kycMap = new Map<string, string>();
      (kycs ?? []).forEach((k: any) => { if (!kycMap.has(k.user_id)) kycMap.set(k.user_id, k.status); });
      rows.forEach((r: any) => {
        const p = profMap.get(r.user_id);
        const kycStatus = p?.kyc_exempt ? "verified" : (kycMap.get(r.user_id) || "none");
        r.profiles = { name: p?.name, phone: p?.phone, kyc_status: kycStatus };
      });
    }
    setMerchants(rows);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const signDocs = async (m: any) => {
    const fields = ["nid_front_url", "nid_back_url", "trade_license_url", "bank_statement_url"];
    const urls: Record<string, string> = {};
    for (const f of fields) {
      const path = m[f];
      if (!path) continue;
      // path may be either full URL or storage key
      if (path.startsWith("http")) { urls[f] = path; continue; }
      const { data } = await supabase.storage.from("vendor-kyc").createSignedUrl(path, 3600);
      if (data?.signedUrl) urls[f] = data.signedUrl;
    }
    setDocUrls(urls);
  };

  const openDetail = async (m: any) => {
    setSelected(m);
    setCommission(String(m.commission_rate ?? 5));
    setRejectReason("");
    setDocUrls({});
    await signDocs(m);
  };

  const approve = async () => {
    if (!selected) return;
    const rate = parseFloat(commission);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error("Invalid commission rate"); return; }
    setWorking(true);
    const { error } = await supabase.rpc("approve_business_kyc", {
      p_merchant_id: selected.id,
      p_commission_rate: rate,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor approved & wallet created");
    setSelected(null);
    load();
  };

  const reject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) { toast.error("Please provide a reason"); return; }
    setWorking(true);
    const { error } = await supabase.rpc("reject_business_kyc", {
      p_merchant_id: selected.id,
      p_reason: rejectReason,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor application rejected");
    setSelected(null);
    load();
  };

  const counts = {
    pending: merchants.filter(m => filter === "pending").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Vendor KYC Review
        </h3>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
      </div>

      <div className="flex gap-1.5">
        {(["pending", "approved", "rejected"] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : merchants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No {filter} applications</div>
      ) : (
        <div className="space-y-2">
          {merchants.map(m => (
            <Card key={m.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{m.business_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(m.profiles as any)?.name || "—"} · {m.category}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Submitted {format(new Date(m.created_at), "MMM dd, yyyy")}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {m.business_kyc_status}
                </Badge>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openDetail(m)}>
                  <Eye className="w-3.5 h-3.5 mr-1" />Review
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.business_name}</SheetTitle>
            <SheetDescription>Vendor KYC Application</SheetDescription>
          </SheetHeader>
          {selected && (
            <ScrollArea className="mt-4 h-[80vh] pr-4">
              <div className="space-y-4 pb-8">
                {/* Owner info */}
                <Card className="border">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <User className="w-3.5 h-3.5" /> Owner
                    </div>
                    <p className="text-sm text-foreground">{(selected.profiles as any)?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{(selected.profiles as any)?.phone || "—"}</p>
                    <Badge variant={(selected.profiles as any)?.kyc_status === "verified" ? "default" : "destructive"} className="text-[10px]">
                      User KYC: {(selected.profiles as any)?.kyc_status || "unverified"}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Business info */}
                <Card className="border">
                  <CardContent className="p-3 space-y-1.5 text-xs">
                    <p><span className="text-muted-foreground">Category:</span> <span className="text-foreground">{selected.category}</span></p>
                    <p><span className="text-muted-foreground">Trade License:</span> <span className="text-foreground">{selected.trade_license || "—"}</span></p>
                    <p><span className="text-muted-foreground">Bank:</span> <span className="text-foreground">{selected.bank_name || "—"}</span></p>
                    <p><span className="text-muted-foreground">Account:</span> <span className="text-foreground">{selected.bank_account_number || "—"}</span></p>
                    <p><span className="text-muted-foreground">Holder:</span> <span className="text-foreground">{selected.bank_account_holder || "—"}</span></p>
                  </CardContent>
                </Card>

                {/* Documents */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Documents
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "nid_front_url", label: "NID Front" },
                      { key: "nid_back_url", label: "NID Back" },
                      { key: "trade_license_url", label: "Trade License" },
                      { key: "bank_statement_url", label: "Bank Statement" },
                    ].map(d => {
                      const url = docUrls[d.key];
                      return (
                        <a
                          key={d.key}
                          href={url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block rounded-lg border p-2 text-xs ${url ? "hover:bg-muted/50" : "opacity-50 pointer-events-none"}`}
                        >
                          {url ? (
                            <img src={url} alt={d.label} className="w-full h-24 object-cover rounded mb-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-24 rounded bg-muted flex items-center justify-center mb-1">
                              <FileText className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <p className="text-foreground font-medium">{d.label}</p>
                          <p className="text-[10px] text-muted-foreground">{url ? "Click to view" : "Not uploaded"}</p>
                        </a>
                      );
                    })}
                  </div>
                </div>

                {selected.business_kyc_status === "pending" && (
                  <>
                    {/* Approval form */}
                    <Card className="border-emerald-200 bg-emerald-50/50">
                      <CardContent className="p-3 space-y-2">
                        <Label className="text-xs">Commission Rate (%)</Label>
                        <Input type="number" step="0.01" value={commission} onChange={e => setCommission(e.target.value)} />
                        <p className="text-[10px] text-muted-foreground">Default platform commission for this vendor. Per-category overrides can be set later.</p>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={working} onClick={approve}>
                          <Check className="w-3.5 h-3.5 mr-1" />Approve & Activate Vendor
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Rejection form */}
                    <Card className="border-red-200 bg-red-50/50">
                      <CardContent className="p-3 space-y-2">
                        <Label className="text-xs">Rejection Reason</Label>
                        <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. NID image unclear, license expired…" rows={2} />
                        <Button variant="destructive" className="w-full" disabled={working} onClick={reject}>
                          <X className="w-3.5 h-3.5 mr-1" />Reject Application
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}

                {selected.business_kyc_status === "rejected" && selected.business_kyc_rejection_reason && (
                  <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-3 text-xs">
                      <p className="font-semibold text-red-700">Rejection reason:</p>
                      <p className="text-foreground mt-1">{selected.business_kyc_rejection_reason}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
