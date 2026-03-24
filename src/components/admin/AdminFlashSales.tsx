import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Zap, Plus, Trash2, Pencil } from "lucide-react";

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details });
  }
}

export default function AdminFlashSales() {
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ product_id: "", sale_price: "", starts_at: "", ends_at: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("flash_sales")
      .select("*, merchant_products(name, price, image_url, emoji)")
      .order("created_at", { ascending: false });
    setSales(data ?? []);
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from("merchant_products")
      .select("id, name, price")
      .eq("is_active", true)
      .order("name")
      .limit(500);
    setProducts(data ?? []);
  };

  useEffect(() => { load(); loadProducts(); }, []);

  const resetForm = () => setForm({ product_id: "", sale_price: "", starts_at: "", ends_at: "" });

  const create = async () => {
    if (!form.product_id || !form.sale_price || !form.starts_at || !form.ends_at) {
      toast.error("All fields are required");
      return;
    }
    const { data, error } = await (supabase as any).from("flash_sales").insert({
      product_id: form.product_id,
      sale_price: parseFloat(form.sale_price),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await auditLog("flash_sale_create", "flash_sale", data.id, { product_id: form.product_id, sale_price: parseFloat(form.sale_price) });
    toast.success("Flash sale created");
    setShowCreate(false);
    resetForm();
    load();
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      product_id: s.product_id,
      sale_price: String(s.sale_price),
      starts_at: new Date(s.starts_at).toISOString().slice(0, 16),
      ends_at: new Date(s.ends_at).toISOString().slice(0, 16),
    });
  };

  const saveEdit = async () => {
    if (!editing || !form.sale_price || !form.starts_at || !form.ends_at) {
      toast.error("All fields are required"); return;
    }
    const { error } = await (supabase as any).from("flash_sales").update({
      sale_price: parseFloat(form.sale_price),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    await auditLog("flash_sale_edit", "flash_sale", editing.id, { sale_price: parseFloat(form.sale_price) });
    toast.success("Flash sale updated");
    setEditing(null);
    resetForm();
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase as any).from("flash_sales").update({ is_active: !current }).eq("id", id);
    await auditLog("flash_sale_toggle", "flash_sale", id, { is_active: !current });
    toast.success(!current ? "Activated" : "Deactivated");
    load();
  };

  const deleteSale = async (id: string) => {
    await (supabase as any).from("flash_sales").delete().eq("id", id);
    await auditLog("flash_sale_delete", "flash_sale", id, {});
    toast.success("Flash sale deleted");
    load();
  };

  const isActive = (s: any) => s.is_active && new Date(s.starts_at) <= new Date() && new Date(s.ends_at) > new Date();
  const dialogOpen = showCreate || !!editing;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        <p className="text-sm font-medium text-foreground flex-1">Flash Sales</p>
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New Sale
        </Button>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          <p>No flash sales yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sales.map((s) => {
            const prod = s.merchant_products as any;
            const live = isActive(s);
            return (
              <Card key={s.id} className="border shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  {prod?.image_url ? (
                    <img src={prod.image_url} alt={prod.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className="text-xl shrink-0">{prod?.emoji || "📦"}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{prod?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      ৳{prod?.price} → <span className="text-destructive font-semibold">৳{s.sale_price}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.starts_at).toLocaleDateString()} – {new Date(s.ends_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={live ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {live ? "🔴 Live" : s.is_active ? "Scheduled" : "Off"}
                  </Badge>
                  <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Flash Sale</AlertDialogTitle>
                        <AlertDialogDescription>Delete this flash sale for "{prod?.name}"? This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteSale(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setShowCreate(false); setEditing(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Flash Sale" : "Create Flash Sale"}</DialogTitle>
            <DialogDescription>{editing ? "Update sale price and dates." : "Set up a new flash sale."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.product_id}
                onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))}
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (৳{p.price})</option>
                ))}
              </select>
            )}
            <Input placeholder="Sale price ৳" value={form.sale_price} onChange={(e) => setForm((p) => ({ ...p, sale_price: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Starts</label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ends</label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button size="sm" onClick={editing ? saveEdit : create}>{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
