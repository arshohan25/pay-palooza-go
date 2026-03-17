import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, MapPin } from "lucide-react";

export default function AdminDeliveryZones() {
  const [zones, setZones] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ zone_name: "", cities: "", delivery_fee: "60", estimated_days: "3-5 days", courier_provider_id: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: z }, { data: c }] = await Promise.all([
      supabase.from("delivery_zones").select("*, courier_providers(name)").order("created_at", { ascending: false }),
      supabase.from("courier_providers").select("id, name").eq("is_active", true),
    ]);
    setZones(z ?? []);
    setCouriers(c ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.zone_name.trim()) { toast.error("Zone name required"); return; }
    const cities = form.cities.split(",").map(c => c.trim()).filter(Boolean);
    if (cities.length === 0) { toast.error("Enter at least one city"); return; }
    const { error } = await supabase.from("delivery_zones").insert({
      zone_name: form.zone_name.trim(),
      cities,
      delivery_fee: parseFloat(form.delivery_fee) || 0,
      estimated_days: form.estimated_days.trim() || "3-5 days",
      courier_provider_id: form.courier_provider_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Zone added");
    setForm({ zone_name: "", cities: "", delivery_fee: "60", estimated_days: "3-5 days", courier_provider_id: "" });
    setShowCreate(false);
    load();
  };

  const toggle = async (id: string, current: boolean) => {
    await supabase.from("delivery_zones").update({ is_active: !current }).eq("id", id);
    toast.success(current ? "Zone deactivated" : "Zone activated");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("delivery_zones").delete().eq("id", id);
    toast.success("Zone deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{zones.length} delivery zones</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> Add Zone
        </Button>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {showCreate && (
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Zone name (e.g. Dhaka City)" value={form.zone_name} onChange={e => setForm({ ...form, zone_name: e.target.value })} />
            <Input placeholder="Cities (comma-separated: Dhaka, Gazipur)" value={form.cities} onChange={e => setForm({ ...form, cities: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Fee (৳)" type="number" value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: e.target.value })} />
              <Input placeholder="Est. days (e.g. 3-5 days)" value={form.estimated_days} onChange={e => setForm({ ...form, estimated_days: e.target.value })} />
            </div>
            <select
              value={form.courier_provider_id}
              onChange={e => setForm({ ...form, courier_provider_id: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">No courier assigned</option>
              {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={create}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : zones.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No delivery zones yet</div>
      ) : (
        <div className="space-y-2">
          {zones.map(z => (
            <Card key={z.id} className="border shadow-sm">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-medium text-sm text-foreground flex-1">{z.zone_name}</p>
                  <Badge variant="secondary" className="text-xs">৳{z.delivery_fee}</Badge>
                  <Switch checked={z.is_active} onCheckedChange={() => toggle(z.id, z.is_active)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(z.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 pl-6">
                  {(z.cities || []).map((c: string) => (
                    <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {z.estimated_days} · {(z.courier_providers as any)?.name || "No courier"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
