import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Key, Copy, CheckCircle2, Globe, Code, Clock, AlertTriangle, RefreshCw, Shield,
  Webhook, ChevronDown, ChevronUp, Send, Loader2, BarChart3, Plus, Trash2, ShieldCheck,
  Activity, Zap, XCircle, QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from "recharts";

// ─── Credential generators (client-side, crypto.getRandomValues) ───
const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const genApiKey = (env: "live" | "test") =>
  `${env}_pk_${toHex(crypto.getRandomValues(new Uint8Array(24)))}`;
const genSecretKey = (env: "live" | "test") =>
  `${env}_sk_${toHex(crypto.getRandomValues(new Uint8Array(32)))}`;
const genAppPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/[+/=]/g, "").slice(0, 24);
};

const MAX_ACTIVE_KEYS = 5;

interface ApiKey {
  id: string;
  api_key: string;
  secret_key: string;
  app_password: string | null;
  webhook_url: string | null;
  is_active: boolean;
  environment: string;
  rotation_expires_at: string | null;
  created_at: string;
}

interface ApiRequest {
  id: string;
  status: string;
  webhook_url: string | null;
  reason: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface PaymentSession {
  id: string;
  amount: number;
  currency: string;
  reference: string | null;
  status: string;
  customer_phone: string | null;
  webhook_delivered: boolean;
  webhook_attempts: number;
  webhook_next_retry_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const ANALYTICS_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "#f59e0b"];
const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6b7280"];

interface ApiLog {
  action: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string | null;
  created_at: string;
  error_message: string | null;
}

interface IpWhitelistEntry {
  id: string;
  ip_address: string;
  label: string | null;
  created_at: string;
}

const MerchantApiTab = React.forwardRef<HTMLDivElement, { merchantId: string }>(({ merchantId }, ref) => {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [ipWhitelist, setIpWhitelist] = useState<IpWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [analyticsRange, setAnalyticsRange] = useState<"24h" | "7d" | "30d">("7d");
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showIpWhitelist, setShowIpWhitelist] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newIpLabel, setNewIpLabel] = useState("");
  const [addingIp, setAddingIp] = useState(false);

