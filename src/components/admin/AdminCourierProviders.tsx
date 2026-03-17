import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Truck } from "lucide-react";

export default function AdminCourierProviders() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", logo_url: "", tracking_url_template: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("courier_providers")
      .select("*")
      .order("created_at", { ascending: false });
    setProviders(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("courier_providers").insert({
      name: form.name.trim(),
      logo_url: form.logo_url.trim() || null,
      tracking_url_template: form.tracking_url_template.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Courier added");
    setForm({ name: "", logo_url: "", tracking_url_template: "" });
    setShowCreate(false);
    load();
  };

  const toggle = async (id: string, current: boolean) => {
    await supabase.from("courier_providers").update({ is_active: !current }).eq("id", id);
    toast.success(current ? "Deactivated" : "Activated");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("courier_providers").delete().eq("id", id);
    toast.success("Courier deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{providers.length} courier providers</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> Add Courier
        </Button>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {showCreate && (
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Courier name (e.g. Pathao)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Logo URL (optional)" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} />
            <Input placeholder="Tracking URL template (use {tracking_id})" value={form.tracking_url_template} onChange={e => setForm({ ...form, tracking_url_template: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={create}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No courier providers yet</div>
      ) : (
        <div className="space-y-2">
          {providers.map(p => (
            <Card key={p.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{p.name}</p>
                  {p.tracking_url_template && (
                    <p className="text-xs text-muted-foreground truncate">{p.tracking_url_template}</p>
                  )}
                </div>
                <Switch checked={p.is_active} onCheckedChange={() => toggle(p.id, p.is_active)} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
