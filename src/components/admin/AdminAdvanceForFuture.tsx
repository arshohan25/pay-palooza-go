import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  Loader2,
  Radar,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type Visibility = "hidden" | "disabled" | "visible";
type LaunchStage = "Planned" | "Admin Ready" | "App Ready" | "Live";

interface FutureToggle {
  id: string;
  feature_key: string;
  label: string;
  description: string | null;
  is_enabled: boolean;
  visibility: Visibility | string;
}

interface FutureFeature {
  key: string;
  title: string;
  summary: string;
  target: string;
  risk: "Low" | "Medium" | "High";
  icon: typeof Sparkles;
  adminLinks: { label: string; tab: string }[];
  capabilities: string[];
  dependencies: string[];
  readiness: number;
}

const futureFeatures: FutureFeature[] = [
  {
    key: "future_ai_copilot",
    title: "AI Financial Copilot",
    summary: "Spending intelligence, low-balance prediction, and personalized budget or offer recommendations.",
    target: "User App",
    risk: "Medium",
    icon: Bot,
    adminLinks: [{ label: "AI Agent", tab: "ai_agent" }, { label: "User Performance", tab: "user_performance" }],
    capabilities: ["Spending insights", "Low-balance prediction", "Personalized recommendations"],
    dependencies: ["Transactions", "Budget manager", "AI reward signals"],
    readiness: 72,
  },
  {
    key: "future_scam_shield",
    title: "Real-Time Scam Shield",
    summary: "Pre-confirmation transaction risk warnings using velocity, recipient history, device trust, and unusual amount checks.",
    target: "User / Agent App",
    risk: "High",
    icon: ShieldAlert,
    adminLinks: [{ label: "AI Fraud", tab: "ai_fraud" }, { label: "Risk Control", tab: "risk_control" }, { label: "Fraud Alerts", tab: "alerts" }],
    capabilities: ["Monitor / Warn / Block", "Velocity checks", "Device and recipient risk"],
    dependencies: ["Fraud rules", "Device manager", "Transaction history"],
    readiness: 68,
  },
  {
    key: "future_easypay_score",
    title: "EasyPay Trust Score",
    summary: "Alternative-data scoring for Qard Hasan eligibility, offer targeting, account limits, and risk controls.",
    target: "User App",
    risk: "High",
    icon: CreditCard,
    adminLinks: [{ label: "Loan Management", tab: "loans" }, { label: "User Metrics", tab: "users" }],
    capabilities: ["KYC + activity scoring", "Repayment behavior", "Limit intelligence"],
    dependencies: ["KYC", "Loans", "Fraud signals"],
    readiness: 64,
  },
  {
    key: "future_compliance_center",
    title: "Compliance Command Center",
    summary: "LEA integrity, PDF hash verification, suspicious activity timelines, and audit readiness controls.",
    target: "Admin App",
    risk: "Medium",
    icon: FileCheck2,
    adminLinks: [{ label: "LEA Request", tab: "lea_request" }, { label: "Audit Log", tab: "auditlog" }, { label: "Data Export", tab: "data_export" }],
    capabilities: ["Report integrity", "Hash verification", "Audit timeline"],
    dependencies: ["LEA reports", "Audit logs", "Data export"],
    readiness: 80,
  },
  {
    key: "future_agent_liquidity_intel",
    title: "Agent Liquidity Intelligence",
    summary: "Float shortage prediction, territory risk ranking, and distributor restock recommendations.",
    target: "Agent / Distributor App",
    risk: "Medium",
    icon: TrendingUp,
    adminLinks: [{ label: "Liquidity", tab: "liquidity" }, { label: "Agent Hub", tab: "agent_hub" }, { label: "Float Mgmt", tab: "float_mgmt" }],
    capabilities: ["Float prediction", "Territory ranking", "Restock recommendations"],
    dependencies: ["Agent network", "Float management", "MFS monitor"],
    readiness: 76,
  },
  {
    key: "future_merchant_growth_os",
    title: "Merchant Growth OS",
    summary: "Sales trend insights, inventory reorder suggestions, and customer retention opportunities.",
    target: "Merchant App",
    risk: "Low",
    icon: Store,
    adminLinks: [{ label: "Merchants", tab: "merchants" }, { label: "E-Commerce", tab: "ecommerce" }, { label: "Orders", tab: "orders" }],
    capabilities: ["Sales trends", "Inventory reorder", "Retention opportunities"],
    dependencies: ["Orders", "Products", "Merchant analytics"],
    readiness: 70,
  },
  {
    key: "future_identity_wallet",
    title: "Identity & Security Upgrades",
    summary: "Passkey-ready security, reusable KYC wallet status, and device trust scoring.",
    target: "User / Merchant / Agent App",
    risk: "High",
    icon: KeyRound,
    adminLinks: [{ label: "KYC", tab: "kyc" }, { label: "Devices", tab: "devices" }, { label: "Security", tab: "security" }],
    capabilities: ["Passkey readiness", "Reusable KYC profile", "Device trust score"],
    dependencies: ["KYC", "Device manager", "Security center"],
    readiness: 62,
  },
  {
    key: "future_partner_qr_api",
    title: "Bangla QR / Partner Ecosystem",
    summary: "QR interoperability readiness, partner API controls, webhook readiness, and sandbox launch tools.",
    target: "Partner / Merchant App",
    risk: "Medium",
    icon: WalletCards,
    adminLinks: [{ label: "API Hub", tab: "apihub" }, { label: "API Requests", tab: "api_requests" }, { label: "Webhooks", tab: "webhooks" }],
    capabilities: ["QR interoperability", "Partner API", "Webhook readiness"],
    dependencies: ["Developer portal", "API Hub", "Payment sessions"],
    readiness: 74,
  },
];

