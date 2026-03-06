import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CreditCard, Smartphone, Mail, MessageSquare, ScanFace, Shield,
  RefreshCw, CheckCircle, XCircle, AlertCircle, Settings2, Loader2,
} from "lucide-react";

interface ApiItem {
  name: string;
  provider?: string;
  category: string;
  status: "connected" | "disabled" | "not_configured";
  lastUpdated?: string;
  navigateTo?: string;
}

interface AdminApiHubProps {
  onNavigate: (tab: string) => void;
}

export default function AdminApiHub({ onNavigate }: AdminApiHubProps) {
  const [apis, setApis] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch payment gateways, recharge configs, and secret status in parallel
      const [gwRes, rechargeRes, secretRes] = await Promise.all([
        supabase.functions.invoke("manage-gateway-config", {
          body: { action: "list", table: "payment_gateways" },
        }),
        supabase.functions.invoke("manage-gateway-config", {
          body: { action: "list", table: "recharge_api_configs" },
        }),
        supabase.functions.invoke("check-api-status", { body: {} }),
      ]);

      const items: ApiItem[] = [];

      // Payment Gateways
      const gateways = (gwRes.data as any[]) ?? [];
      for (const gw of gateways) {
        const hasConfig = gw.config && Object.values(gw.config).some((v: any) => v && v !== "");
        items.push({
          name: gw.display_name,
          provider: gw.provider,
          category: "Payment Gateways",
          status: gw.is_enabled && hasConfig ? "connected" : !hasConfig ? "not_configured" : "disabled",
          lastUpdated: gw.updated_at,
          navigateTo: "gateways",
        });
      }

      // Recharge Operators
      const recharges = (rechargeRes.data as any[]) ?? [];
      for (const rc of recharges) {
        const hasConfig = rc.config && Object.values(rc.config).some((v: any) => v && v !== "");
        items.push({
          name: rc.display_name,
          provider: rc.operator,
          category: "Recharge Operators",
          status: rc.is_enabled && hasConfig ? "connected" : !hasConfig ? "not_configured" : "disabled",
          lastUpdated: rc.updated_at,
          navigateTo: "recharge",
        });
      }

      // Services from secret checks
      const services = (secretRes.data as any)?.services ?? {};

      items.push({
        name: "SMS (Twilio)",
        category: "SMS",
        status: services.sms ? "connected" : "not_configured",
        navigateTo: "gateways",
      });
      items.push({
        name: "Email (Resend)",
        category: "Email",
        status: services.email ? "connected" : "not_configured",
        navigateTo: "gateways",
      });
      items.push({
        name: "KYC – OCR",
        category: "KYC",
        status: services.kyc_ocr ? "connected" : "not_configured",
        navigateTo: "kyc",
      });
      items.push({
        name: "KYC – Face Match",
        category: "KYC",
        status: services.kyc_face_match ? "connected" : "not_configured",
        navigateTo: "kyc",
      });
      items.push({
        name: "OTP Service",
        category: "Auth / Device",
        status: services.otp ? "connected" : "not_configured",
        navigateTo: "permissions",
      });
      items.push({
        name: "Device Validation",
        category: "Auth / Device",
        status: services.device_validation ? "connected" : "not_configured",
        navigateTo: "permissions",
      });

      setApis(items);
    } catch (err) {
      console.error("Failed to load API hub data", err);
      toast.error("Failed to load API status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const connected = apis.filter(a => a.status === "connected").length;
  const total = apis.length;

  // Group by category
  const grouped = apis.reduce<Record<string, ApiItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const categoryIcons: Record<string, any> = {
    "Payment Gateways": CreditCard,
    "Recharge Operators": Smartphone,
    "SMS": MessageSquare,
    "Email": Mail,
    "KYC": ScanFace,
    "Auth / Device": Shield,
  };

  const statusBadge = (s: ApiItem["status"]) => {
    if (s === "connected") return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
    if (s === "disabled") return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0"><AlertCircle className="w-3 h-3 mr-1" />Disabled</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-0"><XCircle className="w-3 h-3 mr-1" />Not Configured</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">API Hub</h2>
          <Badge variant="secondary" className="text-sm">
            {connected} / {total} connected
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Grouped cards */}
      {Object.entries(grouped).map(([category, items]) => {
        const Icon = categoryIcons[category] ?? Settings2;
        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{category}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((item, idx) => (
                <Card key={idx} className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                      {item.lastUpdated && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Updated {new Date(item.lastUpdated).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(item.status)}
                      {item.navigateTo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onNavigate(item.navigateTo!)}
                          title="Configure"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
