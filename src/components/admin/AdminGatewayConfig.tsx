import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { toast } from "sonner";
import {
  CreditCard, Plus, Pencil, Trash2, Loader2, Power, PowerOff, Eye, EyeOff, Save, X,
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Gateway {
  id: string;
  provider: string;
  display_name: string;
  config: Record<string, string>;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_FIELDS: Record<string, string[]> = {
  bkash: ["BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD"],
  nagad: ["NAGAD_MERCHANT_ID", "NAGAD_MERCHANT_KEY", "NAGAD_PUBLIC_KEY"],
  rocket: ["ROCKET_MERCHANT_ID", "ROCKET_API_KEY"],
  upay: ["UPAY_MERCHANT_ID", "UPAY_API_KEY"],
  tap: ["TAP_MERCHANT_ID", "TAP_API_KEY"],
  mcash: ["MCASH_MERCHANT_ID", "MCASH_API_KEY"],
  asthapay: ["api_key", "secret_key", "brand_key", "receiving_number"],
};

/** Call the manage-gateway-config edge function */
async function callGatewayApi(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("manage-gateway-config", {
    body: { ...body, table: "payment_gateways" },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "payment_gateway", entity_id: entityId, details });
  }
}

export default function AdminGatewayConfig() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const { visible, flash } = useRealtimeIndicator();
  const [loading, setLoading] = useState(true);
  const [editGw, setEditGw] = useState<Gateway | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [editName, setEditName] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [deleteGw, setDeleteGw] = useState<Gateway | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadGateways = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callGatewayApi({ action: "list" });
      setGateways(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load gateways");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadGateways(); }, [loadGateways]);

  // Realtime for status changes only (config is masked anyway)
  useEffect(() => {
    const ch = supabase
      .channel("admin-gateways")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_gateways" }, () => { loadGateways(); flash(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadGateways]);

  const toggleEnabled = async (gw: Gateway) => {
    try {
      await callGatewayApi({ action: "toggle", id: gw.id, is_enabled: !gw.is_enabled });
      toast.success(`${gw.display_name} ${!gw.is_enabled ? "enabled" : "disabled"}`);
      await auditLog("gateway_toggled", gw.id, { display_name: gw.display_name, is_enabled: !gw.is_enabled });
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const openEdit = (gw: Gateway) => {
    setEditGw(gw);
    setEditName(gw.display_name);
    setEditProvider(gw.provider);
    const fields = DEFAULT_FIELDS[gw.provider] ?? [];
    const cfg: Record<string, string> = {};
    fields.forEach(f => { cfg[f] = (gw.config as any)?.[f] ?? ""; });
    Object.keys(gw.config || {}).forEach(k => { if (!cfg[k]) cfg[k] = (gw.config as any)[k]; });
    setEditConfig(cfg);
    setShowSecrets({});
  };

  const openAdd = () => {
    setAddOpen(true);
    setEditGw(null);
    setEditName("");
    setEditProvider("");
    setEditConfig({});
    setShowSecrets({});
  };

  const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

  const saveGateway = async () => {
    if (!editName.trim()) { toast.error("Name is required"); return; }

    const recvNum = editConfig["receiving_number"]?.trim();
    if (recvNum && !BD_PHONE_REGEX.test(recvNum)) {
      toast.error("Receiving number must be a valid 11-digit BD phone (e.g. 01XXXXXXXXX)");
      return;
    }

    setSaving(true);
    try {
      if (editGw) {
        await callGatewayApi({
          action: "update_config",
          id: editGw.id,
          display_name: editName,
          config: editConfig,
        });
        toast.success("Gateway updated");
        await auditLog("gateway_updated", editGw.id, { display_name: editName });
        setEditGw(null);
      } else {
        if (!editProvider.trim()) { toast.error("Provider key is required"); setSaving(false); return; }
        await callGatewayApi({
          action: "create",
          provider: editProvider.toLowerCase().replace(/\s+/g, "_"),
          display_name: editName,
          config: editConfig,
          sort_order: gateways.length + 1,
        });
        toast.success("Gateway added");
        await auditLog("gateway_created", "new", { provider: editProvider, display_name: editName });
        setAddOpen(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteGw) return;
    try {
      await callGatewayApi({ action: "delete", id: deleteGw.id });
      toast.success(`${deleteGw.display_name} removed`);
    } catch {
      toast.error("Failed to delete");
    }
    setDeleteGw(null);
  };

  const addConfigField = () => {
    const key = prompt("Enter credential key name (e.g. API_KEY):");
    if (key?.trim()) setEditConfig(prev => ({ ...prev, [key.trim()]: "" }));
  };

  const removeConfigField = (key: string) => {
    setEditConfig(prev => { const n = { ...prev }; delete n[key]; return n; });
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Payment Gateways</h3>
          <p className="text-sm text-muted-foreground">Add, edit, remove & toggle payment providers</p>
          <RealtimeUpdateIndicator visible={visible} />
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Gateway
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gateways.map(gw => {
          const configKeys = Object.keys(gw.config || {});
          const hasCredentials = configKeys.some(k => !!(gw.config as any)[k]);
          return (
            <Card key={gw.id} className={`border shadow-[var(--shadow-card)] transition-opacity ${!gw.is_enabled ? "opacity-60" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    {gw.display_name}
                  </CardTitle>
                  <Switch
                    checked={gw.is_enabled}
                    onCheckedChange={() => toggleEnabled(gw)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{gw.provider}</Badge>
                  {gw.is_enabled ? (
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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => openEdit(gw)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteGw(gw)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {gateways.length === 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
          <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
            <CreditCard className="w-7 h-7 text-muted-foreground" />
          </motion.div>
          <p className="text-sm font-semibold text-foreground">No payment gateways configured</p>
          <p className="text-xs text-muted-foreground mt-1">Add a gateway to get started</p>
        </motion.div>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={!!editGw || addOpen} onOpenChange={(o) => { if (!o) { setEditGw(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editGw ? `Edit ${editGw.display_name}` : "Add Payment Gateway"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editGw && (
              <div className="space-y-2">
                <Label>Provider Key</Label>
                <Input placeholder="e.g. bkash" value={editProvider} onChange={e => setEditProvider(e.target.value)} />
                <p className="text-xs text-muted-foreground">Unique identifier, lowercase</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. bKash" />
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
            <Button variant="outline" onClick={() => { setEditGw(null); setAddOpen(false); }}>Cancel</Button>
            <Button onClick={saveGateway} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteGw} onOpenChange={(o) => { if (!o) setDeleteGw(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteGw?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this payment gateway and its stored credentials.
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