  // Request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestWebhook, setRequestWebhook] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Webhook editing
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  // Credential manager
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyEnv, setNewKeyEnv] = useState<"live" | "test">("live");
  const [confirmAction, setConfirmAction] = useState<
    | { kind: "rotate"; keyId: string }
    | { kind: "revoke"; keyId: string }
    | { kind: "delete"; keyId: string }
    | null
  >(null);
  const [actionPending, setActionPending] = useState(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const rangeCutoff = analyticsRange === "24h" ? 1 : analyticsRange === "7d" ? 7 : 30;
    const cutoffDate = new Date(Date.now() - rangeCutoff * 86400000).toISOString();

    const [keysRes, reqRes, sessRes, logsRes, ipRes] = await Promise.all([
      supabase.from("merchant_api_keys").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      (supabase as any).from("merchant_api_requests").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      supabase.from("merchant_payment_sessions").select("id, amount, currency, reference, status, customer_phone, webhook_delivered, webhook_attempts, webhook_next_retry_at, completed_at, expires_at, created_at")
        .eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("merchant_api_logs").select("action, status_code, response_time_ms, ip_address, created_at, error_message")
        .eq("merchant_id", merchantId).gte("created_at", cutoffDate).order("created_at", { ascending: false }).limit(1000),
      (supabase as any).from("merchant_ip_whitelist").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
    ]);
    setKeys((keysRes.data || []) as ApiKey[]);
    setRequests((reqRes.data || []) as unknown as ApiRequest[]);
    setSessions((sessRes.data || []) as PaymentSession[]);
    setApiLogs((logsRes.data || []) as ApiLog[]);
    setIpWhitelist((ipRes.data || []) as IpWhitelistEntry[]);
    setLoading(false);
  }, [merchantId, analyticsRange]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch = supabase
      .channel("merchant-api-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_payment_sessions", filter: `merchant_id=eq.${merchantId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_api_requests", filter: `merchant_id=eq.${merchantId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_api_keys", filter: `merchant_id=eq.${merchantId}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, loadData]);

  const submitRequest = async () => {
    setSubmitting(true);
    const { error } = await (supabase as any).from("merchant_api_requests").insert({
      merchant_id: merchantId,
      webhook_url: requestWebhook || null,
      reason: requestReason || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed to submit request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "API Access Requested", description: "Your request has been submitted for admin review." });
    setShowRequestForm(false);
    setRequestWebhook("");
    setRequestReason("");
    loadData();
  };

  const updateWebhook = async (keyId: string) => {
    await supabase.from("merchant_api_keys").update({ webhook_url: webhookUrl || null, updated_at: new Date().toISOString() }).eq("id", keyId);
    toast({ title: "Webhook URL Updated" });
    setEditingKeyId(null);
    loadData();
  };

  // ─── Credential lifecycle ───
  const activeKeyCount = keys.filter(k => k.is_active).length;

  const createKey = async () => {
    if (activeKeyCount >= MAX_ACTIVE_KEYS) {
      toast({ title: "Limit reached", description: `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`, variant: "destructive" });
      return;
    }
    setCreatingKey(true);
    const { data, error } = await supabase
      .from("merchant_api_keys")
      .insert({
        merchant_id: merchantId,
        api_key: genApiKey(newKeyEnv),
        secret_key: genSecretKey(newKeyEnv),
        app_password: genAppPassword(),
        environment: newKeyEnv,
        is_active: true,
      } as any)
      .select("id")
      .single();
    setCreatingKey(false);
    if (error) {
      toast({ title: "Could not create key", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "API key created", description: "Copy your secret and app password now — they won't be shown again automatically." });
    setJustCreatedId(data?.id ?? null);
    if (data?.id) {
      setRevealedFields(prev => {
        const next = new Set(prev);
        next.add(`secret-${data.id}`);
        next.add(`apppw-${data.id}`);
        return next;
      });
    }
    await loadData();
  };

  const rotateKey = async (keyId: string) => {
    const existing = keys.find(k => k.id === keyId);
    if (!existing) return;
    const env = (existing.environment === "test" ? "test" : "live") as "live" | "test";
    setActionPending(true);
    const { error } = await supabase
      .from("merchant_api_keys")
      .update({
        api_key: genApiKey(env),
        secret_key: genSecretKey(env),
        app_password: genAppPassword(),
        rotation_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", keyId);
    setActionPending(false);
    setConfirmAction(null);
    if (error) {
      toast({ title: "Rotation failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Credentials rotated", description: "The previous key, secret and app password are no longer valid." });
    setRevealedFields(prev => {
      const next = new Set(prev);
      next.add(`secret-${keyId}`);
      next.add(`apppw-${keyId}`);
      return next;
    });
    setJustCreatedId(keyId);
    await loadData();
  };

  const revokeKey = async (keyId: string) => {
    setActionPending(true);
    const { error } = await supabase
      .from("merchant_api_keys")
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq("id", keyId);
    setActionPending(false);
    setConfirmAction(null);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Key revoked", description: "API calls using this key will be rejected." });
    await loadData();
  };

  const deleteKeyPermanently = async (keyId: string) => {
    setActionPending(true);
    const { error } = await supabase.from("merchant_api_keys").delete().eq("id", keyId);
    setActionPending(false);
    setConfirmAction(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Key deleted permanently" });
    await loadData();
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const retryWebhook = async (sessionId: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/merchant-payment-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error("Webhook delivery failed");
      toast({ title: "Webhook Retried", description: "Notification sent successfully." });
      loadData();
    } catch {
      toast({ title: "Retry Failed", description: "Could not deliver webhook. Check your URL.", variant: "destructive" });
    }
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const apiEndpoint = `https://${projectId}.supabase.co/functions/v1/merchant-payment-api`;

  const hasPendingRequest = requests.some(r => r.status === "pending");
  const hasActiveKey = keys.some(k => k.is_active);
  const hasApprovedAccess = requests.some(r => r.status === "approved") || hasActiveKey;
  const isRotating = (k: ApiKey) => !!k.rotation_expires_at && new Date(k.rotation_expires_at).getTime() > Date.now();

  // ─── Analytics computation ───
  const analytics = useMemo(() => {
    const total = apiLogs.length;
    const successful = apiLogs.filter(l => l.status_code >= 200 && l.status_code < 300).length;
    const failed = apiLogs.filter(l => l.status_code >= 400).length;
    const rateLimited = apiLogs.filter(l => l.status_code === 429).length;
    const avgResponseTime = total > 0 ? Math.round(apiLogs.reduce((s, l) => s + l.response_time_ms, 0) / total) : 0;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

    // Daily breakdown
    const dayMap: Record<string, { date: string; success: number; error: number; total: number; avgMs: number; count: number }> = {};
    apiLogs.forEach(l => {
      const day = new Date(l.created_at).toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { date: day, success: 0, error: 0, total: 0, avgMs: 0, count: 0 };
      dayMap[day].total++;
      dayMap[day].count++;
      dayMap[day].avgMs += l.response_time_ms;
      if (l.status_code >= 200 && l.status_code < 300) dayMap[day].success++;
      else dayMap[day].error++;
    });
    const daily = Object.values(dayMap).map(d => ({ ...d, avgMs: Math.round(d.avgMs / d.count) })).sort((a, b) => a.date.localeCompare(b.date));

    // Action breakdown
    const actionMap: Record<string, number> = {};
    apiLogs.forEach(l => { actionMap[l.action] = (actionMap[l.action] || 0) + 1; });
    const actionBreakdown = Object.entries(actionMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Top IPs
    const ipMap: Record<string, number> = {};
    apiLogs.forEach(l => { if (l.ip_address) ipMap[l.ip_address] = (ipMap[l.ip_address] || 0) + 1; });
    const topIps = Object.entries(ipMap).map(([ip, count]) => ({ ip, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    return { total, successful, failed, rateLimited, avgResponseTime, successRate, daily, actionBreakdown, topIps };
  }, [apiLogs]);

  // ─── IP Whitelist management ───
  const addIpAddress = async () => {
    if (!newIp.trim()) return;
    setAddingIp(true);
    const { error } = await (supabase as any).from("merchant_ip_whitelist").insert({
      merchant_id: merchantId,
      ip_address: newIp.trim(),
      label: newIpLabel.trim() || null,
    });
    setAddingIp(false);
    if (error) { toast({ title: "Failed to add IP", description: error.message, variant: "destructive" }); return; }
    toast({ title: "IP Address Added" });
    setNewIp(""); setNewIpLabel("");
    loadData();
  };

  const removeIp = async (id: string) => {
    await (supabase as any).from("merchant_ip_whitelist").delete().eq("id", id);
    toast({ title: "IP Address Removed" });
    loadData();
  };

  const toggleIpWhitelist = async (keyId: string, enabled: boolean) => {
    await supabase.from("merchant_api_keys").update({ ip_whitelist_enabled: enabled } as any).eq("id", keyId);
    toast({ title: enabled ? "IP Whitelisting Enabled" : "IP Whitelisting Disabled" });
    loadData();
  };

  const requestStatusColor: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    expired: "bg-muted text-muted-foreground border-border",
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div ref={ref} className="space-y-5">
      {/* API Access Requests */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Key size={15} className="text-primary" />API Access</h3>
          <div className="flex items-center gap-2">
            {hasApprovedAccess && (
              <>
                <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv("live")}
                    className={`px-2 py-1 rounded-md transition-colors ${newKeyEnv === "live" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >Live</button>
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv("test")}
                    className={`px-2 py-1 rounded-md transition-colors ${newKeyEnv === "test" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >Test</button>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={createKey}
                  disabled={creatingKey || activeKeyCount >= MAX_ACTIVE_KEYS}
                  title={activeKeyCount >= MAX_ACTIVE_KEYS ? `Limit of ${MAX_ACTIVE_KEYS} active keys reached` : undefined}
                >
                  {creatingKey ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  New Key
                </Button>
              </>
            )}
            {!hasPendingRequest && !hasActiveKey && !hasApprovedAccess && (
              <Button size="sm" onClick={() => setShowRequestForm(true)} className="h-8 text-xs gap-1"><Send size={12} />Request API Access</Button>
            )}
          </div>
        </div>

        {/* Request form */}
        {showRequestForm && (
          <Card className="p-4 mb-3 space-y-3">
            <p className="text-[11px] font-bold text-foreground">Request API Access</p>
            <p className="text-[10px] text-muted-foreground">Submit a request to the admin team. They will review and generate API keys for you.</p>
            <div>
              <label className="text-[10px] text-muted-foreground">Webhook URL (optional)</label>
              <Input className="h-8 text-xs mt-1" placeholder="https://yoursite.com/webhook" value={requestWebhook} onChange={e => setRequestWebhook(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Reason / Use Case</label>
              <Textarea className="text-xs mt-1 min-h-[60px]" placeholder="Describe how you plan to use the API…" value={requestReason} onChange={e => setRequestReason(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs gap-1" onClick={submitRequest} disabled={submitting}>
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}Submit Request
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowRequestForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {/* Request history */}
        {requests.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Your Requests</p>
            {requests.map(r => (
              <Card key={r.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge className={requestStatusColor[r.status] || requestStatusColor.pending}>{r.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.reason && <p className="text-[10px] text-muted-foreground mt-1">{r.reason}</p>}
                {r.admin_notes && (
                  <p className="text-[10px] text-foreground mt-1 bg-muted/50 rounded p-2">
                    <span className="font-semibold">Admin:</span> {r.admin_notes}
                  </p>
                )}
                {r.reviewed_at && <p className="text-[9px] text-muted-foreground mt-1">Reviewed: {new Date(r.reviewed_at).toLocaleString()}</p>}
              </Card>
            ))}
          </div>
        )}

        {/* Active API Keys (read-only) */}
        {keys.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Your API Credentials</p>
            {keys.map(k => {
              const toggleReveal = (field: string) => setRevealedFields(prev => {
                const next = new Set(prev);
                next.has(field) ? next.delete(field) : next.add(field);
                return next;
              });
              const maskValue = (val: string, field: string) => revealedFields.has(field) ? val : val.slice(0, 4) + "••••••••" + val.slice(-4);

              return (
                <Card key={k.id} className={`p-3 space-y-2 ${!k.is_active ? "opacity-70" : ""} ${justCreatedId === k.id ? "ring-2 ring-primary/40" : ""}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={k.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${k.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                        {k.is_active ? "Active" : "Revoked"}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] uppercase">{k.environment || "live"}</Badge>
                      {isRotating(k) && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] gap-1">
                          <RefreshCw size={9} />Rotated
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</span>
                  </div>
                  {!k.is_active && (
                    <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle size={10} />Revoked — API calls with these credentials will be rejected.</p>
                  )}
                  {justCreatedId === k.id && k.is_active && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-[10px] text-foreground flex items-start gap-2">
                      <ShieldCheck size={12} className="text-primary mt-0.5 shrink-0" />
                      <span>Copy your secret key and app password now. You can re-reveal them later, but rotate immediately if exposed.</span>
                    </div>
                  )}

                  {/* API Key */}
                  <div>
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-1">API Key</p>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                      <Key size={12} className="text-muted-foreground shrink-0" />
                      <code className="text-[10px] font-mono flex-1 truncate">{k.api_key}</code>
                      <button onClick={() => copyText(k.api_key, `apikey-${k.id}`)}>
                        {copiedField === `apikey-${k.id}` ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} className="text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  {/* App Password */}
                  {k.app_password && (
                    <div>
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-1">App Password</p>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                        <Shield size={12} className="text-muted-foreground shrink-0" />
                        <code className="text-[10px] font-mono flex-1 truncate">{maskValue(k.app_password, `apppw-${k.id}`)}</code>
                        <button onClick={() => toggleReveal(`apppw-${k.id}`)} className="text-muted-foreground hover:text-foreground">
                          {revealedFields.has(`apppw-${k.id}`) ? <Shield size={13} /> : <Shield size={13} />}
                        </button>
                        <button onClick={() => copyText(k.app_password!, `apppw-copy-${k.id}`)}>
                          {copiedField === `apppw-copy-${k.id}` ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} className="text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Secret Key */}
                  <div>
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-1">Secret Key <span className="text-[8px] font-normal">(for webhook verification)</span></p>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                      <Key size={12} className="text-muted-foreground shrink-0" />
                      <code className="text-[10px] font-mono flex-1 truncate">{maskValue(k.secret_key, `secret-${k.id}`)}</code>
                      <button onClick={() => toggleReveal(`secret-${k.id}`)} className="text-muted-foreground hover:text-foreground">
                        {revealedFields.has(`secret-${k.id}`) ? <Shield size={13} /> : <Shield size={13} />}
                      </button>
                      <button onClick={() => copyText(k.secret_key, `secret-copy-${k.id}`)}>
                        {copiedField === `secret-copy-${k.id}` ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} className="text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  {/* Webhook URL */}
                  <div className="flex items-center gap-2">
                    <Globe size={12} className="text-muted-foreground shrink-0" />
                    {editingKeyId === k.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input className="h-7 text-[10px]" placeholder="https://yoursite.com/webhook" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
                        <Button size="sm" className="h-7 text-[10px]" onClick={() => updateWebhook(k.id)}>Save</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="text-[10px] text-muted-foreground truncate">{k.webhook_url || "No webhook configured"}</span>
                        {k.is_active && (
                          <button onClick={() => { setEditingKeyId(k.id); setWebhookUrl(k.webhook_url || ""); }} className="text-[10px] text-primary font-medium shrink-0">Edit</button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {keys.length === 0 && requests.length === 0 && (
          <Card className="p-6 text-center">
            <Key size={28} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No API keys yet. Request access to start integrating.</p>
          </Card>
        )}
      </div>

      {/* Integration Guide */}
      <div>
        <button onClick={() => setShowDocs(!showDocs)} className="flex items-center gap-2 w-full text-left mb-2">
          <Code size={15} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground flex-1">Integration Guide</h3>
          {showDocs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showDocs && (
          <Card className="p-4 space-y-3">
            <div>
              <p className="text-[11px] font-bold text-foreground mb-1">API Endpoint</p>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                <code className="text-[10px] font-mono flex-1 break-all">{apiEndpoint}</code>
                <button onClick={() => copyText(apiEndpoint, "endpoint")}>
                  {copiedField === "endpoint" ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} className="text-muted-foreground" />}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-foreground mb-1">Create Payment Session (JavaScript)</p>
              <pre className="bg-muted/50 rounded-lg p-3 text-[9px] font-mono overflow-x-auto whitespace-pre">{`const res = await fetch('${apiEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here',
    'X-App-Password': 'your_app_password_here'
  },
  body: JSON.stringify({
    action: 'create_session',
    amount: 500,
    reference: 'ORDER-123',
    description: 'Product purchase',
    success_url: 'https://yoursite.com/success',
    cancel_url: 'https://yoursite.com/cancel'
  })
});
const { checkout_url, session_id } = await res.json();
window.location.href = checkout_url;`}</pre>
            </div>

            <div>
              <p className="text-[11px] font-bold text-foreground mb-1">Check Payment Status</p>
              <pre className="bg-muted/50 rounded-lg p-3 text-[9px] font-mono overflow-x-auto whitespace-pre">{`const res = await fetch('${apiEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here',
    'X-App-Password': 'your_app_password_here'
  },
  body: JSON.stringify({
    action: 'check_status',
    session_id: 'session_id_here'
  })
});
const { session } = await res.json();
console.log(session.status); // pending|completed|failed|expired`}</pre>
            </div>

            <div>
              <p className="text-[11px] font-bold text-foreground mb-1">Webhook Verification (Node.js)</p>
              <pre className="bg-muted/50 rounded-lg p-3 text-[9px] font-mono overflow-x-auto whitespace-pre">{`const crypto = require('crypto');

function verifySignature(body, signature, secretKey) {
  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(body)
    .digest('hex');
  return expected === signature;
}

// In your webhook handler:
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-easypay-signature'];
  if (!verifySignature(JSON.stringify(req.body), sig, SECRET_KEY)) {
    return res.status(401).send('Invalid signature');
  }
  // Process payment notification...
});`}</pre>
            </div>

            <div className="border-t border-border pt-3 mt-3">
              <p className="text-[11px] font-bold text-foreground mb-1 flex items-center gap-1.5">
                <QrCode size={12} className="text-primary" />Dynamic QR Integration (UPI-style)
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">
                Display a dynamic QR code on your checkout page. Customers scan it with the EasyPay app to pay instantly — no redirect needed.
              </p>
              <pre className="bg-muted/50 rounded-lg p-3 text-[9px] font-mono overflow-x-auto whitespace-pre">{`<!-- 1. Include the SDK -->
<script src="https://pay-palooza-go.lovable.app/sdk/easypay-sdk.js"></script>

<div id="qr-container"></div>

<script>
  // Initialize
  EasyPay.init({
    apiKey: 'your_api_key_here',
    appPassword: 'your_app_password_here',
    endpoint: '${apiEndpoint}'
  });

  // Step 1: Create a payment session
  EasyPay.createPayment({
    amount: 500,
    reference: 'ORDER-123',
    description: 'Product purchase'
  }).then(function(session) {

    // Step 2: Display the QR code
    EasyPay.displayQR('#qr-container', session, {
      onSuccess: function(result) {
        alert('Payment received! ID: ' + result.id);
        window.location.href = '/order-success';
      },
      onExpired: function() {
        alert('QR expired. Please try again.');
      }
    });

  });
</script>`}</pre>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => copyText(`EasyPay.displayQR('#qr-container', session, { onSuccess: fn, onExpired: fn });`, "qr-snippet")} className="text-[10px] text-primary font-semibold flex items-center gap-1">
                  {copiedField === "qr-snippet" ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  Copy QR snippet
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-3 mt-3">
              <p className="text-[11px] font-bold text-foreground mb-1 flex items-center gap-1.5">
                <Globe size={12} className="text-primary" />SDK Widget (Embed on any website)
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">
                Add a "Pay with EasyPay" button to your website with a single script tag:
              </p>
              <pre className="bg-muted/50 rounded-lg p-3 text-[9px] font-mono overflow-x-auto whitespace-pre">{`<!-- 1. Include the SDK -->
<script src="https://pay-palooza-go.lovable.app/sdk/easypay-sdk.js"></script>

<!-- 2. Add a container for the button -->
<div id="easypay-button"></div>

<!-- 3. Initialize and render -->
<script>
  EasyPay.init({
    apiKey: 'your_api_key_here',
    appPassword: 'your_app_password_here',
    endpoint: '${apiEndpoint}'
  });

  EasyPay.renderButton('#easypay-button', {
    amount: 500,
    reference: 'ORDER-123',
    description: 'Product purchase',
    successUrl: 'https://yoursite.com/success',
    cancelUrl: 'https://yoursite.com/cancel',
    onError: function(err) { alert(err.message); }
  });
</script>`}</pre>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => copyText(`<script src="https://pay-palooza-go.lovable.app/sdk/easypay-sdk.js"></script>`, "sdk-tag")} className="text-[10px] text-primary font-semibold flex items-center gap-1">
                  {copiedField === "sdk-tag" ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  Copy script tag
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ═══ API USAGE ANALYTICS ═══ */}
      {hasActiveKey && (
        <div>
          <button onClick={() => setShowAnalytics(!showAnalytics)} className="flex items-center gap-2 w-full text-left mb-2">
            <BarChart3 size={15} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground flex-1">API Usage Analytics</h3>
            {showAnalytics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAnalytics && (
            <div className="space-y-3">
              {/* Range selector */}
              <div className="flex gap-1">
                {(["24h", "7d", "30d"] as const).map(r => (
                  <Button key={r} size="sm" variant={analyticsRange === r ? "default" : "outline"} className="h-7 text-[10px] px-3"
                    onClick={() => setAnalyticsRange(r)}>{r === "24h" ? "24 Hours" : r === "7d" ? "7 Days" : "30 Days"}</Button>
                ))}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 text-center">
                  <Activity size={16} className="text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{analytics.total}</p>
                  <p className="text-[9px] text-muted-foreground">Total Requests</p>
                </Card>
                <Card className="p-3 text-center">
                  <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{analytics.successRate}%</p>
                  <p className="text-[9px] text-muted-foreground">Success Rate</p>
                </Card>
                <Card className="p-3 text-center">
                  <Zap size={16} className="text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{analytics.avgResponseTime}ms</p>
                  <p className="text-[9px] text-muted-foreground">Avg Response</p>
                </Card>
                <Card className="p-3 text-center">
                  <XCircle size={16} className="text-destructive mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{analytics.failed}</p>
                  <p className="text-[9px] text-muted-foreground">Errors</p>
                </Card>
              </div>

              {/* Requests chart */}
              {analytics.daily.length > 0 && (
                <Card className="p-3">
                  <p className="text-[10px] font-bold text-foreground mb-2">Requests Per Day</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={analytics.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 8 }} />
                      <ReTooltip contentStyle={{ fontSize: 10 }} />
                      <Bar dataKey="success" stackId="a" fill="#10b981" name="Success" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="error" stackId="a" fill="hsl(var(--destructive))" name="Error" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Response time chart */}
              {analytics.daily.length > 0 && (
                <Card className="p-3">
                  <p className="text-[10px] font-bold text-foreground mb-2">Avg Response Time (ms)</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={analytics.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 8 }} />
                      <ReTooltip contentStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="avgMs" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Avg ms" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Action breakdown + Top IPs */}
              <div className="grid grid-cols-2 gap-2">
                {analytics.actionBreakdown.length > 0 && (
                  <Card className="p-3">
                    <p className="text-[10px] font-bold text-foreground mb-2">By Action</p>
                    <div className="space-y-1">
                      {analytics.actionBreakdown.map(a => (
                        <div key={a.name} className="flex items-center justify-between">
                          <span className="text-[9px] text-muted-foreground font-mono">{a.name}</span>
                          <Badge variant="outline" className="text-[8px]">{a.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {analytics.topIps.length > 0 && (
                  <Card className="p-3">
                    <p className="text-[10px] font-bold text-foreground mb-2">Top IPs</p>
                    <div className="space-y-1">
                      {analytics.topIps.map(i => (
                        <div key={i.ip} className="flex items-center justify-between">
                          <span className="text-[9px] text-muted-foreground font-mono truncate">{i.ip}</span>
                          <Badge variant="outline" className="text-[8px]">{i.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {analytics.rateLimited > 0 && (
                <Card className="p-2 bg-amber-500/5 border-amber-500/20">
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={10} /> {analytics.rateLimited} rate-limited requests in this period
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ IP WHITELIST ═══ */}
      {hasActiveKey && (
        <div>
          <button onClick={() => setShowIpWhitelist(!showIpWhitelist)} className="flex items-center gap-2 w-full text-left mb-2">
            <ShieldCheck size={15} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground flex-1">IP Whitelisting</h3>
            {showIpWhitelist ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showIpWhitelist && (
            <Card className="p-4 space-y-3">
              <p className="text-[10px] text-muted-foreground">
                When enabled, only requests from whitelisted IP addresses will be accepted. Add your server IPs below.
              </p>

              {/* Toggle per key */}
              {keys.filter(k => k.is_active).map(k => (
                <div key={k.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                  <div>
                    <p className="text-[10px] font-mono text-foreground">{k.api_key.slice(0, 12)}…</p>
                    <p className="text-[9px] text-muted-foreground">IP Whitelist: {(k as any).ip_whitelist_enabled ? "Enabled" : "Disabled"}</p>
                  </div>
                  <Button size="sm" variant={(k as any).ip_whitelist_enabled ? "default" : "outline"} className="h-7 text-[10px]"
                    onClick={() => toggleIpWhitelist(k.id, !(k as any).ip_whitelist_enabled)}>
                    {(k as any).ip_whitelist_enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              ))}

              {/* Whitelist entries */}
              {ipWhitelist.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-foreground">Whitelisted IPs</p>
                  {ipWhitelist.map(ip => (
                    <div key={ip.id} className="flex items-center justify-between bg-muted/30 rounded p-2">
                      <div>
                        <code className="text-[10px] font-mono text-foreground">{ip.ip_address}</code>
                        {ip.label && <span className="text-[9px] text-muted-foreground ml-2">{ip.label}</span>}
                      </div>
                      <button onClick={() => removeIp(ip.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new IP */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[9px] text-muted-foreground">IP Address</label>
                  <Input className="h-7 text-[10px] mt-0.5" placeholder="203.0.113.50" value={newIp} onChange={e => setNewIp(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-muted-foreground">Label (optional)</label>
                  <Input className="h-7 text-[10px] mt-0.5" placeholder="Production server" value={newIpLabel} onChange={e => setNewIpLabel(e.target.value)} />
                </div>
                <Button size="sm" className="h-7 text-[10px] gap-1" onClick={addIpAddress} disabled={addingIp || !newIp.trim()}>
                  {addingIp ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}Add
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Recent Sessions / API Logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Webhook size={15} className="text-primary" />API Payment Sessions</h3>
          <Badge variant="outline" className="text-[9px]">{sessions.length} sessions</Badge>
        </div>

        {sessions.length === 0 ? (
          <Card className="p-6 text-center">
            <Shield size={28} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No API payment sessions yet.</p>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {sessions.map(s => (
              <Card key={s.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={statusColor[s.status] || statusColor.pending}>{s.status}</Badge>
                    {s.status === "completed" && (
                      s.webhook_delivered ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px]">
                          <CheckCircle2 size={8} className="mr-0.5" />Webhook Sent
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[8px]">
                          <AlertTriangle size={8} className="mr-0.5" />
                          {s.webhook_attempts > 0 ? `Failed (${s.webhook_attempts} tries)` : "Pending"}
                        </Badge>
                      )
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">৳{fmt(s.amount)}</p>
                    {s.reference && <p className="text-[10px] text-muted-foreground">Ref: {s.reference}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {s.customer_phone && <span className="text-[10px] text-muted-foreground">{s.customer_phone}</span>}
                    {s.status === "completed" && !s.webhook_delivered && (
                      <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1 px-2" onClick={() => retryWebhook(s.id)}>
                        <RefreshCw size={10} />Retry
                      </Button>
                    )}
                  </div>
                </div>
                {s.status === "completed" && !s.webhook_delivered && s.webhook_next_retry_at && (
                  <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock size={9} />Next auto-retry: {new Date(s.webhook_next_retry_at).toLocaleString()}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MerchantApiTab.displayName = "MerchantApiTab";

export default MerchantApiTab;
