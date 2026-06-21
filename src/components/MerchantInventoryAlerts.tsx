import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  emoji: string;
  image_url: string | null;
}

interface Props {
  merchantId: string;
  threshold?: number;
}

const MerchantInventoryAlerts = ({ merchantId, threshold = 5 }: Props) => {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const fmtNum = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
  const [items, setItems] = useState<LowStockItem[]>([]);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("merchant_products")
      .select("id, name, stock, emoji, image_url")
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .lte("stock", threshold)
      .order("stock", { ascending: true })
      .limit(10);
    setItems((data || []) as LowStockItem[]);
  }, [merchantId, threshold]);

  useEffect(() => { load(); }, [load]);

  const restock = async (item: LowStockItem, amount: number) => {
    const newStock = Math.max(0, item.stock + amount);
    await (supabase as any)
      .from("merchant_products")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: newStock } : i).filter(i => i.stock <= threshold));
    if (newStock > threshold) toast({ title: t("miaRestocked").replace("{name}", item.name) });
  };

  if (items.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-600" />
        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
          {(items.length > 1 ? t("miaLowStockMany") : t("miaLowStockOne")).replace("{n}", fmtNum(items.length))}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-background/60 rounded-xl px-2.5 py-2">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm">{item.emoji}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
              <p className={`text-[10px] font-bold ${item.stock === 0 ? "text-destructive" : "text-amber-600"}`}>
                {item.stock === 0 ? t("miaOutOfStock") : t("miaLeft").replace("{n}", fmtNum(item.stock))}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => restock(item, 10)}
                className="px-2 py-1 rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                +{fmtNum(10)}
              </button>
              <button onClick={() => restock(item, 50)}
                className="px-2 py-1 rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                +{fmtNum(50)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MerchantInventoryAlerts;
