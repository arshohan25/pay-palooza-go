import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, XCircle, Store, CheckCircle2, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";


/**
 * Blocks rendering of vendor-only features until the current merchant has an
 * approved `merchant_vendor_applications` row. Shows a clear status page while
 * pending / rejected / not applied.
 */
export default function VendorAccessGate({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "approved" | "pending" | "rejected" | "none">("loading");
  const [app, setApp] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("merchant_vendor_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setApp(data);
      setState(data?.status === "approved" ? "approved"
             : data?.status === "pending"  ? "pending"
             : data?.status === "rejected" ? "rejected"
             : "none");
    };
    load();
    const ch = supabase
      .channel(`vendor-gate-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "merchant_vendor_applications", filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (state === "loading") {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (state === "approved") return <>{children}</>;

  const meta = {
    pending:  { icon: Clock,     tone: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
                title: "Vendor application under review",
                desc: "An admin is reviewing your shop details and photos. Vendor features unlock as soon as it's approved — we'll notify you." },
    rejected: { icon: XCircle,   tone: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
                title: "Vendor application was rejected",
                desc: "Please review the admin feedback and resubmit updated shop photos to try again." },
    none:     { icon: Store,     tone: "bg-primary/10 border-primary/30 text-primary",
                title: "Vendor access required",
                desc: "This section is only available to approved vendors. Apply for vendor access to start selling products." },
  }[state] as { icon: any; tone: string; title: string; desc: string };
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto pt-10 space-y-4">
        <Card className={`border ${meta.tone}`}>
          <CardContent className="p-6 text-center space-y-3">
            <Icon className="w-10 h-10 mx-auto" />
            <div>
              <p className="font-bold text-lg">{meta.title}</p>
              <p className="text-sm opacity-80 mt-1">{meta.desc}</p>
            </div>
            {app?.admin_notes && state === "rejected" && (
              <div className="text-xs bg-background/60 border border-border rounded-md p-3 text-left">
                <p className="font-semibold mb-1">Admin feedback</p>
                <p className="text-muted-foreground">{app.admin_notes}</p>
              </div>
            )}
            {app?.status && (
              <Badge className="text-[10px]">
                {app.status} · submitted {new Date(app.created_at).toLocaleDateString()}
              </Badge>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => nav("/merchant")}>Back to Merchant</Button>
              <Button onClick={() => nav("/merchant/apply-vendor")}>
                {state === "rejected" ? "Resubmit application" : state === "pending" ? "View application" : "Apply now"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
        {state === "pending" && (
          <p className="text-[11px] text-center text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 inline mr-1" /> You can keep using your merchant account normally while you wait.
          </p>
        )}
      </div>
    </div>
  );
}
