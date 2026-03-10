import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { toast } from "sonner";
import {
  Wifi, WifiOff, Loader2, Pencil, Save, X, Plus, Eye, EyeOff, Zap, AlertCircle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface ApiConfig {
  id: string;
  operator: string;
  display_name: string;
  api_base_url: string | null;
  config: Record<string, string>;
  is_enabled: boolean;
  last_tested: string | null;
  test_status: string | null;
  created_at: string;
  updated_at: string;
}

const OPERATOR_LOGOS: Record<string, string> = {
  Grameenphone: "/operators/gp.png",
  Robi: "/operators/robi.png",
  Banglalink: "/operators/bl.png",
  Teletalk: "/operators/tt.png",
  Airtel: "/operators/airtel.png",
};

const OPERATOR_COLORS: Record<string, string> = {
  Grameenphone: "#2FB5EA",
  Robi: "#E40046",
  Banglalink: "#E87A1E",
  Teletalk: "#7BB31A",
  Airtel: "#ED1C24",
};

const DEFAULT_CREDENTIAL_FIELDS: Record<string, string[]> = {
  Grameenphone: ["API_KEY", "API_SECRET", "MERCHANT_ID"],
  Robi: ["API_KEY", "API_SECRET", "MERCHANT_ID"],
  Banglalink: ["API_KEY", "API_SECRET", "MERCHANT_ID"],
  Teletalk: ["API_KEY", "API_SECRET", "MERCHANT_ID"],
  Airtel: ["API_KEY", "API_SECRET", "MERCHANT_ID"],
};

/** Call the manage-gateway-config edge function for recharge_api_configs */
async function callRechargeApi(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("manage-gateway-config", {
    body: { ...body, table: "recharge_api_configs" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminRechargeApiConnect() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCfg, setEditCfg] = useState<ApiConfig | null>(null);
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const { visible, flash } = useRealtimeIndicator();

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callRechargeApi({ action: "list" });
      setConfigs(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load API configs");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("admin-recharge-api")
      .on("postgres_changes", { event: "*", schema: "public", table: "recharge_api_configs" }, () => { loadConfigs(); flash(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadConfigs]);

  const toggleEnabled = async (cfg: ApiConfig) => {
    try {
      await callRechargeApi({ action: "toggle", id: cfg.id, is_enabled: !cfg.is_enabled });
      toast.success(`${cfg.display_name} ${!cfg.is_enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const openEdit = (cfg: ApiConfig) => {
    setEditCfg(cfg);
    setEditBaseUrl(cfg.api_base_url ?? "");
    const fields = DEFAULT_CREDENTIAL_FIELDS[cfg.operator] ?? [];
    const config: Record<string, string> = {};
    fields.forEach(f => { config[f] = (cfg.config as any)?.[f] ?? ""; });
    Object.keys(cfg.config || {}).forEach(k => { if (!config[k]) config[k] = (cfg.config as any)[k]; });
    setEditConfig(config);
    setShowSecrets({});
  };

  const saveConfig = async () => {
    if (!editCfg) return;
    setSaving(true);
    try {
      await callRechargeApi({
        action: "update_config",
        id: editCfg.id,
        api_base_url: editBaseUrl || null,
        config: editConfig,
      });
      toast.success("Configuration saved");
      setEditCfg(null);
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const testConnection = async (cfg: ApiConfig) => {
    setTesting(cfg.id);
    try {
      const { data, error } = await supabase.functions.invoke("test-recharge-api", {
        body: { operator: cfg.operator, config_id: cfg.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`${cfg.display_name} connection successful`);
      } else {
        toast.error(`${cfg.display_name} connection failed: ${data?.error || "Unknown error"}`);
      }
    } catch (e: any) {
      toast.error(`Test failed: ${e.message || "Network error"}`);
    }
    setTesting(null);
  };

  const addConfigField = () => {
    const key = prompt("Enter credential key name (e.g. CALLBACK_URL):");
    if (key?.trim()) setEditConfig(prev => ({ ...prev, [key.trim()]: "" }));
  };

  const removeConfigField = (key: string) => {
    setEditConfig(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const getStatusBadge = (cfg: ApiConfig) => {
    if (!cfg.api_base_url && Object.keys(cfg.config || {}).every(k => !(cfg.config as any)[k])) {
      return <Badge variant="secondary" className="text-xs gap-1"><AlertCircle className="w-3 h-3" /> Not Configured</Badge>;
    }
    if (cfg.test_status === "success") {
      return <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</Badge>;
    }
    if (cfg.test_status === "failed") {
      return <Badge variant="destructive" className="text-xs gap-1"><AlertCircle className="w-3 h-3" /> Failed</Badge>;
    }
    return <Badge variant="outline" className="text-xs gap-1">Configured</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Operator API Connect</h3>
        <p className="text-sm text-muted-foreground">Configure real-time recharge APIs for each mobile operator</p>
        <RealtimeUpdateIndicator visible={visible} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configs.map(cfg => (
          <Card key={cfg.id} className={`border shadow-[var(--shadow-card)] transition-opacity ${!cfg.is_enabled ? "opacity-60" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                    style={{ background: OPERATOR_COLORS[cfg.operator] ?? "hsl(var(--primary))" }}
                  >
                    <div className="w-[80%] h-[80%] rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <img
                        src={OPERATOR_LOGOS[cfg.operator]}
                        alt={cfg.operator}
                        className="w-[75%] h-[75%] object-contain"
                        onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="block text-sm font-bold">{cfg.display_name}</span>
                    <span className="block text-xs text-muted-foreground">{cfg.operator}</span>
                  </div>
                </CardTitle>
                <Switch
                  checked={cfg.is_enabled}
                  onCheckedChange={() => toggleEnabled(cfg)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {cfg.is_enabled ? (
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1">
                    <Wifi className="w-3 h-3" /> Live
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <WifiOff className="w-3 h-3" /> Off
                  </Badge>
                )}
                {getStatusBadge(cfg)}
              </div>
              {cfg.last_tested && (
                <p className="text-xs text-muted-foreground">
                  Last tested: {new Date(cfg.last_tested).toLocaleString()}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => openEdit(cfg)}>
                  <Pencil className="w-3 h-3" /> Configure
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                  onClick={() => testConnection(cfg)}
                  disabled={testing === cfg.id}
                >
                  {testing === cfg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {configs.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No operator configs found</p>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editCfg} onOpenChange={(o) => { if (!o) setEditCfg(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure {editCfg?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input
                placeholder="https://api.operator.com/v1"
                value={editBaseUrl}
                onChange={e => setEditBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">The base endpoint for recharge requests</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Credentials</Label>
                <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={addConfigField}>
                  <Plus className="w-3 h-3" /> Add Field
                </Button>
              </div>
              {Object.entries(editConfig).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">{key}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowSecrets(p => ({ ...p, [key]: !p[key] }))}>
                        {showSecrets[key] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => removeConfigField(key)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    type={showSecrets[key] ? "text" : "password"}
                    value={val}
                    onChange={e => setEditConfig(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={val?.startsWith("••") ? "Enter new value to replace" : "Enter value…"}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
              {Object.keys(editConfig).length === 0 && (
                <p className="text-xs text-muted-foreground">No credentials added. Click "Add Field" above.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCfg(null)}>Cancel</Button>
            <Button onClick={saveConfig} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
