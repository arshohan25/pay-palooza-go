import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Layers, AlertTriangle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

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
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmt = (n: number) => Number(n).toLocaleString(locale);

  const friendlyError = (msg?: string) => {
    if (!msg) return t("vesErrSomething");
    if (msg.includes("uniq_variant_sku_per_product") || (msg.includes("23505") && msg.includes("sku"))) return t("vesErrSkuDup");
    if (msg.includes("uniq_variant_attr_per_product") || msg.includes("23505")) return t("vesErrAttrDup");
    if (msg.includes("product_variants_stock_nonneg")) return t("vesStockNeg");
    if (msg.includes("product_variants_price_adj_bounds")) return t("vesErrPriceBounds");
    if (msg.includes("23514")) return t("vesErrCheckValues");
    return msg;
  };

  const [variants, setVariants] = useState<Variant[]>([]);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ variant_name: "Size", variant_value: "", price_adjustment: "0", stock: "0", sku: "" });

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const [vRes, pRes] = await Promise.all([
      (supabase as any).from("product_variants").select("*").eq("product_id", productId).order("created_at", { ascending: true }),
      (supabase as any).from("merchant_products").select("price").eq("id", productId).maybeSingle(),
    ]);
    setVariants(vRes.data ?? []);
    setBasePrice(Number(pRes.data?.price ?? 0));
    setLoading(false);
  }, [productId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  // Live duplicate detection
  const validation = useMemo(() => {
    const skuLower = draft.sku.trim().toLowerCase();
    const nameLower = draft.variant_name.trim().toLowerCase();
    const valueLower = draft.variant_value.trim().toLowerCase();
    const skuClash = !!skuLower && variants.some(v => (v.sku ?? "").toLowerCase() === skuLower);
    const attrClash = !!valueLower && variants.some(v =>
      v.variant_name.toLowerCase() === nameLower && v.variant_value.toLowerCase() === valueLower);
    const adj = Number(draft.price_adjustment) || 0;
    const stock = Number(draft.stock) || 0;
    const finalPrice = basePrice + adj;
    const priceWarning = finalPrice <= 0 ? t("vesPriceWarning").replace("{price}", fmt(finalPrice)) : null;
    const stockInvalid = stock < 0;
    return { skuClash, attrClash, priceWarning, stockInvalid, finalPrice };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, variants, basePrice, lang]);

  const addVariant = async () => {
    if (!productId) return;
    if (!draft.variant_value.trim()) { toast({ title: t("vesToastValueRequired"), variant: "destructive" }); return; }
    if (validation.skuClash) { toast({ title: t("vesToastSkuUsed"), variant: "destructive" }); return; }
    if (validation.attrClash) { toast({ title: t("vesToastOptionExists"), variant: "destructive" }); return; }
    if (validation.stockInvalid) { toast({ title: t("vesStockNeg"), variant: "destructive" }); return; }

    setSaving(true);
    const { error } = await (supabase as any).from("product_variants").insert({
      product_id: productId,
      variant_name: draft.variant_name.trim() || t("vesDefaultOption"),
      variant_value: draft.variant_value.trim(),
      sku: draft.sku.trim() || null,
      price_adjustment: Number(draft.price_adjustment) || 0,
      stock: Number(draft.stock) || 0,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast({ title: t("vesToastFailed"), description: friendlyError(error.message), variant: "destructive" }); return; }
    setDraft({ variant_name: draft.variant_name, variant_value: "", price_adjustment: "0", stock: "0", sku: "" });
    toast({ title: t("vesToastAdded") });
    load();
  };

  const updateVariant = async (id: string, patch: Partial<Variant>) => {
    if (patch.stock !== undefined && patch.stock < 0) {
      toast({ title: t("vesStockNeg"), variant: "destructive" });
      load();
      return;
    }
    const { error } = await (supabase as any).from("product_variants").update(patch).eq("id", id);
    if (error) toast({ title: t("vesToastUpdateFailed"), description: friendlyError(error.message), variant: "destructive" });
    else load();
  };

  const removeVariant = async (id: string) => {
    const { error } = await (supabase as any).from("product_variants").delete().eq("id", id);
    if (error) toast({ title: t("vesToastDeleteFailed"), variant: "destructive" });
    else { toast({ title: t("vesToastRemoved") }); load(); }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("vesToastCopied") });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl px-4 pt-5 pb-6 overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="flex items-center gap-2 text-[16px]">
            <Layers size={17} className="text-primary" />
            {t("vesTitle")} {productName ? `· ${productName}` : ""}
          </SheetTitle>
          <p className="text-[11.5px] text-muted-foreground">
            {t("vesSubtitleBase")} <strong>৳{fmt(basePrice)}</strong>
          </p>
        </SheetHeader>

        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : variants.length === 0 ? (
          <div className="text-center py-6 text-[12px] text-muted-foreground">{t("vesNoVariants")}</div>
        ) : (
          <div className="space-y-2 mb-5">
            {variants.map(v => {
              const finalPrice = basePrice + Number(v.price_adjustment || 0);
              return (
                <div key={v.id} className="bg-card border border-border/60 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-foreground">
                        {v.variant_name}: <span className="text-primary">{v.variant_value}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {v.sku && (
                          <button onClick={() => copyText(v.sku!)}
                            className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                            {v.sku} <Copy size={9} />
                          </button>
                        )}
                        <span className="text-[10px] text-muted-foreground">· ৳{fmt(finalPrice)}</span>
                      </div>
                    </div>
                    <button onClick={() => removeVariant(v.id)} className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Trash2 size={12} className="text-destructive" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-semibold">{t("vesPriceAdj")}</label>
                      <Input type="number" defaultValue={v.price_adjustment} className="h-8 text-[12px]"
                        onBlur={(e) => {
                          const val = Number(e.target.value) || 0;
                          if (val !== v.price_adjustment) updateVariant(v.id, { price_adjustment: val });
                        }} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-semibold">{t("vesStock")}</label>
                      <Input type="number" min={0} defaultValue={v.stock} className="h-8 text-[12px]"
                        onBlur={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          if (val !== v.stock) updateVariant(v.id, { stock: val });
                        }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new */}
        <div className="bg-muted/40 border border-border/60 rounded-2xl p-3 space-y-3">
          <p className="text-[12px] font-bold text-foreground">{t("vesAddVariant")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">{t("vesType")}</label>
              <Input value={draft.variant_name} onChange={(e) => setDraft({...draft, variant_name: e.target.value})}
                placeholder={t("vesTypePlaceholder")} className="h-9 text-[12px]" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">{t("vesValue")}</label>
              <Input value={draft.variant_value} onChange={(e) => setDraft({...draft, variant_value: e.target.value})}
                placeholder={t("vesValuePlaceholder")}
                className={`h-9 text-[12px] ${validation.attrClash ? "border-destructive" : ""}`} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">{t("vesPriceAdjBdt")}</label>
              <Input type="number" value={draft.price_adjustment}
                onChange={(e) => setDraft({...draft, price_adjustment: e.target.value})}
                className="h-9 text-[12px]" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">{t("vesStock")}</label>
              <Input type="number" min={0} value={draft.stock}
                onChange={(e) => setDraft({...draft, stock: e.target.value})}
                className={`h-9 text-[12px] ${validation.stockInvalid ? "border-destructive" : ""}`} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground font-semibold">{t("vesSkuOptional")}</label>
              <Input value={draft.sku} onChange={(e) => setDraft({...draft, sku: e.target.value})}
                placeholder="SKU-RED-M"
                className={`h-9 text-[12px] font-mono ${validation.skuClash ? "border-destructive" : ""}`} />
            </div>
          </div>

          {/* Validation messages */}
          <div className="space-y-1">
            {validation.attrClash && (
              <p className="text-[10.5px] text-destructive flex items-center gap-1">
                <AlertTriangle size={11} /> {t("vesAttrExists").replace("{name}", draft.variant_name).replace("{value}", draft.variant_value)}
              </p>
            )}
            {validation.skuClash && (
              <p className="text-[10.5px] text-destructive flex items-center gap-1">
                <AlertTriangle size={11} /> {t("vesSkuClash")}
              </p>
            )}
            {validation.stockInvalid && (
              <p className="text-[10.5px] text-destructive flex items-center gap-1">
                <AlertTriangle size={11} /> {t("vesStockNeg")}
              </p>
            )}
            {validation.priceWarning && (
              <p className="text-[10.5px] text-amber-600 flex items-center gap-1">
                <AlertTriangle size={11} /> {validation.priceWarning}{t("vesPriceWarningSuffix")}
              </p>
            )}
            {!validation.attrClash && !validation.skuClash && !validation.priceWarning && draft.variant_value.trim() && (
              <p className="text-[10.5px] text-muted-foreground">
                {t("vesFinalPrice")} <strong className="text-foreground">৳{fmt(validation.finalPrice)}</strong>
              </p>
            )}
          </div>

          <Button onClick={addVariant}
            disabled={saving || validation.skuClash || validation.attrClash || validation.stockInvalid}
            className="w-full rounded-xl gap-1.5 h-9 text-[12px]">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {t("vesAddBtn")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
