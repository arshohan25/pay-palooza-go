import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Save, Smartphone, Flame, Package, Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { useGlobalToggles } from "@/hooks/use-global-toggles";

const OPERATORS = ["Grameenphone", "Robi", "Banglalink", "Teletalk", "Airtel"];
const TYPES = ["drive", "regular"];
const SUB_CATEGORIES = ["internet", "minutes", "bundles", "callrates"];
const TAGS = ["", "Hot", "New", "Limited", "Popular"];

interface Pack {
  id: string;
  operator: string;
  name: string;
  details: string;
  validity: string;
  price: number;
  type: string;
  sub_category: string | null;
  badge: string | null;
  tag: string | null;
  highlight: boolean;
  cashback: number;
  sort_order: number;
  is_active: boolean;
}

const emptyPack = (): Partial<Pack> => ({
  operator: "Grameenphone",
  name: "",
  details: "",
  validity: "7 days",
  price: 0,
  type: "regular",
  sub_category: "internet",
  badge: "",
  tag: "",
  highlight: false,
  cashback: 0,
  sort_order: 0,
  is_active: true,
});

export default function AdminRechargePackManager() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOp, setFilterOp] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editPack, setEditPack] = useState<Partial<Pack> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletePack, setDeletePack] = useState<Pack | null>(null);
  const { isDisabled: isFeatureDisabled } = useGlobalToggles();

  // Drive toggle state
  const driveDisabled = isFeatureDisabled("drive_offers");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recharge_packs")
      .select("*")
      .order("operator")
      .order("sort_order");
    if (error) toast.error("Failed to load packs");
    else setPacks((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-recharge-packs")
      .on("postgres_changes", { event: "*", schema: "public", table: "recharge_packs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const toggleDrive = async () => {
    // Check if drive_offers toggle exists
    const { data: existing } = await supabase
      .from("global_feature_toggles")
      .select("id, is_enabled")
      .eq("feature_key", "drive_offers")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("global_feature_toggles")
        .update({ is_enabled: !existing.is_enabled } as any)
        .eq("id", existing.id);
      toast.success(`Drive offers ${!existing.is_enabled ? "enabled" : "disabled"}`);
    } else {
      // Create the toggle
      await supabase
        .from("global_feature_toggles")
        .insert({
          feature_key: "drive_offers",
          label: "Drive Offers",
          description: "Show drive recharge packs with cashback",
          is_enabled: true,
          sort_order: 100,
        } as any);
      toast.success("Drive offers toggle created & enabled");
    }
  };

  const openAdd = () => {
    setEditPack(emptyPack());
    setIsNew(true);
  };

  const openEdit = (p: Pack) => {
    setEditPack({ ...p });
    setIsNew(false);
  };

  const savePack = async () => {
    if (!editPack?.name?.trim()) { toast.error("Name is required"); return; }
    if (!editPack.details?.trim()) { toast.error("Details required"); return; }
    if (!editPack.price || editPack.price <= 0) { toast.error("Price must be positive"); return; }
    setSaving(true);

    const payload = {
      operator: editPack.operator,
      name: editPack.name,
      details: editPack.details,
      validity: editPack.validity,
      price: editPack.price,
      type: editPack.type,
      sub_category: editPack.type === "regular" ? editPack.sub_category : null,
      badge: editPack.badge || null,
      tag: editPack.tag || null,
      highlight: editPack.highlight ?? false,
      cashback: editPack.type === "drive" ? (editPack.cashback ?? 0) : 0,
      sort_order: editPack.sort_order ?? 0,
      is_active: editPack.is_active ?? true,
    };

    if (isNew) {
      const { error } = await supabase.from("recharge_packs").insert(payload as any);
      if (error) toast.error("Failed to create pack");
      else { toast.success("Pack created"); setEditPack(null); }
    } else {
      const { error } = await supabase.from("recharge_packs").update(payload as any).eq("id", editPack.id!);
      if (error) toast.error("Failed to update pack");
      else { toast.success("Pack updated"); setEditPack(null); }
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deletePack) return;
    const { error } = await supabase.from("recharge_packs").delete().eq("id", deletePack.id);
    if (error) toast.error("Failed to delete");
    else toast.success(`"${deletePack.name}" deleted`);
    setDeletePack(null);
  };

  const toggleActive = async (p: Pack) => {
    await supabase.from("recharge_packs").update({ is_active: !p.is_active } as any).eq("id", p.id);
  };

  const filtered = packs.filter(p => {
    if (filterOp !== "all" && p.operator !== filterOp) return false;
    if (filterType !== "all" && p.type !== filterType) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.details.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Recharge Pack Manager</h3>
          <p className="text-sm text-muted-foreground">
            Manage mobile recharge packs for all operators ({packs.length} total)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Drive toggle */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
            <Flame className={`w-4 h-4 ${driveDisabled ? "text-muted-foreground" : "text-amber-500"}`} />
            <span className="text-sm font-medium text-foreground">Drive</span>
            <Switch checked={!driveDisabled} onCheckedChange={toggleDrive} />
          </div>
          <Button onClick={openAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Pack
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterOp} onValueChange={setFilterOp}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Operators</SelectItem>
            {OPERATORS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="drive">Drive</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search packs…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Pack list */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.map(p => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${!p.is_active ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <Badge variant="outline" className="text-[10px]">{p.operator}</Badge>
                    {p.type === "drive" ? (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Flame className="w-2.5 h-2.5 mr-0.5" /> Drive
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{p.sub_category}</Badge>
                    )}
                    {p.tag && <Badge className="text-[10px]">{p.tag}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.details}</p>
                  <p className="text-xs text-muted-foreground">
                    ৳{p.price} · {p.validity}
                    {p.cashback > 0 && ` · Cashback ৳${p.cashback}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeletePack(p)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">No packs found</p>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={!!editPack} onOpenChange={o => { if (!o) setEditPack(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Recharge Pack" : "Edit Pack"}</DialogTitle>
          </DialogHeader>
          {editPack && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Operator</Label>
                  <Select value={editPack.operator} onValueChange={v => setEditPack({ ...editPack, operator: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={editPack.type} onValueChange={v => setEditPack({ ...editPack, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drive">Drive</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={editPack.name} onChange={e => setEditPack({ ...editPack, name: e.target.value })} placeholder="e.g. 3GB Weekly" />
              </div>
              <div className="space-y-1.5">
                <Label>Details</Label>
                <Input value={editPack.details} onChange={e => setEditPack({ ...editPack, details: e.target.value })} placeholder="Description of the pack" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Price (৳)</Label>
                  <Input type="number" value={editPack.price} onChange={e => setEditPack({ ...editPack, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Validity</Label>
                  <Input value={editPack.validity} onChange={e => setEditPack({ ...editPack, validity: e.target.value })} placeholder="e.g. 7 days" />
                </div>
              </div>
              {editPack.type === "regular" && (
                <div className="space-y-1.5">
                  <Label>Sub Category</Label>
                  <Select value={editPack.sub_category ?? "internet"} onValueChange={v => setEditPack({ ...editPack, sub_category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUB_CATEGORIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editPack.type === "drive" && (
                <div className="space-y-1.5">
                  <Label>Cashback (৳)</Label>
                  <Input type="number" value={editPack.cashback} onChange={e => setEditPack({ ...editPack, cashback: Number(e.target.value) })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Badge</Label>
                  <Input value={editPack.badge ?? ""} onChange={e => setEditPack({ ...editPack, badge: e.target.value })} placeholder="e.g. Popular" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tag</Label>
                  <Select value={editPack.tag ?? ""} onValueChange={v => setEditPack({ ...editPack, tag: v || null })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {TAGS.map(t => <SelectItem key={t || "none"} value={t || "none"}>{t || "None"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sort Order</Label>
                  <Input type="number" value={editPack.sort_order} onChange={e => setEditPack({ ...editPack, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={editPack.highlight ?? false} onCheckedChange={v => setEditPack({ ...editPack, highlight: v })} />
                  <Label>Highlight</Label>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editPack.is_active ?? true} onCheckedChange={v => setEditPack({ ...editPack, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPack(null)}>Cancel</Button>
            <Button onClick={savePack} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePack} onOpenChange={o => { if (!o) setDeletePack(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletePack?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this recharge pack.
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
