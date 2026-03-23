import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Globe, Wrench, AlertTriangle, DollarSign, Shield, Clock, Receipt, Zap, Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminSystemSettings() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" /> System Settings
      </h3>
      <Tabs defaultValue="app" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="app" className="text-xs">App Config</TabsTrigger>
          <TabsTrigger value="currency" className="text-xs">Currency</TabsTrigger>
          <TabsTrigger value="fees" className="text-xs">Fee Rules</TabsTrigger>
          <TabsTrigger value="txnrules" className="text-xs">Txn Rules</TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs">Maint.</TabsTrigger>
        </TabsList>
        <TabsContent value="app"><AppConfigTab /></TabsContent>
        <TabsContent value="currency"><CurrencyConfigTab /></TabsContent>
        <TabsContent value="fees"><FeeRulesTab /></TabsContent>
        <TabsContent value="txnrules"><TransactionRulesTab /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AppConfigTab() {
  const [toggles, setToggles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("global_feature_toggles").select("*").order("sort_order");
      setToggles(data ?? []);
      setLoading(false);
    })();
  }, []);

  const enabledCount = toggles.filter(t => t.is_enabled).length;
  const disabledCount = toggles.filter(t => !t.is_enabled).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Features</p><p className="text-lg font-bold text-foreground">{toggles.length}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Enabled</p><p className="text-lg font-bold text-emerald-600">{enabledCount}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Disabled</p><p className="text-lg font-bold text-destructive">{disabledCount}</p></CardContent></Card>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Platform Information</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs">App Name</p><p className="font-medium">EasyPay</p></div>
            <div><p className="text-muted-foreground text-xs">Version</p><p className="font-medium">2.0.0</p></div>
            <div><p className="text-muted-foreground text-xs">Platform</p><p className="font-medium">Progressive Web App</p></div>
            <div><p className="text-muted-foreground text-xs">Region</p><p className="font-medium">Bangladesh</p></div>
            <div><p className="text-muted-foreground text-xs">Regulator</p><p className="font-medium">Bangladesh Bank</p></div>
            <div><p className="text-muted-foreground text-xs">License</p><p className="font-medium">MFS License</p></div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Quick Feature Toggle Summary</p>
          <div className="divide-y divide-border/50">
            {toggles.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-foreground">{t.label}</p>
                  {t.description && <p className="text-[10px] text-muted-foreground">{t.description}</p>}
                </div>
                <Badge variant={t.is_enabled ? "default" : "secondary"} className="text-[10px]">{t.is_enabled ? "ON" : "OFF"}</Badge>
              </div>
            ))}
          </div>
          {toggles.length > 10 && <p className="text-[10px] text-muted-foreground text-center">+{toggles.length - 10} more — manage in Toggles tab</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function CurrencyConfigTab() {
  return (
    <div className="space-y-3">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-4">
          <p className="text-sm font-medium text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Currency Configuration</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs">Primary Currency</p><p className="font-bold text-lg">৳ BDT</p></div>
            <div><p className="text-muted-foreground text-xs">Currency Code</p><p className="font-medium">BDT</p></div>
            <div><p className="text-muted-foreground text-xs">Symbol</p><p className="font-medium">৳</p></div>
            <div><p className="text-muted-foreground text-xs">Decimal Places</p><p className="font-medium">2</p></div>
            <div><p className="text-muted-foreground text-xs">Grouping</p><p className="font-medium">Indian (1,00,000)</p></div>
            <div><p className="text-muted-foreground text-xs">Min Transaction</p><p className="font-medium">৳1</p></div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Exchange Rates (Reference)</p>
          <div className="space-y-2">
            {[
              { currency: "USD", rate: "110.50" },
              { currency: "EUR", rate: "120.30" },
              { currency: "GBP", rate: "140.80" },
              { currency: "INR", rate: "1.33" },
            ].map(r => (
              <div key={r.currency} className="flex items-center justify-between py-1.5 border-b border-border/30">
                <span className="text-xs font-medium">1 {r.currency}</span>
                <span className="text-xs text-muted-foreground">= ৳{r.rate}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Reference rates only — EasyPay operates in BDT exclusively</p>
        </CardContent>
      </Card>
    </div>
  );
}

function FeeRulesTab() {
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("fee_config").select("*").order("txn_type");
      setFees(data ?? []);
      setLoading(false);
    })();
  }, []);

  const toggleFee = async (id: string, active: boolean) => {
    await supabase.from("fee_config").update({ is_active: !active } as any).eq("id", id);
    setFees(prev => prev.map(f => f.id === id ? { ...f, is_active: !active } : f));
    toast.success(`Fee rule ${!active ? "activated" : "deactivated"}`);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Rules</p><p className="text-lg font-bold text-foreground">{fees.length}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Active</p><p className="text-lg font-bold text-emerald-600">{fees.filter(f => f.is_active).length}</p></CardContent></Card>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Txn Type</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Fee</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Range</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Active</th>
            </tr></thead>
            <tbody>
              {fees.map(f => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{f.txn_type}</Badge></td>
                  <td className="px-3 py-2.5 text-xs font-semibold">{f.fee_type === "percent" ? `${f.fee_value}%` : `৳${f.fee_value}`}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                    ৳{Number(f.min_amount ?? 0).toLocaleString()} — {f.max_amount ? `৳${Number(f.max_amount).toLocaleString()}` : "∞"}
                  </td>
                  <td className="px-3 py-2.5"><Switch checked={f.is_active} onCheckedChange={() => toggleFee(f.id, f.is_active)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && fees.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No fee rules configured</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionRulesTab() {
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<any[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    (async () => {
      setRulesLoading(true);
      const { data } = await supabase.from("transaction_safety_rules" as any).select("*").order("created_at");
      setRules(data ?? []);
      setRulesLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("transaction_limits" as any).select("*").order("txn_type");
      setLimits(data ?? []);
      setLoading(false);
    })();
  }, []);

  const toggleRule = async (rule: any) => {
    const newEnabled = !rule.is_enabled;
    await supabase.from("transaction_safety_rules" as any).update({ is_enabled: newEnabled, updated_at: new Date().toISOString() } as any).eq("id", rule.id);
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: newEnabled } : r));
    toast.success(`${rule.label} ${newEnabled ? "enabled" : "disabled"}`);
  };

  const saveDescription = async (rule: any) => {
    if (!editDesc.trim()) return;
    await supabase.from("transaction_safety_rules" as any).update({ description: editDesc.trim(), updated_at: new Date().toISOString() } as any).eq("id", rule.id);
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, description: editDesc.trim() } : r));
    setEditingId(null);
    toast.success("Rule description updated");
  };

  return (
    <div className="space-y-3">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Transaction Safety Rules</p>
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className="py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-xs font-medium text-foreground">{r.label}</p>
                    {editingId === r.id ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          className="h-7 text-[11px] flex-1"
                          autoFocus
                          onKeyDown={e => { if (e.key === "Enter") saveDescription(r); if (e.key === "Escape") setEditingId(null); }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveDescription(r)}>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <p className="text-[10px] text-muted-foreground">{r.description}</p>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { setEditingId(r.id); setEditDesc(r.description); }}
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    )}
                  </div>
                  <Switch checked={r.is_enabled} onCheckedChange={() => toggleRule(r)} />
                </div>
              </div>
            ))}
            {rulesLoading && <p className="text-xs text-muted-foreground text-center py-4">Loading rules...</p>}
            {!rulesLoading && rules.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No safety rules configured</p>}
          </div>
        </CardContent>
      </Card>

      {limits.length > 0 && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" /> Global Transaction Limits</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-2 py-2 font-medium text-xs">Type</th>
                <th className="text-left px-2 py-2 font-medium text-xs">Period</th>
                <th className="text-right px-2 py-2 font-medium text-xs">Max Amount</th>
                <th className="text-right px-2 py-2 font-medium text-xs">Max Count</th>
              </tr></thead>
              <tbody>
                {limits.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-2 py-2 text-xs">{l.txn_type}</td>
                    <td className="px-2 py-2 text-xs">{l.period}</td>
                    <td className="px-2 py-2 text-xs text-right">৳{Number(l.max_amount ?? 0).toLocaleString()}</td>
                    <td className="px-2 py-2 text-xs text-right">{l.max_count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MaintenanceTab() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("global_feature_toggles").select("is_enabled").eq("feature_key", "maintenance_mode").single();
      setMaintenanceMode(data?.is_enabled ?? false);
      setLoading(false);
    })();
  }, []);

  const toggleMaintenance = async () => {
    const newState = !maintenanceMode;
    const { data: existing } = await supabase.from("global_feature_toggles").select("id").eq("feature_key", "maintenance_mode").single();
    if (existing) {
      await supabase.from("global_feature_toggles").update({ is_enabled: newState }).eq("feature_key", "maintenance_mode");
    } else {
      await supabase.from("global_feature_toggles").insert({
        feature_key: "maintenance_mode", label: "Maintenance Mode",
        description: "When enabled, the platform shows a maintenance page to all users",
        is_enabled: newState, sort_order: 999,
      });
    }
    setMaintenanceMode(newState);
    toast.success(newState ? "Maintenance mode ENABLED" : "Maintenance mode DISABLED");
  };

  return (
    <div className="space-y-3">
      <Card className={`border-0 shadow-[var(--shadow-card)] ${maintenanceMode ? "bg-destructive/5 ring-1 ring-destructive/20" : ""}`}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${maintenanceMode ? "bg-destructive/20" : "bg-muted"}`}>
                <Wrench className={`w-5 h-5 ${maintenanceMode ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Show maintenance page to all users</p>
              </div>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={toggleMaintenance} />
          </div>
          {maintenanceMode && (
            <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="text-xs text-destructive font-medium">Platform is currently in maintenance mode</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> System Health</p>
          <div className="space-y-2">
            {[
              { label: "Database", status: "Operational", color: "bg-emerald-500" },
              { label: "Authentication", status: "Operational", color: "bg-emerald-500" },
              { label: "Edge Functions", status: "Operational", color: "bg-emerald-500" },
              { label: "File Storage", status: "Operational", color: "bg-emerald-500" },
              { label: "Realtime", status: "Operational", color: "bg-emerald-500" },
              { label: "SMS Gateway", status: "Operational", color: "bg-emerald-500" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-foreground">{s.label}</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Scheduled Jobs</p>
          <div className="space-y-2">
            {[
              { job: "Auto-purge deactivated users", schedule: "Daily 2:00 AM", status: "Active" },
              { job: "Expire payment sessions", schedule: "Every 5 min", status: "Active" },
              { job: "Process auto-save deposits", schedule: "Daily 6:00 AM", status: "Active" },
              { job: "Settlement batch", schedule: "Daily 11:00 PM", status: "Active" },
            ].map(j => (
              <div key={j.job} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-xs font-medium text-foreground">{j.job}</p>
                  <p className="text-[10px] text-muted-foreground">{j.schedule}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{j.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
