import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { toast } from "sonner";
import { ToggleRight, ToggleLeft, Loader2, Plus, Pencil, Trash2, Save, X, Power, PowerOff } from "lucide-react";
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

interface FeatureToggle {
  id: string;
  feature_key: string;
  label: string;
  description: string | null;
  is_enabled: boolean;
  sort_order: number;
}

export default function AdminGlobalToggles() {
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const { visible, flash } = useRealtimeIndicator();
  const [loading, setLoading] = useState(true);
  const [editToggle, setEditToggle] = useState<FeatureToggle | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteToggle, setDeleteToggle] = useState<FeatureToggle | null>(null);
  const [bulkAction, setBulkAction] = useState<"enable" | "disable" | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const disabledCount = toggles.filter(t => !t.is_enabled).length;
  const enabledCount = toggles.filter(t => t.is_enabled).length;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("global_feature_toggles")
      .select("*")
      .order("sort_order");
    if (error) toast.error("Failed to load toggles");
    else setToggles((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-global-toggles")
      .on("postgres_changes", { event: "*", schema: "public", table: "global_feature_toggles" }, () => { load(); flash(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const toggleFeature = async (t: FeatureToggle) => {
    const { error } = await supabase
      .from("global_feature_toggles")
      .update({ is_enabled: !t.is_enabled } as any)
      .eq("id", t.id);
    if (error) toast.error("Failed to toggle");
    else toast.success(`${t.label} ${!t.is_enabled ? "enabled" : "disabled"}`);
  };

  const openEdit = (t: FeatureToggle) => {
    setEditToggle(t);
    setEditLabel(t.label);
    setEditKey(t.feature_key);
    setEditDesc(t.description ?? "");
    setAddOpen(false);
  };

  const openAdd = () => {
    setEditToggle(null);
    setEditLabel("");
    setEditKey("");
    setEditDesc("");
    setAddOpen(true);
  };

  const saveToggle = async () => {
    if (!editLabel.trim()) { toast.error("Label is required"); return; }
    setSaving(true);
    if (editToggle) {
      const { error } = await supabase
        .from("global_feature_toggles")
        .update({ label: editLabel, description: editDesc || null } as any)
        .eq("id", editToggle.id);
      if (error) toast.error("Failed to save");
      else { toast.success("Toggle updated"); setEditToggle(null); }
    } else {
      if (!editKey.trim()) { toast.error("Feature key is required"); setSaving(false); return; }
      const { error } = await supabase
        .from("global_feature_toggles")
        .insert({ feature_key: editKey.toLowerCase().replace(/\s+/g, "_"), label: editLabel, description: editDesc || null, sort_order: toggles.length + 1 } as any);
      if (error) {
        if (error.code === "23505") toast.error("Feature key already exists");
        else toast.error("Failed to create");
      } else { toast.success("Toggle added"); setAddOpen(false); }
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteToggle) return;
    const { error } = await supabase.from("global_feature_toggles").delete().eq("id", deleteToggle.id);
    if (error) toast.error("Failed to delete");
    else toast.success(`${deleteToggle.label} removed`);
    setDeleteToggle(null);
  };

  const confirmBulk = async () => {
    if (!bulkAction) return;
    setBulkLoading(true);
    const targetValue = bulkAction === "enable";
    const { error } = await supabase
      .from("global_feature_toggles")
      .update({ is_enabled: targetValue } as any)
      .neq("is_enabled", targetValue);
    if (error) toast.error(`Failed to ${bulkAction} all`);
    else toast.success(`All features ${targetValue ? "enabled" : "disabled"}`);
    setBulkLoading(false);
    setBulkAction(null);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">Global Feature Toggles</h3>
            {disabledCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {disabledCount} disabled
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Enable or disable features globally for all users</p>
          <RealtimeUpdateIndicator visible={visible} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkAction("enable")} disabled={enabledCount === toggles.length || toggles.length === 0} className="gap-1.5">
            <Power className="w-3.5 h-3.5" /> Enable All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkAction("disable")} disabled={disabledCount === toggles.length || toggles.length === 0} className="gap-1.5 text-destructive hover:text-destructive">
            <PowerOff className="w-3.5 h-3.5" /> Disable All
          </Button>
          <Button onClick={openAdd} className="gap-1.5" size="sm">
            <Plus className="w-4 h-4" /> Add Toggle
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {toggles.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ToggleRight className={`w-5 h-5 shrink-0 ${t.is_enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                    )}
                    <p className="text-[10px] font-mono text-muted-foreground/60">{t.feature_key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteToggle(t)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Switch checked={t.is_enabled} onCheckedChange={() => toggleFeature(t)} />
                </div>
              </div>
            ))}
          </div>
          {toggles.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <ToggleLeft className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">No feature toggles configured</p>
              <p className="text-xs text-muted-foreground mt-1">Add a toggle to get started</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Add Dialog */}
      <Dialog open={!!editToggle || addOpen} onOpenChange={(o) => { if (!o) { setEditToggle(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editToggle ? "Edit Toggle" : "Add Feature Toggle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editToggle && (
              <div className="space-y-2">
                <Label>Feature Key</Label>
                <Input placeholder="e.g. send_money" value={editKey} onChange={e => setEditKey(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="e.g. Send Money" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Short description…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditToggle(null); setAddOpen(false); }}>Cancel</Button>
            <Button onClick={saveToggle} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteToggle} onOpenChange={(o) => { if (!o) setDeleteToggle(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteToggle?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this feature toggle.
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
