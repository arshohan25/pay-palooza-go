import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type Status = "none" | "pending" | "approved" | "rejected";

export default function MerchantKycStatusBanner({ merchantId }: { merchantId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("approved");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("merchants")
        .select("business_kyc_status, business_kyc_rejection_reason")
        .eq("id", merchantId)
        .maybeSingle();
      if (!alive || !data) return;
      const s = (data.business_kyc_status as string) || "pending";
      setStatus(["approved", "pending", "rejected"].includes(s) ? (s as Status) : "none");
      setReason(data.business_kyc_rejection_reason ?? null);
    };
    load();
    const ch = supabase
      .channel(`merchant-kyc-${merchantId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "merchants", filter: `id=eq.${merchantId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [merchantId]);

  if (status === "approved") return null;

  const rejected = status === "rejected";
  const pending = status === "pending";
  const Icon = rejected ? AlertTriangle : pending ? Clock : ShieldCheck;

  return (
    <Card
      className={`p-3 border rounded-2xl shadow-card ${
        rejected
          ? "bg-destructive/10 border-destructive/30"
          : pending
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-muted/40 border-border/50"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={rejected ? "text-destructive mt-0.5" : pending ? "text-amber-600 mt-0.5" : "text-muted-foreground mt-0.5"} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-foreground">
            {rejected ? t("mkycRejectedTitle") : pending ? t("mkycPendingTitle") : t("mkycNoneTitle")}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {rejected ? reason || t("mkycResubmit") : pending ? t("mkycPendingDesc") : t("mkycStart")}
          </p>
          {!pending && (
            <Button size="sm" className="h-7 mt-2 rounded-full text-[11px] font-bold"
              onClick={() => navigate("/merchant/apply")}>
              {rejected ? t("mkycResubmit") : t("mkycStart")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