const visibilityCopy: Record<Visibility, { label: string; icon: typeof Eye; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  hidden: { label: "Hidden", icon: EyeOff, variant: "outline" },
  disabled: { label: "Admin Preview", icon: Eye, variant: "secondary" },
  visible: { label: "Live", icon: CheckCircle2, variant: "default" },
};

const getStage = (visibility?: string): LaunchStage => {
  if (visibility === "visible") return "Live";
  if (visibility === "disabled") return "Admin Ready";
  return "Planned";
};

export default function AdminAdvanceForFuture({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [toggles, setToggles] = useState<FutureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const loadToggles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("global_feature_toggles")
      .select("id, feature_key, label, description, is_enabled, visibility")
      .in("feature_key", futureFeatures.map((feature) => feature.key));

    if (error) toast.error("Failed to load future feature controls");
    else setToggles((data as FutureToggle[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadToggles();
    const channel = supabase
      .channel("admin-advance-for-future")
      .on("postgres_changes", { event: "*", schema: "public", table: "global_feature_toggles" }, loadToggles)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadToggles]);

  const toggleMap = useMemo(() => new Map(toggles.map((toggle) => [toggle.feature_key, toggle])), [toggles]);
  const liveCount = toggles.filter((toggle) => toggle.visibility === "visible").length;
  const previewCount = toggles.filter((toggle) => toggle.visibility === "disabled").length;

  const auditLog = async (action: string, entityId: string, details: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    supabase.from("audit_logs").insert([{
      actor_id: session.user.id,
      action,
      entity_type: "future_feature_toggle",
      entity_id: entityId,
      details,
    }]).then();
  };

  const setVisibility = async (feature: FutureFeature, visibility: Visibility) => {
    const toggle = toggleMap.get(feature.key);
    if (!toggle) {
      toast.error("Future toggle is not seeded yet");
      return;
    }

    setUpdatingKey(feature.key);
    const { error } = await supabase
      .from("global_feature_toggles")
      .update({ visibility, is_enabled: visibility === "visible" } as any)
      .eq("id", toggle.id);

    if (error) toast.error("Failed to update launch control");
    else {
      toast.success(`${feature.title} → ${visibilityCopy[visibility].label}`);
      auditLog("future_feature_visibility_changed", toggle.id, {
        feature_key: feature.key,
        title: feature.title,
        previous_visibility: toggle.visibility,
        new_visibility: visibility,
        launch_stage: getStage(visibility),
      });
    }
    setUpdatingKey(null);
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Advance for Future</h2>
                <p className="text-sm text-muted-foreground">Admin-only command center for future app-version releases.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-lg font-bold text-foreground">{futureFeatures.length}</p>
              <p className="text-xs text-muted-foreground">Planned</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-lg font-bold text-foreground">{previewCount}</p>
              <p className="text-xs text-muted-foreground">Preview</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-lg font-bold text-foreground">{liveCount}</p>
              <p className="text-xs text-muted-foreground">Live</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading future controls…
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {futureFeatures.map((feature, index) => {
            const toggle = toggleMap.get(feature.key);
            const visibility = ((toggle?.visibility as Visibility) || "hidden") as Visibility;
            const visibilityState = visibilityCopy[visibility] ?? visibilityCopy.hidden;
            const VisibilityIcon = visibilityState.icon;
            const Icon = feature.icon;
            const stage = getStage(visibility);
            const updating = updatingKey === feature.key;

            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <Card className="h-full border-0 shadow-[var(--shadow-card)]">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base leading-tight">{feature.title}</CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">{feature.summary}</p>
                        </div>
                      </div>
                      <Badge variant={visibilityState.variant} className="shrink-0 gap-1 text-[10px]">
                        <VisibilityIcon className="h-3 w-3" /> {visibilityState.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-muted/40 p-2">
                        <p className="text-muted-foreground">Stage</p>
                        <p className="font-semibold text-foreground">{stage}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <p className="text-muted-foreground">Target</p>
                        <p className="font-semibold text-foreground">{feature.target}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <p className="text-muted-foreground">Risk</p>
                        <p className="font-semibold text-foreground">{feature.risk}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Release readiness</span>
                        <span className="font-medium text-foreground">{feature.readiness}%</span>
                      </div>
                      <Progress value={feature.readiness} className="h-2" />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Radar className="h-3.5 w-3.5" /> Capabilities</p>
                        <div className="flex flex-wrap gap-1.5">
                          {feature.capabilities.map((item) => <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Activity className="h-3.5 w-3.5" /> Dependencies</p>
                        <div className="flex flex-wrap gap-1.5">
                          {feature.dependencies.map((item) => <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>)}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                      {feature.adminLinks.map((link) => (
                        <Button key={link.tab} variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onNavigate?.(link.tab)}>
                          {link.label} <ArrowRight className="h-3 w-3" />
                        </Button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Button variant="outline" size="sm" disabled={updating} onClick={() => setVisibility(feature, "hidden")} className="gap-1.5 text-xs">
                        {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />} Keep Hidden
                      </Button>
                      <Button variant="secondary" size="sm" disabled={updating} onClick={() => setVisibility(feature, "disabled")} className="gap-1.5 text-xs">
                        <Eye className="h-3.5 w-3.5" /> Preview in Admin
                      </Button>
                      <Button size="sm" disabled={updating} onClick={() => setVisibility(feature, visibility === "visible" ? "hidden" : "visible")} className="gap-1.5 text-xs">
                        {visibility === "visible" ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {visibility === "visible" ? "Rollback / Hide" : "Launch to App"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}