import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, Search, Key, RefreshCw, Copy, Eye, EyeOff, Plus } from "lucide-react";
import { format } from "date-fns";
import AdminApiKeys from "./AdminApiKeys";
import AdminApiLogs from "./AdminApiLogs";
import AdminApiRateLimits from "./AdminApiRateLimits";
import AdminApiIpWhitelist from "./AdminApiIpWhitelist";
import AdminApiWebhooks from "./AdminApiWebhooks";
import AdminApiSandbox from "./AdminApiSandbox";
import AdminApiUsageAnalytics from "./AdminApiUsageAnalytics";
import AdminApiAccessRequests from "./AdminApiAccessRequests";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "merchant_api_request", entity_id: entityId, details
    }).then();
  }
}

interface ApiRequest {
  id: string;
  merchant_id: string;
  status: string;
  webhook_url: string | null;
  reason: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  merchant_name?: string;
}

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "outline", label: "Pending" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

export default function AdminApiRequests() {
  const [activeTab, setActiveTab] = useState<"requests" | "access" | "keys" | "logs" | "rate-limits" | "ip-whitelist" | "webhooks" | "sandbox" | "usage">("requests");
  const openGenerateKeyRef = React.useRef<(() => void) | null>(null);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState<{ requestId: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data: reqData } = await (supabase as any)
      .from("merchant_api_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!reqData) { setRequests([]); setLoading(false); return; }

    const merchantIds = [...new Set((reqData as any[]).map((r: any) => r.merchant_id))];
    const { data: merchants } = await supabase
      .from("merchants")
      .select("id, business_name")
      .in("id", merchantIds);

    const nameMap = Object.fromEntries((merchants ?? []).map(m => [m.id, m.business_name]));
    const enriched = (reqData as any[]).map((r: any) => ({ ...r, merchant_name: nameMap[r.merchant_id] || "Unknown" }));
    setRequests(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    const ch = supabase.channel("admin-api-requests-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_api_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRequests]);

  const counts = {
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  const filtered = requests.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search && !(r.merchant_name?.toLowerCase().includes(search.toLowerCase()) || r.reason?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const handleAction = async (requestId: string, action: "approved" | "rejected", merchantId: string) => {
    setProcessing(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      await (supabase as any).from("merchant_api_requests").update({
        status: action,
        admin_notes: adminNotes[requestId] || null,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", requestId);

      if (action === "approved") {
        const apiKey = "epk_" + crypto.randomUUID().replace(/-/g, "");
        const secretKey = "eps_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const appPassword = "epp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
        const req = requests.find(r => r.id === requestId);

        await supabase.from("merchant_api_keys").insert({
          merchant_id: merchantId,
          api_key: apiKey,
          secret_key: secretKey,
          app_password: appPassword,
          webhook_url: req?.webhook_url || null,
          is_active: true,
        } as any);

        setGeneratedSecret({ requestId, secret: secretKey });

        const { data: merchant } = await supabase.from("merchants").select("user_id").eq("id", merchantId).maybeSingle();
        if (merchant?.user_id) {
          await supabase.from("notifications").insert({
            user_id: merchant.user_id,
            title: "API Access Approved",
            body: "Your API access request has been approved. API keys are now active.",
            category: "system",
          });
        }

        auditLog("approve_api_request", requestId, { merchant_id: merchantId, merchant_name: req?.merchant_name });
        toast.success("Request approved & API key generated");
      } else {
        const { data: merchant } = await supabase.from("merchants").select("user_id").eq("id", merchantId).maybeSingle();
        if (merchant?.user_id) {
          await supabase.from("notifications").insert({
            user_id: merchant.user_id,
            title: "API Access Rejected",
            body: adminNotes[requestId] ? `Reason: ${adminNotes[requestId]}` : "Your API access request has been rejected.",
            category: "system",
          });
        }
        auditLog("reject_api_request", requestId, { merchant_id: merchantId, reason: adminNotes[requestId] || null });
        toast.info("Request rejected");
      }

      setAdminNotes(prev => { const n = { ...prev }; delete n[requestId]; return n; });
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" /> API Access Management
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 h-7 w-44 text-xs"
            />
          </div>
          {activeTab === "keys" && (
            <Button size="sm" className="h-7 text-xs" onClick={() => openGenerateKeyRef.current?.()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Generate Key
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-muted/50 rounded-lg p-1 flex gap-0.5 overflow-x-auto max-w-full">
        {([
          { key: "requests" as const, label: "Key Requests" },
          { key: "access" as const, label: "Access Requests" },
          { key: "keys" as const, label: "API Keys" },
          { key: "logs" as const, label: "Logs" },
          { key: "rate-limits" as const, label: "Rate Limits" },
          { key: "ip-whitelist" as const, label: "IP Whitelist" },
          { key: "webhooks" as const, label: "Webhooks" },
          { key: "sandbox" as const, label: "Sandbox" },
          { key: "usage" as const, label: "Usage" },
        ]).map(t => (
          <button
            key={t.key}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "access" ? (
        <AdminApiAccessRequests search={search} />
      ) : activeTab === "keys" ? (
        <AdminApiKeys search={search} onGenerateRef={(fn) => { openGenerateKeyRef.current = fn; }} />
      ) : activeTab === "logs" ? (
        <AdminApiLogs search={search} />
      ) : activeTab === "rate-limits" ? (
        <AdminApiRateLimits search={search} />
      ) : activeTab === "ip-whitelist" ? (
        <AdminApiIpWhitelist search={search} />
      ) : activeTab === "webhooks" ? (
        <AdminApiWebhooks search={search} />
      ) : activeTab === "sandbox" ? (
        <AdminApiSandbox />
      ) : activeTab === "usage" ? (
        <AdminApiUsageAnalytics search={search} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setFilter("pending")}>
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{counts.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setFilter("approved")}>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{counts.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setFilter("rejected")}>
              <CardContent className="p-4 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{counts.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Generated secret display */}
          {generatedSecret && (
            <Card className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">⚠️ Secret key generated — copy it now (shown once):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 font-mono break-all border">
                    {showSecret ? generatedSecret.secret : "•".repeat(40)}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(generatedSecret.secret); toast.success("Copied"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setGeneratedSecret(null); setShowSecret(false); }}>Dismiss</Button>
              </CardContent>
            </Card>
          )}

          {/* Filter */}
          <div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5 overflow-x-auto max-w-full">
            {(["all", "pending", "approved", "rejected"] as const).map(f => (
              <button key={f} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${filter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && <Badge variant="secondary" className="text-xs">{counts[f]}</Badge>}
              </button>
            ))}
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests found</TableCell></TableRow>
                ) : filtered.map(req => {
                  const badge = STATUS_BADGE[req.status] || STATUS_BADGE.pending;
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.merchant_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{req.reason || "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs font-mono">{req.webhook_url || "—"}</TableCell>
                      <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(req.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        {req.status === "pending" ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Admin notes (optional)..."
                              value={adminNotes[req.id] || ""}
                              onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="text-xs h-16 min-h-0"
                            />
                            <div className="flex gap-1 whitespace-nowrap">
                              <Button size="sm" disabled={processing === req.id} onClick={() => handleAction(req.id, "approved", req.merchant_id)}>
                                <Key className="w-3 h-3 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" disabled={processing === req.id} onClick={() => handleAction(req.id, "rejected", req.merchant_id)}>
                                Reject
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{req.admin_notes || "—"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
