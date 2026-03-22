import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { toast } from "sonner";
import {
  ToggleRight, ToggleLeft, Loader2, Plus, Pencil, Trash2, Save,
  Power, PowerOff, Wallet, Zap, ShoppingBag, Store, UserCog, Box,
  UserCheck, Building2, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
      else { toast.success("Toggle updated"); setEditToggle(null); }
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
      {items.map((t) => (
        <div key={t.id} className="px-2 sm:px-4 py-2.5 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-1.5">
            <ToggleRight className={`w-3.5 h-3.5 shrink-0 ${t.is_enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{t.label}</p>
            <Switch checked={t.is_enabled} onCheckedChange={() => toggleFeature(t)} className="shrink-0" />
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
      ))}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-foreground">Global Feature Toggles</h3>
            {disabledCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{disabledCount} off</Badge>
            )}
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
      <ScrollArea className="w-full">
        <div className="flex gap-1.5 pb-2">
          {visibleSections.map((section) => {
            const items = groups[section.id] ?? [];
            const offCount = items.filter((t) => !t.is_enabled).length;
            const Icon = section.icon;
            const isActive = currentSection === section.id;

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {section.label}
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}>
                  {items.length}
                </Badge>
                {offCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {offCount} off
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Active Section Content */}
      {currentSection && (groups[currentSection]?.length ?? 0) > 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          {renderToggleList(groups[currentSection])}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="flex flex-col items-center justify-center py-8 text-center">
          <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
            <ToggleLeft className="w-7 h-7 text-muted-foreground" />
          </motion.div>
          <p className="text-sm font-semibold text-foreground">No toggles yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a toggle to get started</p>
        </motion.div>
      )}

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
