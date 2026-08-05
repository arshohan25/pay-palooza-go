import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AlertOctagon, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function MerchantDisputesTile({ merchantId, onOpen }: { merchantId: string; onOpen?: () => void }) {
  const { t } = useI18n();
  const [openCount, setOpenCount] = useState(0);
  const [total, setTotal] = useState(0);


  const load = useCallback(async () => {
    // Find transactions belonging to this merchant, then count linked disputes.
    const { data: txns } = await (supabase as any)
      .from("transactions")
      .select("id")
      .eq("merchant_id", merchantId)
      .limit(1000);
    const ids = (txns || []).map((t: any) => t.id);
    if (ids.length === 0) { setOpenCount(0); setTotal(0); return; }
    const { data: disp } = await (supabase as any)
      .from("disputes")
      .select("id,status")
      .in("transaction_id", ids);
    const rows = (disp || []) as { status: string }[];
    setTotal(rows.length);
    setOpenCount(rows.filter(r => r.status !== "resolved" && r.status !== "closed" && r.status !== "rejected").length);
  }, [merchantId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`merch-disp-${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, load]);

  const hasOpen = openCount > 0;

  return (
    <Card
      onClick={onOpen}
      className={`p-3 border-0 shadow-elevated cursor-pointer transition-transform active:scale-[0.98] bg-gradient-to-br ${
        hasOpen ? "from-red-500/10 via-red-500/5 to-transparent" : "from-blue-500/10 via-blue-500/5 to-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasOpen ? "bg-red-500/15" : "bg-blue-500/15"}`}>
          {hasOpen ? <AlertOctagon size={18} className="text-red-600" /> : <Shield size={18} className="text-blue-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground">{t("mdtInbox")}</p>
          <p className="text-base font-extrabold text-foreground">
            {hasOpen ? t("mdtOpen").replace("{n}", String(openCount)) : t("mdtAllClear")}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("mdtTotal").replace("{n}", String(total))}</p>

        </div>
      </div>
    </Card>
  );
}
