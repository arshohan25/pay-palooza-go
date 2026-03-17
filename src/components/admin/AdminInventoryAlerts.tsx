import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, Package, Edit2 } from "lucide-react";

export default function AdminInventoryAlerts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("merchant_products")
      .select("id, name, stock, price, image_url, emoji, is_active, vendor_stores(store_name)")
      .eq("is_active", true)
      .lte("stock", threshold)
      .order("stock", { ascending: true })
      .limit(200);
    setProducts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [threshold]);

  const updateStock = async (id: string) => {
    const val = parseInt(editStock);
    if (isNaN(val) || val < 0) { toast.error("Invalid stock value"); return; }
    await supabase.from("merchant_products").update({ stock: val }).eq("id", id);
    toast.success("Stock updated");
    setEditingId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <p className="text-sm font-medium text-foreground flex-1">Low Stock Products</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Threshold:</span>
          <Input
            type="number"
            className="w-16 h-7 text-xs"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 5)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          <p>No products below threshold</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{products.length} products with stock ≤ {threshold}</p>
          {products.map((p) => (
            <Card key={p.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg">
                    {p.emoji || "📦"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{(p.vendor_stores as any)?.store_name || "No store"}</p>
                </div>
                <Badge variant={p.stock === 0 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                  {p.stock === 0 ? "Out of Stock" : `${p.stock} left`}
                </Badge>
                {editingId === p.id ? (
                  <div className="flex gap-1 shrink-0">
                    <Input className="w-16 h-7 text-xs" value={editStock} onChange={(e) => setEditStock(e.target.value)} />
                    <Button size="sm" className="h-7 text-xs" onClick={() => updateStock(p.id)}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>✕</Button>
                  </div>
                ) : (
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setEditingId(p.id); setEditStock(p.stock?.toString() || "0"); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
