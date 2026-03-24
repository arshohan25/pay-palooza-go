import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { toast } from "sonner";
import {
  ToggleRight, ToggleLeft, Loader2, Plus, Pencil, Trash2, Save,
  Power, PowerOff, Wallet, Zap, ShoppingBag, Store, UserCog, Box,
  UserCheck, Building2, Settings2, Crown, Eye, EyeOff, EyeClosed,
} from "lucide-react";
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

interface FeatureToggle {
  id: string;
  feature_key: string;
  label: string;
  description: string | null;
  is_enabled: boolean;
  sort_order: number;
  visibility: string; // 'visible' | 'disabled' | 'hidden'
}

const SECTIONS = [
  {
    id: "wallet",
    label: "Wallet & Transfers",
    icon: Wallet,
    matcher: (key: string) =>
      ["send_money", "cash_out", "cash_in", "add_money", "payment", "bank_transfer"].some(
        (k) => key === k || key.startsWith(k + "_")
      ),
    prefixHint: "send_money",
  },
  {
    id: "services",
    label: "Services",
    icon: Zap,
    matcher: (key: string) =>
      ["mobile_recharge", "pay_bill", "savings", "donations", "loan", "insurance", "gift_cards", "drive_offers"].some(
        (k) => key === k || key.startsWith(k + "_")
      ),
    prefixHint: "mobile_recharge",
  },
  {
    id: "shopping",
    label: "Shopping",
    icon: ShoppingBag,
    matcher: (key: string) =>
      ["shop", "coupons", "qr_scan", "refer"].some((k) => key === k || key.startsWith(k + "_")),
    prefixHint: "shop",
  },
  {
    id: "merchant",
    label: "Merchant",
    icon: Store,
    matcher: (key: string) => key.startsWith("merchant_"),
    prefixHint: "merchant_",
  },
  {
    id: "account",
    label: "Account",
    icon: UserCog,
    matcher: (key: string) => key.startsWith("account_"),
    prefixHint: "account_",
  },
  {
    id: "reserved",
    label: "Reserved Slots",
    icon: Box,
    matcher: (key: string) => key.startsWith("feature_slot_"),
    prefixHint: "feature_slot_",
  },
  {
    id: "agent",
    label: "Agent",
    icon: UserCheck,
    matcher: (key: string) => key.startsWith("agent_"),
    prefixHint: "agent_",
  },
  {
    id: "distributor",
    label: "Distributor",
    icon: Building2,
    matcher: (key: string) => key.startsWith("distributor_"),
    prefixHint: "distributor_",
  },
  {
    id: "super_distributor",
    label: "Super Distributor",
    icon: Crown,
    matcher: (key: string) => key.startsWith("super_distributor_"),
    prefixHint: "super_distributor_",
  },
];

const OTHER_SECTION = { id: "other", label: "Other", icon: Settings2, prefixHint: "" };

