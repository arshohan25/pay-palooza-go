import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Bot,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  FileCheck2,
  Gauge,
  KeyRound,
  Landmark,
  LineChart,
  Loader2,
  Mic,
  Network,
  QrCode,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

type Visibility = "hidden" | "disabled" | "visible";
type LaunchStage = "Planned" | "Admin Ready" | "App Ready" | "Live";
type Impact = "High" | "Medium" | "Low";
type Complexity = "High" | "Medium" | "Low";
type PhaseId = 1 | 2 | 3;
type BulkGroup = "top_7" | "phase_1" | "phase_2" | "phase_3";
type DeviceFrame = "mobile" | "tablet" | "desktop";
type FeatureAction = "hidden" | "disabled" | "visible";

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
  phase: PhaseId;
  impact: Impact;
  complexity: Complexity;
  category: string;
  topRank?: number;
  topReason?: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_id: string;
  entity_id: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

const futureFeatures: FutureFeature[] = [
  {
    key: "future_ai_copilot",
    title: "AI Financial Copilot",
    summary: "Personalized financial guidance, spending insights, low-balance prediction, budget nudges, and smart offers.",
    target: "User App",
    risk: "Medium",
    icon: Bot,
    adminLinks: [{ label: "AI Agent", tab: "ai_agent" }, { label: "User Performance", tab: "user_performance" }],
    capabilities: ["Spending insights", "Low-balance prediction", "Budget nudges"],
    dependencies: ["Transactions", "Budget manager", "AI reward signals"],
    readiness: 72,
    phase: 1,
    impact: "High",
    complexity: "Medium",
    category: "User Retention",
    topRank: 2,
    topReason: "Drives daily engagement and gives the user app a differentiated advisory experience.",
  },
  {
    key: "future_scam_shield",
    title: "Real-Time Scam Shield",
    summary: "Pre-confirmation risk warnings before send money, cash out, and payment using velocity, device, recipient, and amount signals.",
    target: "User / Agent App",
    risk: "High",
    icon: ShieldAlert,
    adminLinks: [{ label: "AI Fraud", tab: "ai_fraud" }, { label: "Risk Control", tab: "risk_control" }, { label: "Fraud Alerts", tab: "alerts" }],
    capabilities: ["Monitor / Warn / Block", "Velocity checks", "Recipient risk"],
    dependencies: ["Fraud rules", "Device manager", "Transaction history"],
    readiness: 68,
    phase: 1,
    impact: "High",
    complexity: "Medium",
    category: "Risk & Compliance",
    topRank: 1,
    topReason: "Highest trust and safety value because it can stop fraud before money leaves the wallet.",
  },
  {
    key: "future_easypay_score",
    title: "EasyPay Trust Score",
    summary: "Alternative-data trust scoring using account age, KYC, transaction history, repayment behavior, and fraud flags.",
    target: "User App",
    risk: "High",
    icon: CreditCard,
    adminLinks: [{ label: "Loan Management", tab: "loans" }, { label: "User Metrics", tab: "users" }],
    capabilities: ["KYC + activity scoring", "Repayment behavior", "Limit intelligence"],
    dependencies: ["KYC", "Loans", "Fraud signals"],
    readiness: 64,
    phase: 2,
    impact: "High",
    complexity: "High",
    category: "Revenue Growth",
    topRank: 4,
    topReason: "Foundation for lending, dynamic limits, personalized offers, and safer risk controls.",
  },
  {
    key: "future_compliance_center",
    title: "Compliance Command Center",
    summary: "LEA integrity, report hash verification, suspicious activity timelines, and audit readiness status.",
    target: "Admin App",
    risk: "Medium",
    icon: FileCheck2,
    adminLinks: [{ label: "LEA Request", tab: "lea_request" }, { label: "Audit Log", tab: "auditlog" }, { label: "Data Export", tab: "data_export" }],
    capabilities: ["Report integrity", "Hash verification", "Audit timeline"],
    dependencies: ["LEA reports", "Audit logs", "Data export"],
    readiness: 80,
    phase: 1,
    impact: "High",
    complexity: "Medium",
    category: "Risk & Compliance",
    topRank: 3,
    topReason: "Strengthens legal defensibility, regulator readiness, and internal evidence quality.",
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
    phase: 2,
    impact: "High",
    complexity: "Medium",
    category: "Agent Operations",
    topRank: 6,
    topReason: "Improves cash availability, distributor operations, and field service reliability.",
  },
  {
    key: "future_merchant_growth_os",
    title: "Merchant Growth OS",
    summary: "Sales trend insights, inventory reorder recommendations, and customer retention opportunities.",
    target: "Merchant App",
    risk: "Low",
    icon: Store,
    adminLinks: [{ label: "Merchants", tab: "merchants" }, { label: "E-Commerce", tab: "ecommerce" }, { label: "Orders", tab: "orders" }],
    capabilities: ["Sales trends", "Inventory reorder", "Retention opportunities"],
    dependencies: ["Orders", "Products", "Merchant analytics"],
    readiness: 70,
    phase: 2,
    impact: "High",
    complexity: "Medium",
    category: "Merchant Growth",
    topRank: 5,
    topReason: "Creates direct merchant retention and revenue-growth opportunities.",
  },
  {
    key: "future_identity_wallet",
    title: "Identity Wallet & Passkey Security",
    summary: "Reusable KYC profile, passkey-ready security, verifiable identity status, and device trust scoring.",
    target: "User / Merchant / Agent App",
    risk: "High",
    icon: KeyRound,
    adminLinks: [{ label: "KYC", tab: "kyc" }, { label: "Devices", tab: "devices" }, { label: "Security", tab: "security" }],
    capabilities: ["Passkey readiness", "Reusable KYC profile", "Device trust score"],
    dependencies: ["KYC", "Device manager", "Security center"],
    readiness: 62,
    phase: 3,
    impact: "High",
    complexity: "High",
    category: "Identity & Security",
  },
  {
    key: "future_partner_qr_api",
    title: "Bangla QR / Partner API Ecosystem",
    summary: "QR interoperability, partner API controls, webhook readiness, and sandbox launch tools.",
    target: "Merchant / Partner App",
    risk: "Medium",
    icon: WalletCards,
    adminLinks: [{ label: "API Hub", tab: "apihub" }, { label: "API Requests", tab: "api_requests" }, { label: "Webhooks", tab: "webhooks" }],
    capabilities: ["QR interoperability", "Partner API", "Webhook readiness"],
    dependencies: ["Developer portal", "API Hub", "Payment sessions"],
    readiness: 74,
    phase: 2,
    impact: "High",
    complexity: "High",
    category: "Platform Infrastructure",
  },
  {
    key: "future_predictive_loan_eligibility",
    title: "Predictive Loan Eligibility",
    summary: "Pre-qualified Qard Hasan eligibility and smart repayment guidance based on wallet behavior and trust signals.",
    target: "User App",
    risk: "High",
    icon: BadgeCheck,
    adminLinks: [{ label: "Loan Management", tab: "loans" }, { label: "Limits", tab: "limits" }],
    capabilities: ["Pre-qualification", "Repayment guidance", "Eligibility nudges"],
    dependencies: ["Trust score", "Loan history", "KYC"],
    readiness: 58,
    phase: 2,
    impact: "High",
    complexity: "High",
    category: "Revenue Growth",
  },
  {
    key: "future_ai_fraud_investigator",
    title: "AI Fraud Case Investigator",
    summary: "Summarizes suspicious activity, user patterns, related transactions, and recommended admin actions.",
    target: "Admin App",
    risk: "Medium",
    icon: Radar,
    adminLinks: [{ label: "AI Fraud", tab: "ai_fraud" }, { label: "Fraud Alerts", tab: "alerts" }, { label: "Risk Control", tab: "risk_control" }],
    capabilities: ["Case summaries", "Pattern detection", "Action recommendations"],
    dependencies: ["Fraud alerts", "Audit logs", "AI Gateway"],
    readiness: 66,
    phase: 1,
    impact: "High",
    complexity: "Medium",
    category: "Risk & Compliance",
  },
  {
    key: "future_smart_rewards_engine",
    title: "Smart Rewards & Offer Engine",
    summary: "Personalized cashback, lifecycle offers, merchant campaigns, and retention incentives.",
    target: "User / Merchant App",
    risk: "Low",
    icon: Sparkles,
    adminLinks: [{ label: "Marketing", tab: "marketing" }, { label: "Loyalty", tab: "loyalty" }, { label: "User Perf.", tab: "user_performance" }],
    capabilities: ["Cashback targeting", "Lifecycle campaigns", "Merchant offers"],
    dependencies: ["Campaigns", "Cashback rules", "Usage metrics"],
    readiness: 78,
    phase: 1,
    impact: "High",
    complexity: "Low",
    category: "User Retention",
    topRank: 7,
    topReason: "Improves retention, campaign targeting, and transaction frequency.",
  },
  {
    key: "future_bangla_voice_assistant",
    title: "Voice & Bengali Assistant",
    summary: "Bengali voice guidance for payments, support, accessibility, and agent-assisted workflows.",
    target: "User / Agent App",
    risk: "Medium",
    icon: Mic,
    adminLinks: [{ label: "Support", tab: "tickets" }, { label: "AI Agent", tab: "ai_agent" }],
    capabilities: ["Voice guidance", "Bengali support", "Accessibility flows"],
    dependencies: ["Support content", "AI Agent", "Voice UX"],
    readiness: 50,
    phase: 3,
    impact: "Medium",
    complexity: "High",
    category: "User Retention",
  },
  {
    key: "future_open_finance_hub",
    title: "Open Finance Data Hub",
    summary: "Future-ready consented data sharing and external financial integrations for partner ecosystems.",
    target: "Admin / Partner App",
    risk: "High",
    icon: Network,
    adminLinks: [{ label: "API Hub", tab: "apihub" }, { label: "Developer Portal", tab: "api_requests" }],
    capabilities: ["Consented sharing", "Partner integrations", "Data controls"],
    dependencies: ["API governance", "Consent model", "Security review"],
    readiness: 46,
    phase: 3,
    impact: "Medium",
    complexity: "High",
    category: "Platform Infrastructure",
  },
  {
    key: "future_predictive_support",
    title: "Predictive Support Automation",
    summary: "Detect likely support issues before tickets are opened and route proactive help to users or admins.",
    target: "User / Admin App",
    risk: "Low",
    icon: Activity,
    adminLinks: [{ label: "Tickets", tab: "tickets" }, { label: "Chat Monitor", tab: "chat_monitor" }],
    capabilities: ["Issue prediction", "Proactive help", "Ticket routing"],
    dependencies: ["Support history", "Notifications", "Chat signals"],
    readiness: 60,
    phase: 3,
    impact: "Medium",
    complexity: "Low",
    category: "User Retention",
  },
  {
    key: "future_dynamic_risk_limits",
    title: "Risk-Based Dynamic Limits",
    summary: "Adjust wallet limits based on trust score, fraud signals, KYC strength, device health, and behavior.",
    target: "User / Admin App",
    risk: "High",
    icon: CheckCircle2,
    adminLinks: [{ label: "Limits", tab: "limits" }, { label: "Risk Control", tab: "risk_control" }, { label: "Security", tab: "security" }],
    capabilities: ["Adaptive limits", "Risk scoring", "KYC-aware controls"],
    dependencies: ["Trust score", "Limits engine", "Fraud rules"],
    readiness: 56,
    phase: 2,
    impact: "High",
    complexity: "High",
    category: "Risk & Compliance",
  },
];

