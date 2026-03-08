import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Key, Copy, CheckCircle2, Globe, Code, Clock, AlertTriangle, RefreshCw, Shield,
  Webhook, ChevronDown, ChevronUp, Send, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ApiKey {
  id: string;
  api_key: string;
  secret_key: string;
  webhook_url: string | null;
  is_active: boolean;
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

const MerchantApiTab = React.forwardRef<HTMLDivElement, { merchantId: string }>(({ merchantId }, ref) => {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestWebhook, setRequestWebhook] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Webhook editing
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [keysRes, reqRes, sessRes] = await Promise.all([
      supabase.from("merchant_api_keys").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      (supabase as any).from("merchant_api_requests").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      supabase.from("merchant_payment_sessions").select("id, amount, currency, reference, status, customer_phone, webhook_delivered, webhook_attempts, webhook_next_retry_at, completed_at, expires_at, created_at")
        .eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(50),
    ]);
    setKeys((keysRes.data || []) as ApiKey[]);
    setRequests((reqRes.data || []) as unknown as ApiRequest[]);
    setSessions((sessRes.data || []) as PaymentSession[]);
    setLoading(false);
  }, [merchantId]);

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
    const { error } = await supabase.from("merchant_api_requests").insert({
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Key size={15} className="text-primary" />API Access</h3>
          {!hasPendingRequest && !hasActiveKey && (
            <Button size="sm" onClick={() => setShowRequestForm(true)} className="h-8 text-xs gap-1"><Send size={12} />Request API Access</Button>
          )}
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
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Your API Keys</p>
            {keys.map(k => (
              <Card key={k.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={k.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}>
                    {k.is_active ? "Active" : "Revoked"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2 mb-2 bg-muted/50 rounded-lg p-2">
                  <code className="text-[10px] font-mono flex-1 truncate">{k.api_key}</code>
                  <button onClick={() => copyText(k.api_key, k.id)}>
                    {copiedField === k.id ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} className="text-muted-foreground" />}
                  </button>
                </div>

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
            ))}
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
    'X-API-Key': 'your_api_key_here'
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
    'X-API-Key': 'your_api_key_here'
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