function groupToggles(toggles: FeatureToggle[]) {
  const groups: Record<string, FeatureToggle[]> = {};
  SECTIONS.forEach((s) => (groups[s.id] = []));
  groups[OTHER_SECTION.id] = [];

  toggles.forEach((t) => {
    const section = SECTIONS.find((s) => s.matcher(t.feature_key));
    groups[section ? section.id : OTHER_SECTION.id].push(t);
  });
  return groups;
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
  const [addSection, setAddSection] = useState("other");
  const [saving, setSaving] = useState(false);
  const [deleteToggle, setDeleteToggle] = useState<FeatureToggle | null>(null);
  const [bulkAction, setBulkAction] = useState<"enable" | "disable" | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const groups = useMemo(() => groupToggles(toggles), [toggles]);
  const disabledCount = toggles.filter((t) => !t.is_enabled).length;
  const enabledCount = toggles.filter((t) => t.is_enabled).length;

  const allSections = [...SECTIONS, OTHER_SECTION];
  const visibleSections = allSections.filter((s) => (groups[s.id]?.length ?? 0) > 0);
  const currentSection = activeSection && visibleSections.some(s => s.id === activeSection)
    ? activeSection
    : visibleSections[0]?.id ?? "";

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

  const auditLog = async (action: string, entityId: string, details: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "global_toggle", entity_id: entityId, details }).then();
    }
  };

  const setVisibility = async (t: FeatureToggle, visibility: string) => {
    const isEnabled = visibility === 'visible';
    const { error } = await supabase
      .from("global_feature_toggles")
      .update({ visibility, is_enabled: isEnabled } as any)
      .eq("id", t.id);
    if (error) toast.error("Failed to update");
    else {
      const labels: Record<string, string> = { visible: "Visible", disabled: "Disabled (greyed out)", hidden: "Hidden" };
      toast.success(`${t.label} → ${labels[visibility] || visibility}`);
      auditLog("toggle_visibility_changed", t.id, { feature_key: t.feature_key, label: t.label, new_visibility: visibility });
    }
  };

  const toggleFeature = async (t: FeatureToggle) => {
    const { error } = await supabase
      .from("global_feature_toggles")
      .update({ is_enabled: !t.is_enabled } as any)
      .eq("id", t.id);
    if (error) toast.error("Failed to toggle");
    else {
      toast.success(`${t.label} ${!t.is_enabled ? "enabled" : "disabled"}`);
      auditLog("toggle_feature", t.id, { feature_key: t.feature_key, label: t.label, new_enabled: !t.is_enabled });
    }
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
    setAddSection("other");
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
      else { toast.success("Toggle updated"); auditLog("toggle_edited", editToggle.id, { feature_key: editToggle.feature_key, new_label: editLabel }); setEditToggle(null); }
    } else {
      if (!editKey.trim()) { toast.error("Feature key is required"); setSaving(false); return; }
      const section = allSections.find((s) => s.id === addSection);
      const prefix = section?.prefixHint && !editKey.startsWith(section.prefixHint)
        ? section.prefixHint
        : "";
      const finalKey = (prefix + editKey).toLowerCase().replace(/\s+/g, "_");
      const { error } = await supabase
        .from("global_feature_toggles")
        .insert({ feature_key: finalKey, label: editLabel, description: editDesc || null, sort_order: toggles.length + 1 } as any);
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

  const renderToggleList = (items: FeatureToggle[]) => (
    <div className="divide-y divide-border">
      {items.map((t) => {
        const vis = t.visibility || 'visible';
        return (
          <div key={t.id} className="px-2 sm:px-4 py-2.5 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-1.5">
              {vis === 'visible' ? (
                <Eye className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              ) : vis === 'disabled' ? (
                <EyeOff className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              ) : (
                <EyeClosed className="w-3.5 h-3.5 shrink-0 text-destructive" />
              )}
              <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{t.label}</p>
              <Select value={vis} onValueChange={(val) => setVisibility(t, val)}>
                <SelectTrigger className="w-[110px] h-7 text-[11px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visible">
                    <span className="flex items-center gap-1.5"><Eye className="w-3 h-3 text-emerald-500" /> Visible</span>
                  </SelectItem>
                  <SelectItem value="disabled">
                    <span className="flex items-center gap-1.5"><EyeOff className="w-3 h-3 text-amber-500" /> Disabled</span>
                  </SelectItem>
                  <SelectItem value="hidden">
                    <span className="flex items-center gap-1.5"><EyeClosed className="w-3 h-3 text-destructive" /> Hidden</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {t.description && <p className="text-xs text-muted-foreground truncate mt-0.5 pl-5">{t.description}</p>}
            <div className="flex items-center justify-between mt-1 pl-5">
              <p className="text-[10px] font-mono text-muted-foreground/60 truncate flex-1 min-w-0">{t.feature_key}</p>
              <div className="flex items-center shrink-0">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(t)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteToggle(t)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div>
        <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-foreground">Global Feature Toggles</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Enable or disable features globally</p>
          <RealtimeUpdateIndicator visible={visible} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setBulkAction("enable")} disabled={enabledCount === toggles.length || toggles.length === 0} className="gap-1 text-[11px] h-7 px-2">
            <Power className="w-3 h-3" /> All On
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkAction("disable")} disabled={disabledCount === toggles.length || toggles.length === 0} className="gap-1 text-destructive hover:text-destructive text-[11px] h-7 px-2">
            <PowerOff className="w-3 h-3" /> All Off
          </Button>
          <Button onClick={openAdd} className="gap-1 h-7 px-2 text-[11px]" size="sm">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Horizontal Tab Bar */}
      <div className="flex flex-wrap gap-0 p-1 bg-muted/50 rounded-xl">
        {visibleSections.map((section) => {
          const items = groups[section.id] ?? [];
          const Icon = section.icon;
          const isActive = currentSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-toggle-tab"
                  className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <Icon className="w-3.5 h-3.5" />
                {section.label}
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "opacity-60"}`}>
                  {items.length}
                </Badge>
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Section Content */}
      <AnimatePresence mode="wait">
        {currentSection && (groups[currentSection]?.length ?? 0) > 0 ? (
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
          >
            {renderToggleList(groups[currentSection])}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
              <ToggleLeft className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No toggles yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add a toggle to get started</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit / Add Dialog */}
      <Dialog open={!!editToggle || addOpen} onOpenChange={(o) => { if (!o) { setEditToggle(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editToggle ? "Edit Toggle" : "Add Feature Toggle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editToggle && (
              <>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select value={addSection} onValueChange={setAddSection}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Feature Key</Label>
                  <Input placeholder="e.g. send_money" value={editKey} onChange={(e) => setEditKey(e.target.value)} />
                  {addSection !== "other" && (
                    <p className="text-[10px] text-muted-foreground">
                      Prefix auto-applied: <span className="font-mono">{allSections.find((s) => s.id === addSection)?.prefixHint}</span>
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="e.g. Send Money" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Short description…" />
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
            <AlertDialogDescription>This will permanently delete this feature toggle.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Confirmation */}
      <AlertDialog open={!!bulkAction} onOpenChange={(o) => { if (!o) setBulkAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkAction === "enable" ? "Enable" : "Disable"} all features?</AlertDialogTitle>
            <AlertDialogDescription>
              This will {bulkAction === "enable" ? "enable" : "disable"} all {bulkAction === "enable" ? disabledCount : enabledCount} feature toggles at once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulk}
              disabled={bulkLoading}
              className={bulkAction === "disable" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {bulkAction === "enable" ? "Enable All" : "Disable All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