const phases: Record<PhaseId, { title: string; focus: string; group: BulkGroup }> = {
  1: { title: "Phase 1 — Immediate Competitive Advantage", focus: "Safety, compliance, trust, and admin-ready intelligence.", group: "phase_1" },
  2: { title: "Phase 2 — Revenue and Ecosystem Growth", focus: "Lending, merchant growth, agent performance, and partner expansion.", group: "phase_2" },
  3: { title: "Phase 3 — Future Platform Differentiation", focus: "Identity, voice, open finance, and predictive support.", group: "phase_3" },
};

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

const isLowerComplexity = (complexity: Complexity) => complexity === "Low" || complexity === "Medium";

const previewFeatureKeys = {
  user: ["future_ai_copilot", "future_scam_shield", "future_easypay_score", "future_smart_rewards_engine", "future_predictive_loan_eligibility", "future_bangla_voice_assistant", "future_dynamic_risk_limits"],
  merchant: ["future_merchant_growth_os", "future_smart_rewards_engine", "future_partner_qr_api"],
  agent: ["future_agent_liquidity_intel", "future_scam_shield", "future_bangla_voice_assistant"],
  admin: ["future_compliance_center", "future_ai_fraud_investigator", "future_open_finance_hub", "future_predictive_support"],
};

const deviceFrameClass: Record<DeviceFrame, string> = {
  mobile: "mx-auto max-w-[360px]",
  tablet: "mx-auto max-w-[720px]",
  desktop: "w-full",
};

