import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Percent, Plus, Trash2, Save, RefreshCw, Search } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function AdminVendorCommissionManager() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [defaultRate, setDefaultRate] = useState("5");
  const [overrides, setOverrides] = useState<any[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("merchants")
      .select("id, business_name, category, commission_rate, business_kyc_status")
      .eq("business_kyc_status", "approved")
      .order("business_name");
    setVendors(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openVendor = async (v: any) => {
    setSelected(v);
    setDefaultRate(String(v.commission_rate ?? 5));
    const { data } = await supabase
      .from("vendor_commission_overrides")
      .select("*")
      .eq("merchant_id", v.id)
      .order("category");
    setOverrides(data ?? []);
    setNewCat(""); setNewRate("");
  };

  const saveDefault = async () => {
    if (!selected) return;
    const rate = parseFloat(defaultRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error("Invalid rate"); return; }
    setSaving(true);
    const { error } = await supabase.from("merchants").update({ commission_rate: rate }).eq("id", selected.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Default rate saved");
    load();
  };

  const addOverride = async () => {
    if (!selected || !newCat.trim() || !newRate) { toast.error("Category & rate required"); return; }
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error("Invalid rate"); return; }
    const { error } = await supabase.from("vendor_commission_overrides").upsert({
      merchant_id: selected.id,
      category: newCat.trim().toLowerCase(),
      commission_rate: rate,
    }, { onConflict: "merchant_id,category" });
    if (error) { toast.error(error.message); return; }
    toast.success("Override added");
    setNewCat(""); setNewRate("");
    openVendor(selected);
  };

  const removeOverride = async (id: string) => {
    const { error } = await supabase.from("vendor_commission_overrides").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    openVendor(selected);
  };

  const filtered = vendors.filter(v => !search || v.business_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary" /> Vendor Commissions
        </h3>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors…" className="pl-9" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No approved vendors</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <Card key={v.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{v.business_name}</p>
                  <p className="text-xs text-muted-foreground">{v.category}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{v.commission_rate}%</Badge>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openVendor(v)}>Manage</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.business_name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Card className="border">
              <CardContent className="p-3 space-y-2">
                <Label className="text-xs">Default Commission Rate (%)</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} />
                  <Button size="sm" disabled={saving} onClick={saveDefault}><Save className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>

            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Per-Category Overrides</p>
              <div className="space-y-1.5">
                {overrides.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No overrides yet — default rate applies to all categories.</p>
                )}
                {overrides.map(o => (
                  <div key={o.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                    <span className="text-xs font-medium text-foreground flex-1 capitalize">{o.category}</span>
                    <Badge variant="secondary" className="text-[10px]">{o.commission_rate}%</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeOverride(o.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <Input placeholder="Category (e.g. fashion)" value={newCat} onChange={e => setNewCat(e.target.value)} className="text-xs" />
                <Input placeholder="%" type="number" step="0.01" value={newRate} onChange={e => setNewRate(e.target.value)} className="w-20 text-xs" />
                <Button size="sm" onClick={addOverride}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
