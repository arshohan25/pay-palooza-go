import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, PackageX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface StockItem {
  id: string;
  name: string;
  stock: number;
  threshold: number;
  emoji: string;
}

interface Props {
  merchantId: string;
  /** Legacy fallback threshold used only when a product has none set. */
  threshold?: number;
}

const MerchantInventoryAlerts = ({ merchantId }: Props) => {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const fmtNum = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
  const [out, setOut] = useState<StockItem[]>([]);
  const [low, setLow] = useState<StockItem[]>([]);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).rpc("get_merchant_stock_alerts", {
      p_merchant_id: merchantId,
    });
    if (!data) return;
    setOut(((data.out_of_stock as StockItem[]) || []).slice(0, 10));
    setLow(((data.low_stock as StockItem[]) || []).slice(0, 10));
  }, [merchantId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`merchant-stock-${merchantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_products", filter: `merchant_id=eq.${merchantId}` },
        load,
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, merchantId]);

  const restock = async (item: StockItem, amount: number) => {
    const newStock = Math.max(0, item.stock + amount);
    await (supabase as any)
      .from("merchant_products")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    toast({ title: t("miaRestocked").replace("{name}", item.name) });
    load();
  };

  const row = (item: StockItem, isOut: boolean) => (
    <div key={item.id} className="flex items-center gap-2 bg-background/60 rounded-xl px-2.5 py-2">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <span className="text-sm">{item.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
        <p className={`text-[10px] font-bold ${isOut ? "text-destructive" : "text-amber-600"}`}>
          {isOut
            ? t("miaOutOfStock")
            : `${t("miaLeft").replace("{n}", fmtNum(item.stock))} · ${t("miaThresholdShort").replace("{n}", fmtNum(item.threshold))}`}
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
  );

  if (out.length === 0 && low.length === 0) return null;

  return (
    <div className="space-y-2">
      {out.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <PackageX size={14} className="text-destructive" />
            <span className="text-xs font-bold text-destructive">
              {t("miaOutOfStockCount").replace("{n}", fmtNum(out.length))}
            </span>
          </div>
          <div className="space-y-1.5">{out.map((i) => row(i, true))}</div>
        </div>
      )}
      {low.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
              {(low.length > 1 ? t("miaLowStockMany") : t("miaLowStockOne")).replace("{n}", fmtNum(low.length))}
            </span>
          </div>
          <div className="space-y-1.5">{low.map((i) => row(i, false))}</div>
        </div>
      )}
    </div>
  );
};

export default MerchantInventoryAlerts;