const impactScore: Record<Impact, number> = { High: 3, Medium: 2, Low: 1 };

const getFeatureAppType = (target: string): "user" | "merchant" | "agent" | "admin" => {
  if (target.includes("Merchant")) return "merchant";
  if (target.includes("Agent") || target.includes("Distributor")) return "agent";
  if (target.includes("Admin")) return "admin";
  return "user";
};

const readinessChecklistFor = (feature: FutureFeature) => ({
  dataSources: feature.dependencies,
  apis: ["Feature toggle seeded", "Audit logging active", ...feature.adminLinks.map((link) => `${link.label} module linked`)],
  uiEntryPoints: ["Admin emulator preview ready", `${feature.target} entry point dormant`, "Live rendering requires visibility === visible"],
});

export default function AdminAdvanceForFuture({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [toggles, setToggles] = useState<FutureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState<{ title: string; group: BulkGroup; keys: string[]; visibility: Visibility } | null>(null);
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>("mobile");
  const [featurePending, setFeaturePending] = useState<{ feature: FutureFeature; visibility: FeatureAction } | null>(null);
  const [previewFeature, setPreviewFeature] = useState<FutureFeature | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const featureKeys = useMemo(() => futureFeatures.map((feature) => feature.key), []);
  const topSeven = useMemo(() => futureFeatures.filter((feature) => feature.topRank).sort((a, b) => (a.topRank ?? 0) - (b.topRank ?? 0)), []);

  const loadToggles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("global_feature_toggles")
      .select("id, feature_key, label, description, is_enabled, visibility")
      .in("feature_key", featureKeys);

    if (error) toast.error("Failed to load future feature controls");
    else setToggles((data as FutureToggle[] | null) ?? []);
    setLoading(false);
  }, [featureKeys]);

  const loadAuditEntries = useCallback(async () => {
    setAuditLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, actor_id, entity_id, created_at, details")
      .in("action", ["future_feature_bulk_visibility_changed", "future_feature_visibility_changed"])
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) toast.error("Failed to load launch audit log");
    else setAuditEntries(((data as unknown as AuditEntry[]) ?? []).map((entry) => ({ ...entry, details: entry.details ?? null })));
    setAuditLoading(false);
  }, []);

  useEffect(() => {
    loadToggles();
    loadAuditEntries();
    const channel = supabase
      .channel("admin-advance-for-future")
      .on("postgres_changes", { event: "*", schema: "public", table: "global_feature_toggles" }, loadToggles)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadToggles]);

  const toggleMap = useMemo(() => new Map(toggles.map((toggle) => [toggle.feature_key, toggle])), [toggles]);
  const getVisibility = (key: string): Visibility => ((toggleMap.get(key)?.visibility as Visibility) || "hidden") as Visibility;
  const visibleFeatures = futureFeatures.map((feature) => ({ ...feature, visibility: getVisibility(feature.key) }));
  const liveCount = visibleFeatures.filter((feature) => feature.visibility === "visible").length;
  const previewCount = visibleFeatures.filter((feature) => feature.visibility === "disabled").length;
  const hiddenCount = visibleFeatures.filter((feature) => feature.visibility === "hidden").length;

  const auditLog = async (action: string, entityId: string, details: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    supabase.from("audit_logs").insert([{
      actor_id: session.user.id,
      action,
      entity_type: "future_feature_toggle",
      entity_id: entityId,
      details: details as Json,
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
        target: feature.target,
        phase: feature.phase,
        impact: feature.impact,
        complexity: feature.complexity,
        readiness: feature.readiness,
      });
      loadAuditEntries();
    }
    setUpdatingKey(null);
  };

  const requestFeatureAction = (feature: FutureFeature, visibility: FeatureAction) => {
    if (visibility === "disabled") setPreviewFeature(feature);
    else setFeaturePending({ feature, visibility });
  };

  const confirmFeatureAction = async () => {
    if (!featurePending) return;
    const pending = featurePending;
    setFeaturePending(null);
    await setVisibility(pending.feature, pending.visibility);
  };

  const openBulkConfirm = (title: string, group: BulkGroup, keys: string[], visibility: Visibility) => {
    setBulkPending({ title, group, keys, visibility });
  };

  const runBulkAction = async () => {
    if (!bulkPending) return;
    setUpdatingKey(bulkPending.group);
    const previousVisibility = bulkPending.keys.reduce<Record<string, string>>((acc, key) => {
      acc[key] = getVisibility(key);
      return acc;
    }, {});

    const { error } = await supabase
      .from("global_feature_toggles")
      .update({ visibility: bulkPending.visibility, is_enabled: bulkPending.visibility === "visible" } as any)
      .in("feature_key", bulkPending.keys);

    if (error) {
      toast.error("Bulk launch control failed");
    } else {
      toast.success(`${bulkPending.title} → ${visibilityCopy[bulkPending.visibility].label}`);
      auditLog("future_feature_bulk_visibility_changed", bulkPending.group, {
        bulk_group: bulkPending.group,
        feature_keys: bulkPending.keys,
        previous_visibility: previousVisibility,
        new_visibility: bulkPending.visibility,
        launch_stage: getStage(bulkPending.visibility),
        affected_count: bulkPending.keys.length,
      });
      loadAuditEntries();
    }

    setBulkPending(null);
    setUpdatingKey(null);
  };

  const renderFeatureControls = (feature: FutureFeature, compact = false) => {
    const visibility = getVisibility(feature.key);
    const updating = updatingKey === feature.key;
    return (
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
        <Button variant="outline" size="sm" disabled={updating} onClick={() => requestFeatureAction(feature, "hidden")} className="gap-1.5 text-xs">
          {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />} Hide
        </Button>
        <Button variant="secondary" size="sm" disabled={updating} onClick={() => requestFeatureAction(feature, "disabled")} className="gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" /> Preview
        </Button>
        <Button size="sm" disabled={updating} onClick={() => requestFeatureAction(feature, visibility === "visible" ? "hidden" : "visible")} className="gap-1.5 text-xs">
          {visibility === "visible" ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {visibility === "visible" ? "Rollback" : "Launch"}
        </Button>
      </div>
    );
  };

  const renderChecklist = (feature: FutureFeature) => {
    const checklist = readinessChecklistFor(feature);
    return (
      <div className="grid gap-2 text-[11px] md:grid-cols-3">
        {Object.entries(checklist).map(([group, items]) => (
          <div key={group} className="rounded-md border bg-background/60 p-2">
            <p className="mb-1 font-semibold capitalize text-foreground">{group.replace(/([A-Z])/g, " $1")}</p>
            <div className="space-y-1 text-muted-foreground">
              {items.map((item) => <p key={item} className="flex gap-1"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{item}</p>)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const phaseStats = (features: FutureFeature[]) => {
    const live = features.filter((feature) => getVisibility(feature.key) === "visible").length;
    const preview = features.filter((feature) => getVisibility(feature.key) === "disabled").length;
    const hidden = features.filter((feature) => getVisibility(feature.key) === "hidden").length;
    const readiness = Math.round(features.reduce((sum, feature) => sum + feature.readiness, 0) / features.length);
    return { live, preview, hidden, readiness };
  };

  const getPreviewFeatures = (keys: string[]) =>
    keys
      .map((key) => futureFeatures.find((feature) => feature.key === key))
      .filter((feature): feature is FutureFeature => Boolean(feature) && getVisibility(feature.key) !== "hidden");

  const previewBadge = (key: string) => {
    const visibility = getVisibility(key);
    const state = visibilityCopy[visibility] ?? visibilityCopy.hidden;
    return <Badge variant={state.variant} className="h-5 px-2 text-[9px] uppercase tracking-wide">{state.label}</Badge>;
  };

  const PreviewTile = ({ feature, icon: Icon }: { feature: FutureFeature; icon: typeof Sparkles }) => (
    <div className="rounded-[19px] border border-border/60 bg-card/55 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-glow"><Icon className="h-4 w-4" /></span>
        {previewBadge(feature.key)}
      </div>
      <p className="text-xs font-bold leading-tight text-foreground">{feature.title}</p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{feature.capabilities[0]}</p>
    </div>
  );

  const AppEmulator = ({ title, role, features, hero, icon: Icon }: { title: string; role: string; features: FutureFeature[]; hero: string; icon: typeof Sparkles }) => (
    <div className={deviceFrameClass[deviceFrame]}>
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background/80 p-2 shadow-[var(--shadow-elevated)] backdrop-blur-xl">
        <div className="rounded-[22px] border border-border/50 bg-card p-3">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-sm font-bold text-foreground">{title}</p><p className="text-[10px] text-muted-foreground">{role} · {deviceFrame} emulator</p></div>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="rounded-[19px] gradient-hero p-4 text-primary-foreground shadow-glow">
            <p className="text-[11px] opacity-80">{hero}</p>
            <p className="mt-1 text-2xl font-black">EasyPay</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]"><span>Secure</span><span>Live gated</span><span>Preview</span></div>
          </div>
          <div className={`mt-3 grid gap-2 ${deviceFrame === "mobile" ? "grid-cols-2" : deviceFrame === "tablet" ? "grid-cols-3" : "grid-cols-4"}`}>
            {features.map((feature) => <PreviewTile key={feature.key} feature={feature} icon={feature.icon} />)}
          </div>
          {!features.length && <p className="mt-3 rounded-[19px] border border-dashed p-4 text-center text-xs text-muted-foreground">Hidden items are not rendered in this app preview.</p>}
        </div>
      </div>
    </div>
  );

  const userPreview = getPreviewFeatures(previewFeatureKeys.user);
  const merchantPreview = getPreviewFeatures(previewFeatureKeys.merchant);
  const agentPreview = getPreviewFeatures(previewFeatureKeys.agent);
  const adminPreview = getPreviewFeatures(previewFeatureKeys.admin);

  const rolePreviewCount = userPreview.length + merchantPreview.length + agentPreview.length + adminPreview.length;

  const analytics = useMemo(() => {
    const byPhase = ([1, 2, 3] as PhaseId[]).map((phase) => {
      const items = visibleFeatures.filter((feature) => feature.phase === phase);
      const max = items.reduce((sum, feature) => sum + impactScore[feature.impact], 0) || 1;
      const active = items.reduce((sum, feature) => sum + impactScore[feature.impact] * (feature.visibility === "visible" ? 1 : feature.visibility === "disabled" ? 0.5 : 0), 0);
      return { phase, live: items.filter((item) => item.visibility === "visible").length, preview: items.filter((item) => item.visibility === "disabled").length, hidden: items.filter((item) => item.visibility === "hidden").length, impact: Math.round((active / max) * 100) };
    });
    const topSplit = topSeven.reduce<Record<Visibility, number>>((acc, feature) => { acc[getVisibility(feature.key)] += 1; return acc; }, { hidden: 0, disabled: 0, visible: 0 });
    return { byPhase, topSplit };
  }, [visibleFeatures, topSeven, toggleMap]);

  const matrixGroups = [
    { title: "High Impact / Low-Medium Complexity", note: "Quick wins and near-term release candidates", items: visibleFeatures.filter((feature) => feature.impact === "High" && isLowerComplexity(feature.complexity)) },
    { title: "High Impact / High Complexity", note: "Strategic bets requiring phased rollout", items: visibleFeatures.filter((feature) => feature.impact === "High" && feature.complexity === "High") },
    { title: "Medium Impact / Low Complexity", note: "Useful enhancements for version upgrades", items: visibleFeatures.filter((feature) => feature.impact === "Medium" && feature.complexity === "Low") },
    { title: "Medium Impact / High Complexity", note: "Future roadmap items that need more preparation", items: visibleFeatures.filter((feature) => feature.impact === "Medium" && feature.complexity === "High") },
  ];

  const bulkTargets = bulkPending?.keys.map((key) => futureFeatures.find((feature) => feature.key === key)).filter(Boolean) as FutureFeature[] | undefined;

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
                <p className="text-sm text-muted-foreground">15-item strategic roadmap with phase and Top 7 one-click launch controls.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center sm:min-w-[34rem]">
            {[
              [futureFeatures.length, "Total"],
              [topSeven.length, "Top 7"],
              [liveCount, "Live"],
              [previewCount, "Preview"],
              [hiddenCount, "Hidden"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
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
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader><CardTitle className="text-base">Advanced Feature Analytics</CardTitle><p className="text-xs text-muted-foreground">Enablement counts and estimated business impact by phase.</p></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted/40 p-3"><p className="text-lg font-bold text-foreground">{liveCount}</p><p className="text-muted-foreground">Live</p></div>
                  <div className="rounded-md bg-muted/40 p-3"><p className="text-lg font-bold text-foreground">{previewCount}</p><p className="text-muted-foreground">Preview</p></div>
                  <div className="rounded-md bg-muted/40 p-3"><p className="text-lg font-bold text-foreground">{hiddenCount}</p><p className="text-muted-foreground">Hidden</p></div>
                </div>
                {analytics.byPhase.map((phase) => (
                  <div key={phase.phase} className="space-y-1 rounded-md border bg-background/60 p-3">
                    <div className="flex justify-between text-xs"><span className="font-semibold text-foreground">Phase {phase.phase} impact readiness</span><span>{phase.impact}%</span></div>
                    <Progress value={phase.impact} className="h-2" />
                    <p className="text-[11px] text-muted-foreground">{phase.live} live · {phase.preview} preview · {phase.hidden} hidden</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Top 7 split: {analytics.topSplit.visible} live, {analytics.topSplit.disabled} preview, {analytics.topSplit.hidden} hidden.</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader><CardTitle className="text-base">Visibility Safety Check</CardTitle><p className="text-xs text-muted-foreground">Hidden feature entry points remain dormant outside admin previews.</p></CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {["Hidden features are excluded from app-style previews and emulator popups.", "Admin Preview features render only inside this admin dashboard.", "Live entry points must be wired with visibility === visible / isLive guards.", "User, merchant, agent, and loan pages currently only reference future flags without rendering hidden UI."].map((item) => (
                  <p key={item} className="flex gap-2 rounded-md bg-muted/30 p-2"><ShieldAlert className="h-3.5 w-3.5 shrink-0 text-primary" />{item}</p>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-[19px] border border-border/70 bg-card/80 shadow-[var(--shadow-elevated)] backdrop-blur-xl">
            <CardHeader className="relative space-y-3 pb-4">
              <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
              <div className="pointer-events-none absolute left-1/3 top-4 h-20 w-20 rounded-full bg-accent/10 blur-2xl" />
              <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Original App Preview</CardTitle>
                  <p className="text-xs text-muted-foreground">App-style preview surfaces for features marked Admin Preview or Live.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["mobile", "tablet", "desktop"] as DeviceFrame[]).map((frame) => (
                    <Button key={frame} size="sm" variant={deviceFrame === frame ? "default" : "outline"} onClick={() => setDeviceFrame(frame)} className="h-8 text-xs capitalize">{frame}</Button>
                  ))}
                  <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wide">{rolePreviewCount} preview items active</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              <AppEmulator title="EasyPay User App Preview" role="User" features={userPreview} hero="Available Balance" icon={WalletCards} />
              <AppEmulator title="EasyPay Merchant App Preview" role="Merchant" features={merchantPreview} hero="Today sales" icon={Store} />
              <AppEmulator title="EasyPay Agent App Preview" role="Agent" features={agentPreview} hero="Field float" icon={TrendingUp} />
              <AppEmulator title="EasyPay Admin Preview" role="Admin" features={adminPreview} hero="Risk operations" icon={BellRing} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Top 7 Priority Recommendations</CardTitle>
                  <p className="text-xs text-muted-foreground">Highest-impact release candidates ranked by strategic value.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openBulkConfirm("Launch Top 7 to App", "top_7", topSeven.map((feature) => feature.key), "visible")}>Launch Top 7</Button>
                  <Button size="sm" variant="secondary" onClick={() => openBulkConfirm("Preview Top 7 in Admin", "top_7", topSeven.map((feature) => feature.key), "disabled")}>Preview Top 7</Button>
                  <Button size="sm" variant="outline" onClick={() => openBulkConfirm("Hide Top 7", "top_7", topSeven.map((feature) => feature.key), "hidden")}>Hide Top 7</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 xl:grid-cols-2">
              {topSeven.map((feature) => {
                const visibility = getVisibility(feature.key);
                const state = visibilityCopy[visibility] ?? visibilityCopy.hidden;
                return (
                  <div key={feature.key} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">#{feature.topRank}</div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{feature.title}</p>
                            <Badge variant={state.variant} className="text-[10px]">{state.label}</Badge>
                          </div>
                          <p className="break-all text-[11px] text-muted-foreground">{feature.key}</p>
                          <p className="text-xs text-muted-foreground">{feature.topReason}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">{feature.target}</Badge>
                            <Badge variant="outline" className="text-[10px]">{feature.impact} impact</Badge>
                            <Badge variant="outline" className="text-[10px]">{feature.complexity} complexity</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">{renderFeatureControls(feature)}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            {([1, 2, 3] as PhaseId[]).map((phaseId) => {
              const phaseFeatures = futureFeatures.filter((feature) => feature.phase === phaseId);
              const stats = phaseStats(phaseFeatures);
              const phase = phases[phaseId];
              return (
                <Card key={phaseId} className="border-0 shadow-[var(--shadow-card)]">
                  <CardHeader className="space-y-3 pb-3">
                    <div>
                      <CardTitle className="text-base leading-tight">{phase.title}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{phase.focus}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="rounded-md bg-muted/40 p-2"><p className="font-bold text-foreground">{phaseFeatures.length}</p><p className="text-muted-foreground">Items</p></div>
                      <div className="rounded-md bg-muted/40 p-2"><p className="font-bold text-foreground">{stats.live}</p><p className="text-muted-foreground">Live</p></div>
                      <div className="rounded-md bg-muted/40 p-2"><p className="font-bold text-foreground">{stats.preview}</p><p className="text-muted-foreground">Preview</p></div>
                      <div className="rounded-md bg-muted/40 p-2"><p className="font-bold text-foreground">{stats.hidden}</p><p className="text-muted-foreground">Hidden</p></div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Average readiness</span><span className="font-medium">{stats.readiness}%</span></div>
                      <Progress value={stats.readiness} className="h-2" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {phaseFeatures.map((feature) => <Badge key={feature.key} variant="outline" className="text-[10px]">{feature.title}</Badge>)}
                    </div>
                    <Separator />
                    <div className="grid gap-2">
                      <Button size="sm" onClick={() => openBulkConfirm(`Launch ${phase.title}`, phase.group, phaseFeatures.map((feature) => feature.key), "visible")}>Launch Phase</Button>
                      <Button size="sm" variant="secondary" onClick={() => openBulkConfirm(`Preview ${phase.title}`, phase.group, phaseFeatures.map((feature) => feature.key), "disabled")}>Preview Phase</Button>
                      <Button size="sm" variant="outline" onClick={() => openBulkConfirm(`Hide ${phase.title}`, phase.group, phaseFeatures.map((feature) => feature.key), "hidden")}>Hide Phase</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Strategic Value Matrix</CardTitle>
              <p className="text-xs text-muted-foreground">Grouped by business impact and implementation complexity for faster release planning.</p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {matrixGroups.map((group) => (
                <div key={group.title} className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-3">
                    <p className="font-semibold text-foreground">{group.title}</p>
                    <p className="text-xs text-muted-foreground">{group.note}</p>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((feature) => (
                      <div key={feature.key} className="flex items-center justify-between gap-2 rounded-md bg-background/60 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{feature.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">Phase {feature.phase} · {feature.category}</p>
                        </div>
                        <Badge variant={visibilityCopy[feature.visibility].variant} className="shrink-0 text-[10px]">{visibilityCopy[feature.visibility].label}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {futureFeatures.map((feature, index) => {
              const toggle = toggleMap.get(feature.key);
              const visibility = getVisibility(feature.key);
              const visibilityState = visibilityCopy[visibility] ?? visibilityCopy.hidden;
              const VisibilityIcon = visibilityState.icon;
              const Icon = feature.icon;
              const stage = getStage(visibility);

              return (
                <motion.div key={feature.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.02 }}>
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
                            <p className="mt-1 break-all text-[11px] text-muted-foreground">Key: {feature.key}</p>
                          </div>
                        </div>
                        <Badge variant={visibilityState.variant} className="shrink-0 gap-1 text-[10px]">
                          <VisibilityIcon className="h-3 w-3" /> {visibilityState.label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Stage</p><p className="font-semibold text-foreground">{stage}</p></div>
                        <div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Phase</p><p className="font-semibold text-foreground">Phase {feature.phase}</p></div>
                        <div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Target</p><p className="font-semibold text-foreground">{feature.target}</p></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Impact</p><p className="font-semibold text-foreground">{feature.impact}</p></div>
                        <div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Complexity</p><p className="font-semibold text-foreground">{feature.complexity}</p></div>
                        <div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Risk</p><p className="font-semibold text-foreground">{feature.risk}</p></div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Release readiness</span><span className="font-medium text-foreground">{feature.readiness}%</span></div>
                        <Progress value={feature.readiness} className="h-2" />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Radar className="h-3.5 w-3.5" /> Capabilities</p>
                          <div className="flex flex-wrap gap-1.5">{feature.capabilities.map((item) => <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>)}</div>
                        </div>
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Activity className="h-3.5 w-3.5" /> Dependencies</p>
                          <div className="flex flex-wrap gap-1.5">{feature.dependencies.map((item) => <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>)}</div>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex flex-wrap gap-2">
                        {feature.adminLinks.map((link) => (
                          <Button key={link.tab} variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onNavigate?.(link.tab)}>
                            {link.label} <ArrowRight className="h-3 w-3" />
                          </Button>
                        ))}
                        {!toggle && <Badge variant="destructive" className="text-[10px]">Toggle not seeded</Badge>}
                      </div>
                      {renderFeatureControls(feature)}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={!!bulkPending} onOpenChange={(open) => !open && setBulkPending(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkPending?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Review this rollout before changing feature visibility for user, merchant, or agent app entry points.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bulkPending && (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Affected</p><p className="font-semibold">{bulkPending.keys.length} features</p></div>
                <div className="rounded-md bg-muted/40 p-2"><p className="text-xs text-muted-foreground">New status</p><p className="font-semibold">{visibilityCopy[bulkPending.visibility].label}</p></div>
                <div className="rounded-md bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Targets</p><p className="font-semibold">{Array.from(new Set(bulkTargets?.map((feature) => feature.target))).join(", ")}</p></div>
              </div>
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold text-foreground">Feature keys</p>
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-auto">
                  {bulkPending.keys.map((key) => <Badge key={key} variant="outline" className="text-[10px]">{key}</Badge>)}
                </div>
              </div>
              <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                Current counts: {hiddenCount} hidden, {previewCount} preview, {liveCount} live. Launching as Live may make prepared app entry points visible after future app-version wiring.
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkAction}>
              {updatingKey === bulkPending?.group ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
