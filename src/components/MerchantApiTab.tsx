import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Key, Plus, Trash2, Copy, CheckCircle2, Globe, Eye, EyeOff,
  Code, ExternalLink, Clock, AlertTriangle, RefreshCw, Shield,
  Webhook, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ApiKey {
  id: string;
  api_key: string;
  secret_key: string;
  webhook_url: string | null;
  is_active: boolean;
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
  completed_at: string | null;
  expires_at: string;
  created_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const MerchantApiTab = ({ merchantId }: { merchantId: string }) => {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSecret, setShowNewSecret] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [keysRes, sessRes] = await Promise.all([
      supabase.from("merchant_api_keys").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      supabase.from("merchant_payment_sessions").select("id, amount, currency, reference, status, customer_phone, webhook_delivered, completed_at, expires_at, created_at")
        .eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(50),
    ]);
    setKeys((keysRes.data || []) as ApiKey[]);
    setSessions((sessRes.data || []) as PaymentSession[]);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime for sessions
  useEffect(() => {
    const ch = supabase
      .channel("merchant-api-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_payment_sessions", filter: `merchant_id=eq.${merchantId}` },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, loadData]);

  const generateKey = async () => {
    const apiKey = "epk_" + crypto.randomUUID().replace(/-/g, "");
    const secretKey = "eps_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const { data, error } = await supabase
      .from("merchant_api_keys")
      .insert({ merchant_id: merchantId, api_key: apiKey, secret_key: secretKey })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to generate key", description: error.message, variant: "destructive" });
      return;
    }

    setShowNewSecret(secretKey);
    toast({ title: "API Key Created", description: "Save your secret key — it won't be shown again." });
    loadData();
  };

  const revokeKey = async (id: string) => {
    await supabase.from("merchant_api_keys").delete().eq("id", id);
    toast({ title: "API Key Revoked" });
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

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const apiEndpoint = `https://${projectId}.supabase.co/functions/v1/merchant-payment-api`;

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
    <div className="space-y-5">
      {/* API Keys Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Key size={15} className="text-primary" />API Keys</h3>
          <Button size="sm" onClick={generateKey} className="h-8 text-xs gap-1"><Plus size={12} />Generate Key</Button>
        </div>

        {/* New secret alert */}
        {showNewSecret && (
          <Card className="p-3 mb-3 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-amber-700">Save your Secret Key now!</p>
                <p className="text-[10px] text-amber-600 mb-2">This will not be shown again.</p>
                <div className="flex items-center gap-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg p-2">
                  <code className="text-[10px] break-all flex-1 font-mono">{showNewSecret}</code>
                  <button onClick={() => copyText(showNewSecret, "secret")} className="shrink-0">
                    {copiedField === "secret" ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} className="text-amber-600" />}
                  </button>
                </div>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-[10px]" onClick={() => setShowNewSecret(null)}>I've saved it</Button>
              </div>
            </div>
          </Card>
        )}

        {keys.length === 0 ? (
          <Card className="p-6 text-center">
            <Key size={28} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No API keys yet. Generate one to start integrating.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <Card key={k.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={k.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}>
                      {k.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => revokeKey(k.id)}>
                    <Trash2 size={12} className="mr-1" />Revoke
                  </Button>
                </div>

                {/* API Key */}
                <div className="flex items-center gap-2 mb-2 bg-muted/50 rounded-lg p-2">
                  <code className="text-[10px] font-mono flex-1 truncate">{k.api_key}</code>
                  <button onClick={() => copyText(k.api_key, k.id)}>
                    {copiedField === k.id ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} className="text-muted-foreground" />}
                  </button>
                </div>

                {/* Webhook URL */}
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-muted-foreground shrink-0" />
                  {editingKeyId === k.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        className="h-7 text-[10px]"
                        placeholder="https://yoursite.com/webhook"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                      />
                      <Button size="sm" className="h-7 text-[10px]" onClick={() => updateWebhook(k.id)}>Save</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-[10px] text-muted-foreground truncate">{k.webhook_url || "No webhook configured"}</span>
                      <button onClick={() => { setEditingKeyId(k.id); setWebhookUrl(k.webhook_url || ""); }} className="text-[10px] text-primary font-medium shrink-0">Edit</button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
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
                  <div className="flex items-center gap-2">
                    <Badge className={statusColor[s.status] || statusColor.pending}>
                      {s.status}
                    </Badge>
                    {s.webhook_delivered && (
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[8px]">
                        <Webhook size={8} className="mr-0.5" />Delivered
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">৳{fmt(s.amount)}</p>
                    {s.reference && <p className="text-[10px] text-muted-foreground">Ref: {s.reference}</p>}
                  </div>
                  {s.customer_phone && (
                    <span className="text-[10px] text-muted-foreground">{s.customer_phone}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantApiTab;
