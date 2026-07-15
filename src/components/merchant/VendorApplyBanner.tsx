import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Store, X } from "lucide-react";

/**
 * Shown to merchants who have `merchant` role but not `vendor` role.
 * Dismissible for the session. Links to /merchant/apply-vendor.
 */
export default function VendorApplyBanner({ userId }: { userId: string }) {
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [dismissed, setDismissed] = useState(
    typeof window !== "undefined" && sessionStorage.getItem("vendor_banner_dismissed") === "1",
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: roles }, { data: app }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("merchant_vendor_applications")
          .select("status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      const isVendor = (roles ?? []).some((r: any) => r.role === "vendor");
      if (isVendor) { setShow(false); return; }
      setStatus((app?.status as any) ?? "none");
      setShow(!app || app.status !== "approved");
    })();
    return () => { active = false; };
  }, [userId]);

  if (!show || dismissed) return null;

  return (
    <Card className="mx-4 mt-3 mb-1 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
        <Store className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          {status === "pending" ? "Vendor application under review"
            : status === "rejected" ? "Vendor application was rejected"
            : "Sell products on EasyPay Shop"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {status === "pending" ? "We'll notify you once an admin decides."
            : status === "rejected" ? "You can update and resubmit your application."
            : "Apply for vendor access to list products and reach shoppers."}
        </p>
      </div>
      {status !== "pending" && (
        <Button size="sm" onClick={() => nav("/merchant/apply-vendor")}>
          {status === "rejected" ? "Resubmit" : "Apply"}
        </Button>
      )}
      <Button
        variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => { sessionStorage.setItem("vendor_banner_dismissed", "1"); setDismissed(true); }}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </Card>
  );
}
