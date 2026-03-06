import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { toast } from "sonner";
import {
  Zap, Droplets, Flame, Wifi, Tv, Plus, Pencil, Trash2, Loader2,
  Power, PowerOff, Eye, EyeOff, Save, X, Radio,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Biller {
  id: string;
  biller_code: string;
  display_name: string;
  category: string;
  api_base_url: string | null;
  config: Record<string, string>;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "electricity", label: "Electricity", icon: Zap },
  { value: "water", label: "Water", icon: Droplets },
  { value: "gas", label: "Gas", icon: Flame },
  { value: "internet", label: "Internet ISPs", icon: Wifi },
  { value: "tv", label: "TV / Cable", icon: Tv },
];

const CATEGORY_ICONS: Record<string, any> = {
  electricity: Zap,
  water: Droplets,
  gas: Flame,
  internet: Wifi,
  tv: Tv,
};

async function callBillerApi(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("manage-gateway-config", {
    body: { ...body, table: "biller_api_configs" },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminBillerConfig() {
  const [billers, setBillers] = useState<Biller[]>([]);
  const { visible, flash } = useRealtimeIndicator();
  const [loading, setLoading] = useState(true);
  const [editBiller, setEditBiller] = useState<Biller | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editCategory, setEditCategory] = useState("electricity");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [deleteBiller, setDeleteBiller] = useState<Biller | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, "ok" | "fail">>({});

  const loadBillers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callBillerApi({ action: "list" });
      setBillers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load billers");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadBillers(); }, [loadBillers]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-billers")
      .on("postgres_changes", { event: "*", schema: "public", table: "biller_api_configs" }, () => { loadBillers(); flash(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadBillers, flash]);

  const toggleEnabled = async (b: Biller) => {
    try {
      await callBillerApi({ action: "toggle", id: b.id, is_enabled: !b.is_enabled });
      toast.success(`${b.display_name} ${!b.is_enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const openEdit = (b: Biller) => {
    setEditBiller(b);
    setEditName(b.display_name);
    setEditCode(b.biller_code);
    setEditCategory(b.category);
    setEditBaseUrl(b.api_base_url || "");
    setEditConfig({ ...(b.config || {}) });
    setShowSecrets({});
  };

  const openAdd = () => {
    setAddOpen(true);
    setEditBiller(null);
    setEditName("");
    setEditCode("");
    setEditCategory("electricity");
    setEditBaseUrl("");
    setEditConfig({});
    setShowSecrets({});
  };

  const saveBiller = async () => {
    if (!editName.trim()) { toast.error("Name is required"); return; }

    setSaving(true);
    try {
      if (editBiller) {
        await callBillerApi({
          action: "update_config",
          id: editBiller.id,
          display_name: editName,
          api_base_url: editBaseUrl || null,
          config: editConfig,
        });
        toast.success("Biller updated");
        setEditBiller(null);
      } else {
        if (!editCode.trim()) { toast.error("Biller code is required"); setSaving(false); return; }
        await callBillerApi({
          action: "create",
          biller_code: editCode.toLowerCase().replace(/\s+/g, "_"),
          display_name: editName,
          category: editCategory,
          api_base_url: editBaseUrl || null,
          config: editConfig,
          sort_order: billers.length + 1,
        });
        toast.success("Biller added");
        setAddOpen(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteBiller) return;
    try {
      await callBillerApi({ action: "delete", id: deleteBiller.id });
      toast.success(`${deleteBiller.display_name} removed`);
    } catch {
      toast.error("Failed to delete");
    }
    setDeleteBiller(null);
  };

  const addConfigField = () => {
    const key = prompt("Enter credential key name (e.g. API_KEY):");
    if (key?.trim()) setEditConfig(prev => ({ ...prev, [key.trim()]: "" }));
  };

  const removeConfigField = (key: string) => {
    setEditConfig(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Group billers by category
  const grouped = billers.reduce<Record<string, Biller[]>>((acc, b) => {
    (acc[b.category] ??= []).push(b);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Biller API Configs</h3>
          <p className="text-sm text-muted-foreground">Manage utility biller integrations (Electricity, Water, Gas, Internet, TV)</p>
          <RealtimeUpdateIndicator visible={visible} />
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Biller
        </Button>
      </div>

      {CATEGORIES.map(cat => {
        const items = grouped[cat.value];
        if (!items?.length) return null;
        const Icon = cat.icon;
        return (
          <div key={cat.value} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</h4>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map(b => {
                const configKeys = Object.keys(b.config || {});
                const hasCredentials = configKeys.some(k => !!(b.config as any)[k]);
                return (
                  <Card key={b.id} className={`border shadow-[var(--shadow-card)] transition-opacity ${!b.is_enabled ? "opacity-60" : ""}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {(() => { const I = CATEGORY_ICONS[b.category] ?? Zap; return <I className="w-4 h-4 text-primary" />; })()}
                          {b.display_name}
                        </CardTitle>
                        <Switch checked={b.is_enabled} onCheckedChange={() => toggleEnabled(b)} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{b.biller_code}</Badge>
                        {b.is_enabled ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <Power className="w-3 h-3 mr-1" /> Live
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <PowerOff className="w-3 h-3 mr-1" /> Off
                          </Badge>
                        )}
                        {hasCredentials ? (
                          <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Configured</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">No Credentials</Badge>
                        )}
                      </div>
                      {b.api_base_url && (
                        <p className="text-xs text-muted-foreground truncate font-mono">{b.api_base_url}</p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => openEdit(b)}>
                          <Pencil className="w-3 h-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs gap-1 ${testResults[b.id] === "ok" ? "border-emerald-500 text-emerald-700" : testResults[b.id] === "fail" ? "border-destructive text-destructive" : ""}`}
                          disabled={!b.api_base_url || testing[b.id]}
                          onClick={async () => {
                            setTesting(p => ({ ...p, [b.id]: true }));
                            setTestResults(p => { const n = { ...p }; delete n[b.id]; return n; });
                            try {
                              const res = await fetch(b.api_base_url!, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(8000) });
                              setTestResults(p => ({ ...p, [b.id]: "ok" }));
                              toast.success(`${b.display_name}: reachable`);
                            } catch {
                              setTestResults(p => ({ ...p, [b.id]: "fail" }));
                              toast.error(`${b.display_name}: unreachable`);
                            }
                            setTesting(p => ({ ...p, [b.id]: false }));
                          }}
                          title={!b.api_base_url ? "Set an API Base URL first" : "Ping API endpoint"}
                        >
                          {testing[b.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                          {testResults[b.id] === "ok" ? "OK" : testResults[b.id] === "fail" ? "Fail" : "Test"}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteBiller(b)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {billers.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No biller API configs yet. Click "Add Biller" to start.</p>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={!!editBiller || addOpen} onOpenChange={(o) => { if (!o) { setEditBiller(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editBiller ? `Edit ${editBiller.display_name}` : "Add Biller"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editBiller && (
              <>
                <div className="space-y-2">
                  <Label>Biller Code</Label>
                  <Input placeholder="e.g. desco" value={editCode} onChange={e => setEditCode(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Unique identifier, lowercase</p>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. DESCO" />
            </div>
            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input value={editBaseUrl} onChange={e => setEditBaseUrl(e.target.value)} placeholder="https://api.example.com" className="font-mono text-sm" />
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
                <p className="text-xs text-muted-foreground">No credentials added yet. Click "Add Field" above.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditBiller(null); setAddOpen(false); }}>Cancel</Button>
            <Button onClick={saveBiller} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBiller} onOpenChange={(o) => { if (!o) setDeleteBiller(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteBiller?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this biller configuration and its stored credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
