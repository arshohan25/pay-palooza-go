import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ShoppingBag, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface CustomerRow {
  customer_user_id: string;
  customer_name: string;
  customer_phone: string;
  total_spent: number;
  order_count: number;
  last_order_at: string;
  tier: string;
}

const tierColors: Record<string, string> = {
  Gold: "bg-amber-500/10 text-amber-700 border-amber-200",
  Silver: "bg-gray-500/10 text-gray-600 border-gray-200",
  Bronze: "bg-orange-500/10 text-orange-700 border-orange-200",
  New: "bg-blue-500/10 text-blue-700 border-blue-200",
};

const tierLabelKey: Record<string, TranslationKey> = {
  Gold: "mcuTierGold",
  Silver: "mcuTierSilver",
  Bronze: "mcuTierBronze",
  New: "mcuTierNew",
};

export default function MerchantCustomersTab({ merchantId }: { merchantId: string }) {
  const { t, lang } = useI18n();
  const fmt = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_merchant_customers", {
      p_merchant_id: merchantId,
    });
    if (!error && data) setCustomers(data as CustomerRow[]);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => {
    fetchCustomers();

    const channel = supabase
      .channel("merchant-customers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${merchantId}` }, fetchCustomers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCustomers, merchantId]);

  const filtered = search
    ? customers.filter(c =>
        (c.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.customer_phone || "").includes(search)
      )
    : customers;

  const totalRevenue = customers.reduce((s, c) => s + Number(c.total_spent), 0);
  const totalOrders = customers.reduce((s, c) => s + Number(c.order_count), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Users size={18} className="text-primary" /> {t("mcuTitle")}
      </h3>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-foreground">{fmt(customers.length)}</p>
            <p className="text-[10px] text-muted-foreground">{t("mcuTotalCustomers")}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">৳{fmt(Number((totalRevenue / 1000).toFixed(1)))}k</p>
            <p className="text-[10px] text-muted-foreground">{t("mcuLifetimeValue")}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">৳{fmt(Math.round(avgOrderValue))}</p>
            <p className="text-[10px] text-muted-foreground">{t("mcuAvgOrder")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      {customers.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("mcuSearchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      )}

      {/* Customer list */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-8 text-center">
            <Users size={32} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {customers.length === 0 ? t("mcuNoCustomers") : t("mcuNoResults")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {customers.length === 0 ? t("mcuNoCustomersDesc") : t("mcuTryDifferent")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.customer_user_id} className="border-0 shadow-elevated">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(c.customer_name || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{c.customer_name || t("mcuUnknown")}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.customer_phone || "—"} · {c.last_order_at ? formatDistanceToNow(new Date(c.last_order_at), { addSuffix: true }) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-bold text-foreground">৳{fmt(Number(c.total_spent))}</p>
                    <div className="flex items-center gap-1 justify-end">
                      <ShoppingBag size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{t("mcuOrdersN").replace("{n}", fmt(c.order_count))}</span>
                      <Badge variant="outline" className={`text-[8px] ml-1 ${tierColors[c.tier] || ""}`}>
                        {tierLabelKey[c.tier] ? t(tierLabelKey[c.tier]) : c.tier}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
