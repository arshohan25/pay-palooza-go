import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Terminal, Clock, Copy, Loader2 } from "lucide-react";

const ACTIONS = [
  { value: "create_session", label: "Create Payment Session", sample: { action: "create_session", amount: 500, reference: "TEST-001", description: "Test payment", customer_phone: "01700000000" } },
  { value: "check_status", label: "Check Session Status", sample: { action: "check_status", session_id: "<paste-session-id>" } },
  { value: "list_sessions", label: "List Sessions", sample: { action: "list_sessions", page: 1, limit: 10 } },
];

interface ApiKey {
  id: string;
  merchant_id: string;
  api_key: string;
  app_password: string | null;
  is_active: boolean;
  merchant_name?: string;
}

export default function AdminApiSandbox() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedAction, setSelectedAction] = useState("create_session");
  const [requestBody, setRequestBody] = useState(JSON.stringify(ACTIONS[0].sample, null, 2));
  const [response, setResponse] = useState<{ status: number; body: string; time: number } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data: keyData } = await (supabase as any)
      .from("merchant_api_keys")
      .select("id, merchant_id, api_key, app_password, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!keyData) { setKeys([]); setLoading(false); return; }

    const merchantIds = [...new Set((keyData as any[]).map((k: any) => k.merchant_id))];
    const { data: merchants } = await supabase
      .from("merchants")
      .select("id, business_name")
      .in("id", merchantIds);

    const nameMap = Object.fromEntries((merchants ?? []).map(m => [m.id, m.business_name]));
    const enriched = (keyData as any[]).map((k: any) => ({ ...k, merchant_name: nameMap[k.merchant_id] || "Unknown" }));
    setKeys(enriched);
    if (enriched.length > 0 && !selectedKeyId) setSelectedKeyId(enriched[0].id);
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleActionChange = (action: string) => {
    setSelectedAction(action);
    const found = ACTIONS.find(a => a.value === action);
    if (found) setRequestBody(JSON.stringify(found.sample, null, 2));
  };

  const execute = async () => {
    const key = keys.find(k => k.id === selectedKeyId);
    if (!key) { toast.error("Select an API key"); return; }

    let parsed: any;
    try { parsed = JSON.parse(requestBody); } catch { toast.error("Invalid JSON body"); return; }

    setExecuting(true);
    setResponse(null);
    const start = Date.now();

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-payment-api`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": key.api_key,
          "X-App-Password": key.app_password || "",
        },
        body: JSON.stringify(parsed),
      });
      const elapsed = Date.now() - start;
      const text = await res.text();
      let formatted: string;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { formatted = text; }
      setResponse({ status: res.status, body: formatted, time: elapsed });
    } catch (err: any) {
      setResponse({ status: 0, body: err.message || "Network error", time: Date.now() - start });
    } finally {
      setExecuting(false);
    }
  };

  const statusColor = (s: number) => s >= 200 && s < 300 ? "text-emerald-600" : s >= 400 ? "text-destructive" : "text-amber-600";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" /> API Sandbox
          </CardTitle>
          <p className="text-xs text-muted-foreground">Test merchant API calls directly from the admin panel</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key + Action selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">API Key</label>
              <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={loading ? "Loading..." : "Select key"} />
                </SelectTrigger>
                <SelectContent>
                  {keys.map(k => (
                    <SelectItem key={k.id} value={k.id} className="text-xs">
                      {k.merchant_name} — {k.api_key.slice(0, 12)}…
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Action</label>
              <Select value={selectedAction} onValueChange={handleActionChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Request body */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Request Body (JSON)</label>
            <Textarea
              value={requestBody}
              onChange={e => setRequestBody(e.target.value)}
              className="font-mono text-xs min-h-[120px]"
              spellCheck={false}
            />
          </div>

          <Button onClick={execute} disabled={executing || !selectedKeyId} className="w-full">
            {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Execute Request
          </Button>
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Response
                <Badge variant={response.status >= 200 && response.status < 300 ? "default" : "destructive"}>
                  {response.status || "ERR"}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {response.time}ms
                </span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(response.body); toast.success("Copied"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className={`text-xs font-mono whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-[300px] overflow-auto ${statusColor(response.status)}`}>
              {response.body}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
