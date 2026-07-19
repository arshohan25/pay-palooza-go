import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, ArrowRight, Clock, XCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

type VendorStatus = "none" | "draft" | "pending" | "under_review" | "rejected" | "approved";

/**
 * Shows a "Apply as EasyPay Shop vendor" CTA on merchant Products/Orders tabs
 * until the vendor application is approved. Hides once approved.
 */
const VendorApplyBanner = (_props: { userId?: string } = {}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<VendorStatus | null>(null);
  const [adminNotes, setAdminNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("merchant_vendor_applications")
        .select("status, admin_notes")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setStatus((data?.status as VendorStatus) ?? "none");
      setAdminNotes(data?.admin_notes ?? null);
    })();

    const ch = (supabase as any)
      .channel(`vendor-apply-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_vendor_applications", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const s = payload.new?.status ?? payload.old?.status;
          if (s) setStatus(s as VendorStatus);
          setAdminNotes(payload.new?.admin_notes ?? null);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      (supabase as any).removeChannel(ch);
    };
  }, [user]);

  if (!status || status === "approved") return null;

  const meta = (() => {
    switch (status) {
      case "pending":
      case "under_review":
        return {
          icon: Clock,
          title: "Vendor application under review",
          desc: "Admins are reviewing your EasyPay Shop upgrade. You'll be notified once approved.",
          cta: "View status",
          tone: "from-amber-500/15 to-orange-500/10 border-amber-400/30 text-amber-100",
        };
      case "rejected":
        return {
          icon: XCircle,
          title: "Vendor application needs changes",
          desc: adminNotes ? `Admin feedback: ${adminNotes}` : "Please resolve admin feedback and resubmit.",
          cta: "Resubmit",
          tone: "from-rose-500/15 to-red-500/10 border-rose-400/30 text-rose-100",
        };
      case "draft":
        return {
          icon: Store,
          title: "Finish your vendor application",
          desc: "Complete your EasyPay Shop upgrade to publish products and receive orders.",
          cta: "Continue",
          tone: "from-emerald-500/15 to-teal-500/10 border-emerald-400/30 text-emerald-100",
        };
      default:
        return {
          icon: ShieldCheck,
          title: "Apply as an EasyPay Shop vendor",
          desc: "Products and orders unlock once your vendor upgrade is approved by admins.",
          cta: "Apply now",
          tone: "from-primary/20 to-accent/10 border-primary/30 text-foreground",
        };
    }
  })();

  const Icon = meta.icon;

  return (
    <div
      className={`mb-4 rounded-2xl border bg-gradient-to-br ${meta.tone} p-4 backdrop-blur-xl shadow-lg`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white/10 p-2 ring-1 ring-white/15">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{meta.title}</p>
          <p className="mt-0.5 text-xs opacity-90">{meta.desc}</p>
        </div>
      </div>
      <Button
        onClick={() => navigate(status === "rejected" ? "/merchant/apply-vendor?resubmit=1" : "/merchant/apply-vendor")}
        className="mt-3 w-full rounded-xl bg-white/95 text-slate-900 hover:bg-white"
        size="sm"
      >
        {meta.cta}
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </div>
  );
};

export default VendorApplyBanner;
