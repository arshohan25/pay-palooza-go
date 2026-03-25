import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Webhook, Send, CheckCircle, XCircle, Edit2, Save, X, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface WebhookKey {
  id: string;
  merchant_id: string;
  api_key: string;
  webhook_url: string | null;
  is_active: boolean;
  merchant_name?: string;
}

export default function AdminApiWebhooks({ search }: { search: string }) {
  const [keys, setKeys] = useState<WebhookKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: number; time: number } | { error: string }>>({});

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data: keyData } = await (supabase as any)
      .from("merchant_api_keys")
      .select("id, merchant_id, api_key, webhook_url, is_active")
      .order("created_at", { ascending: false });

    if (!keyData) { setKeys([]); setLoading(false); return; }

    const merchantIds = [...new Set((keyData as any[]).map((k: any) => k.merchant_id))];
    const { data: merchants } = await supabase
      .from("merchants")
      .select("id, business_name")
      .in("id", merchantIds);

    const nameMap = Object.fromEntries((merchants ?? []).map(m => [m.id, m.business_name]));
    setKeys((keyData as any[]).map((k: any) => ({ ...k, merchant_name: nameMap[k.merchant_id] || "Unknown" })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const filtered = keys.filter(k => {
    if (!search) return true;
    const s = search.toLowerCase();
    return k.merchant_name?.toLowerCase().includes(s) || k.webhook_url?.toLowerCase().includes(s);
  });

  const configured = keys.filter(k => k.webhook_url);
  const active = configured.filter(k => k.is_active);

  const saveWebhookUrl = async (keyId: string) => {
    const { error } = await (supabase as any)
      .from("merchant_api_keys")
      .update({ webhook_url: editUrl || null })
      .eq("id", keyId);

    if (error) { toast.error("Failed to update webhook URL"); return; }
    toast.success("Webhook URL updated");
    setEditingId(null);
    fetchKeys();
  };

  const testWebhook = async (key: WebhookKey) => {
    if (!key.webhook_url) { toast.error("No webhook URL configured"); return; }
    setTesting(key.id);
    const start = Date.now();
    try {
      const res = await fetch(key.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test",
          session_id: "test_" + crypto.randomUUID().slice(0, 8),
          amount: 100,
          status: "completed",
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      });
      const elapsed = Date.now() - start;
      setTestResults(prev => ({ ...prev, [key.id]: { status: res.status, time: elapsed } }));
      toast.success(`Webhook responded ${res.status} in ${elapsed}ms`);
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [key.id]: { error: err.message || "Failed" } }));
      toast.error("Webhook test failed: " + (err.message || "Timeout"));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Webhook className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{configured.length}</p>
              <p className="text-xs text-muted-foreground">Configured</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{active.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-foreground">{keys.length - configured.length}</p>
              <p className="text-xs text-muted-foreground">No Webhook</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Webhook URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Test Result</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No API keys found</TableCell></TableRow>
            ) : filtered.map(key => {
              const result = testResults[key.id];
              return (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.merchant_name}</TableCell>
                  <TableCell className="max-w-[250px]">
                    {editingId === key.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          placeholder="https://..."
                          className="h-7 text-xs"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveWebhookUrl(key.id)}>
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs font-mono truncate block">{key.webhook_url || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.is_active ? "default" : "secondary"}>
                      {key.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {result ? (
                      "error" in result ? (
                        <span className="text-destructive">{result.error}</span>
                      ) : (
                        <span className={result.status < 300 ? "text-emerald-600" : "text-amber-600"}>
                          {result.status} • {result.time}ms
                        </span>
                      )
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingId(key.id); setEditUrl(key.webhook_url || ""); }}>
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!key.webhook_url || testing === key.id}
                        onClick={() => testWebhook(key)}
                      >
                        {testing === key.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                        Test
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
