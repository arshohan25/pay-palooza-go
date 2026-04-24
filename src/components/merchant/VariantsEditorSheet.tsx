import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Variant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_value: string;
  sku: string | null;
  price_adjustment: number;
  stock: number;
  is_active: boolean;
}

interface Props {
  productId: string | null;
  productName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VariantsEditorSheet({ productId, productName, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ variant_name: "Size", variant_value: "", price_adjustment: "0", stock: "0", sku: "" });

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });
    setVariants(data ?? []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const addVariant = async () => {
    if (!productId) return;
    if (!draft.variant_value.trim()) {
      toast({ title: "Value required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("product_variants").insert({
      product_id: productId,
      variant_name: draft.variant_name.trim() || "Option",
      variant_value: draft.variant_value.trim(),
      sku: draft.sku.trim() || null,
      price_adjustment: Number(draft.price_adjustment) || 0,
      stock: Number(draft.stock) || 0,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setDraft({ variant_name: draft.variant_name, variant_value: "", price_adjustment: "0", stock: "0", sku: "" });
    toast({ title: "Variant added" });
    load();
  };

  const updateVariant = async (id: string, patch: Partial<Variant>) => {
    const { error } = await (supabase as any).from("product_variants").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", variant: "destructive" });
    else load();
  };

  const removeVariant = async (id: string) => {
    const { error } = await (supabase as any).from("product_variants").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", variant: "destructive" });
    else { toast({ title: "Removed" }); load(); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl px-4 pt-5 pb-6 overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="flex items-center gap-2 text-[16px]">
            <Layers size={17} className="text-primary" />
            Variants {productName ? `· ${productName}` : ""}
          </SheetTitle>
          <p className="text-[11.5px] text-muted-foreground">
            Add size/color/option choices. Buyers will pick a variant before adding to cart.
          </p>
        </SheetHeader>

        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : variants.length === 0 ? (
          <div className="text-center py-6 text-[12px] text-muted-foreground">No variants yet — add one below.</div>
        ) : (
          <div className="space-y-2 mb-5">
            {variants.map(v => (
              <div key={v.id} className="bg-card border border-border/60 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-foreground">
                      {v.variant_name}: <span className="text-primary">{v.variant_value}</span>
                    </p>
                    {v.sku && <p className="text-[10px] text-muted-foreground font-mono">SKU: {v.sku}</p>}
                  </div>
                  <button onClick={() => removeVariant(v.id)} className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Trash2 size={12} className="text-destructive" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold">Price ±</label>
                    <Input type="number" defaultValue={v.price_adjustment} className="h-8 text-[12px]"
                      onBlur={(e) => {
                        const val = Number(e.target.value) || 0;
                        if (val !== v.price_adjustment) updateVariant(v.id, { price_adjustment: val });
                      }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold">Stock</label>
                    <Input type="number" defaultValue={v.stock} className="h-8 text-[12px]"
                      onBlur={(e) => {
                        const val = Number(e.target.value) || 0;
                        if (val !== v.stock) updateVariant(v.id, { stock: val });
                      }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-muted/40 border border-border/60 rounded-2xl p-3 space-y-3">
          <p className="text-[12px] font-bold text-foreground">Add variant</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">Type</label>
              <Input value={draft.variant_name} onChange={(e) => setDraft({...draft, variant_name: e.target.value})}
                placeholder="Size / Color" className="h-9 text-[12px]" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">Value</label>
              <Input value={draft.variant_value} onChange={(e) => setDraft({...draft, variant_value: e.target.value})}
                placeholder="M / Red" className="h-9 text-[12px]" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">Price ± (৳)</label>
              <Input type="number" value={draft.price_adjustment}
                onChange={(e) => setDraft({...draft, price_adjustment: e.target.value})}
                className="h-9 text-[12px]" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">Stock</label>
              <Input type="number" value={draft.stock}
                onChange={(e) => setDraft({...draft, stock: e.target.value})}
                className="h-9 text-[12px]" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground font-semibold">SKU (optional)</label>
              <Input value={draft.sku} onChange={(e) => setDraft({...draft, sku: e.target.value})}
                placeholder="SKU-RED-M" className="h-9 text-[12px]" />
            </div>
          </div>
          <Button onClick={addVariant} disabled={saving} className="w-full rounded-xl gap-1.5 h-9 text-[12px]">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Variant
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
