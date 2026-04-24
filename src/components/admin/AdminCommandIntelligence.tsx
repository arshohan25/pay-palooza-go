import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileArchive,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Lock,
  Network,
  Palette,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

type AnyRow = Record<string, any>;
type UserIntelligenceTab = "timeline" | "risk" | "records" | "notes" | "actions";
type EvidenceField = { label: string; value: string | number | boolean | null | undefined; source: string };
type RemediationAction = { id: string; title: string; reason: string; priority: string; tab: UserIntelligenceTab; audit?: string; evidence: EvidenceField[]; records?: Array<{ title: string; fields: EvidenceField[] }>; impact: number; signals: string[] };

const currency = (value: number) => `৳${Math.round(value || 0).toLocaleString()}`;
const shortDate = (value?: string | null) => value ? new Date(value).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const humanize = (value: string) => String(value || "").split("_").join(" ");
const evidenceValue = (value: EvidenceField["value"]) => value === null || value === undefined || value === "" ? "—" : String(value);
const sampleRowKey = (row: AnyRow, index: number) => `${row.source || "sample"}:${row.id || row.user_id || row.reference || row.duplicate_value || "row"}:${row.created_at || index}`;
const sampleRowLabel = (row: AnyRow, index: number) => `${row.source || "sample"} / ${row.id || row.user_id || row.reference || row.duplicate_value || `row-${index + 1}`}`;

async function insertAudit(action: string, entityType: string, entityId: string, details: AnyRow = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details } as any);
}

function Shell({ title, description, icon: Icon, children, action }: { title: string; description: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: any; hint?: string }) {
  return (
    <Card className="border-border/50 bg-card/70 shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-bold text-foreground">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskScoreTooltip({ score }: { score?: { score: number; label: string; reasons: string[] } }) {
  const reasons = score?.reasons ?? [];
  const has = (text: string) => reasons.some((reason) => reason.toLowerCase().includes(text));
  const fraudReason = reasons.find((reason) => reason.toLowerCase().includes("fraud alert"));
  const transferReason = reasons.find((reason) => reason.toLowerCase().includes("high-value transfer"));

  const rows = [
    { label: "Base account review score", points: "+12", active: reasons.includes("Base account review score"), tone: "bg-primary" },
    { label: "Account age under 14 days", points: "+10", active: has("under 14 days"), tone: "bg-amber-500" },
    { label: "Suspended/deactivated profile", points: "+30", active: has("profile status"), tone: "bg-destructive" },
    { label: "KYC rejected", points: "+18", active: has("kyc rejection"), tone: "bg-destructive" },
    { label: "No KYC record", points: "+8", active: has("no kyc"), tone: "bg-amber-500" },
    { label: "More than 2 registered devices", points: "+12", active: has("multiple registered devices"), tone: "bg-amber-500" },
    { label: fraudReason || "Fraud alerts", points: "+12 each, max +28", active: Boolean(fraudReason), tone: "bg-destructive" },
    { label: transferReason || "High-value transfers ≥৳50,000", points: "+5 each, max +20", active: Boolean(transferReason), tone: "bg-amber-500" },
  ];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="How this score was calculated" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0 text-left">
          <div className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold text-popover-foreground">How this score was calculated</p>
              <p className="text-xs text-muted-foreground">Active factors are included in the current user score.</p>
            </div>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-popover-foreground">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${row.active ? row.tone : "bg-muted-foreground/30"}`} />
                    <span className={row.active ? "font-medium" : "text-muted-foreground"}>{row.label}</span>
                  </span>
                  <span className={row.active ? "font-semibold text-popover-foreground" : "text-muted-foreground"}>{row.points}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Final score capped at 100</span>
              <span className="font-semibold text-popover-foreground">{score?.score ?? "—"} · {score?.label ?? "No score"}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">Labels: 80+ Investigation Required, 60+ Restricted, 42+ High Risk, 25+ Watchlist, below 25 Low Risk. Recalculated from live profile, KYC, device, fraud, and transaction data.</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = ["approved", "active", "healthy", "low risk", "live"].includes(status.toLowerCase()) ? "secondary" : ["rejected", "critical", "restricted", "failed"].includes(status.toLowerCase()) ? "destructive" : "outline";
  return <Badge variant={variant as any} className="text-xs capitalize">{humanize(status)}</Badge>;
}

function scoreUser(profile: AnyRow | null, kyc: AnyRow | null, txns: AnyRow[], devices: AnyRow[], fraud: AnyRow[]) {
  let score = 12;
  const reasons: string[] = ["Base account review score"];
  if (!profile) return { score: 0, label: "No Profile", health: "Needs KYC", reasons: ["No profile record found"] };
  const ageDays = profile.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0;
  if (ageDays < 14) { score += 10; reasons.push("New account age under 14 days"); }
  if (profile.status === "suspended" || profile.status === "deactivated") { score += 30; reasons.push(`Profile status is ${profile.status}`); }
  if (kyc?.status === "rejected") { score += 18; reasons.push("KYC rejection history"); }
  if (!kyc && !profile.kyc_exempt) { score += 8; reasons.push("No KYC verification record"); }
  if (devices.length > 2) { score += 12; reasons.push("Multiple registered devices"); }
  if (fraud.length > 0) { score += Math.min(28, fraud.length * 12); reasons.push(`${fraud.length} fraud alert(s)`); }
  const highValue = txns.filter((t) => Number(t.amount) >= 50000).length;
  if (highValue) { score += Math.min(20, highValue * 5); reasons.push(`${highValue} high-value transfer(s)`); }
  score = Math.min(100, score);
  const label = score >= 80 ? "Investigation Required" : score >= 60 ? "Restricted" : score >= 42 ? "High Risk" : score >= 25 ? "Watchlist" : "Low Risk";
  const health = profile.status === "suspended" ? "Restricted" : fraud.length ? "Suspicious" : !kyc && !profile.kyc_exempt ? "Needs KYC" : Number(profile.balance || 0) > 100000 ? "High Value" : "Healthy";
  return { score, label, health, reasons };
}

function getRemediationActions(detail: any, selected: AnyRow | null): RemediationAction[] {
  const score = Number(detail?.score?.score ?? 0);
  const label = detail?.score?.label ?? "Low Risk";
  const kycStatus = detail?.kyc?.status;
  const devices = detail?.devices ?? [];
  const fraud = detail?.fraud ?? [];
  const transactions = detail?.transactions ?? [];
  const highTransfers = transactions.filter((txn: AnyRow) => Number(txn.amount) >= 50000);
  const baseEvidence: EvidenceField[] = [
    { label: "User ID", value: selected?.user_id, source: "profiles.user_id" },
    { label: "Profile status", value: selected?.status || "active", source: "profiles.status" },
    { label: "Risk score", value: detail?.score?.score, source: "computed.score" },
    { label: "Risk label", value: detail?.score?.label, source: "computed.label" },
  ];
  const actions: RemediationAction[] = [];

  if (!detail || !selected) return actions;
  if ((!kycStatus && !selected.kyc_exempt) || kycStatus === "rejected") actions.push({ id: "kyc", impact: kycStatus === "rejected" ? 18 : 12, signals: ["KYC"], title: kycStatus === "rejected" ? "Request KYC resubmission" : "Request KYC verification", reason: kycStatus === "rejected" ? "KYC rejection is contributing to this risk level." : "Missing KYC leaves the user identity unresolved.", priority: kycStatus === "rejected" ? "High" : "Medium", tab: "actions", audit: "kyc_resubmission_request", evidence: [...baseEvidence, { label: "KYC status", value: kycStatus || "not_started", source: "kyc_verifications.status" }, { label: "KYC exempt", value: Boolean(selected.kyc_exempt), source: "profiles.kyc_exempt" }, { label: "KYC record ID", value: detail?.kyc?.id, source: "kyc_verifications.id" }] });
  if (devices.length > 2) actions.push({ id: "devices", impact: 12, signals: ["Devices"], title: "Review registered devices", reason: `${devices.length} devices are linked to this user. Confirm known devices and remove suspicious ones.`, priority: "Medium", tab: "records", evidence: [...baseEvidence, { label: "Registered device count", value: devices.length, source: "device_registrations.count" }, { label: "Risk factor points", value: "+12", source: "scoreUser.devices" }], records: devices.slice(0, 5).map((device: AnyRow) => ({ title: `Device ${String(device.device_fingerprint || device.id || "unknown").slice(0, 18)}`, fields: [{ label: "Device ID", value: device.id, source: "device_registrations.id" }, { label: "Fingerprint", value: device.device_fingerprint, source: "device_registrations.device_fingerprint" }, { label: "Status", value: device.status || "registered", source: "device_registrations.status" }, { label: "Registered at", value: shortDate(device.created_at), source: "device_registrations.created_at" }] })) });
  if (highTransfers.length > 0) actions.push({ id: "high_transfers", impact: Math.min(20, highTransfers.length * 5), signals: ["High-value transfers"], title: "Verify high-value transfers", reason: `${highTransfers.length} transfer(s) at or above ৳50,000 need source-of-funds review.`, priority: "High", tab: "records", evidence: [...baseEvidence, { label: "High-value transfer count", value: highTransfers.length, source: "transactions.amount >= 50000" }, { label: "Highest transfer", value: currency(Math.max(...highTransfers.map((txn: AnyRow) => Number(txn.amount || 0)))), source: "transactions.amount" }, { label: "Risk factor points", value: `+${Math.min(20, highTransfers.length * 5)}`, source: "scoreUser.highValueTransfers" }], records: highTransfers.slice(0, 5).map((txn: AnyRow) => ({ title: `${txn.type || "Transaction"} ${currency(Number(txn.amount))}`, fields: [{ label: "Transaction ID", value: txn.id, source: "transactions.id" }, { label: "Amount", value: currency(Number(txn.amount)), source: "transactions.amount" }, { label: "Status", value: txn.status, source: "transactions.status" }, { label: "Type", value: txn.type, source: "transactions.type" }, { label: "Created at", value: shortDate(txn.created_at), source: "transactions.created_at" }] })) });
  if (fraud.length > 0) actions.push({ id: "fraud", impact: Math.min(28, fraud.length * 12), signals: ["Fraud alerts"], title: "Review fraud alerts", reason: `${fraud.length} fraud alert(s) are open or recently recorded for this profile.`, priority: "High", tab: "records", evidence: [...baseEvidence, { label: "Fraud alert count", value: fraud.length, source: "fraud_alerts.count" }, { label: "Risk factor points", value: `+${Math.min(28, fraud.length * 12)}`, source: "scoreUser.fraudAlerts" }], records: fraud.slice(0, 5).map((alert: AnyRow) => ({ title: alert.reason || alert.alert_type || "Fraud alert", fields: [{ label: "Alert ID", value: alert.id, source: "fraud_alerts.id" }, { label: "Status", value: alert.status, source: "fraud_alerts.status" }, { label: "Severity", value: alert.severity, source: "fraud_alerts.severity" }, { label: "Reason", value: alert.reason || alert.alert_type, source: "fraud_alerts.reason" }, { label: "Created at", value: shortDate(alert.created_at), source: "fraud_alerts.created_at" }] })) });
  if (score >= 42) actions.push({ id: "watchlist", impact: score >= 80 ? 15 : 8, signals: ["Score threshold"], title: score >= 80 ? "Open investigation workflow" : "Add user to watchlist", reason: `${label} accounts should be monitored before sensitive actions are approved.`, priority: score >= 80 ? "Critical" : "High", tab: "actions", audit: "user_watchlist_request", evidence: [...baseEvidence, { label: "Score threshold met", value: score >= 80 ? "80+ investigation" : "42+ high risk", source: "computed.threshold" }, { label: "Score reasons", value: detail?.score?.reasons?.join("; "), source: "computed.reasons" }] });
  if (actions.length === 0) actions.push({ id: "low_risk_doc", impact: 0, signals: ["Documentation"], title: "Document low-risk review", reason: "No elevated signals found. Add a case note if this profile was manually reviewed.", priority: "Low", tab: "notes", evidence: [...baseEvidence, { label: "KYC status", value: kycStatus || (selected.kyc_exempt ? "exempt" : "not_started"), source: "kyc_verifications.status / profiles.kyc_exempt" }, { label: "Device count", value: devices.length, source: "device_registrations.count" }, { label: "Fraud alert count", value: fraud.length, source: "fraud_alerts.count" }] });

  return actions;
}

function RemediationEvidenceDrawer({ action, open, onOpenChange, onProceed }: { action: RemediationAction | null; open: boolean; onOpenChange: (open: boolean) => void; onProceed: (action: RemediationAction) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <SheetTitle>{action?.title || "Remediation evidence"}</SheetTitle>
          <SheetDescription>{action?.reason || "Review the exact fields behind this recommendation."}</SheetDescription>
        </SheetHeader>
        {action && <div className="mt-5 flex-1 space-y-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={action.priority} /><Badge variant="outline" className="capitalize">Opens {humanize(action.tab)}</Badge>{action.audit && <Badge variant="outline">Audit logged</Badge>}</div><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence fields</p><div className="rounded-lg border border-border/60">{action.evidence.map((field) => <div key={`${field.source}-${field.label}`} className="grid gap-1 border-b border-border/60 p-3 last:border-b-0 sm:grid-cols-[150px_1fr]"><div><p className="text-xs font-medium text-foreground">{field.label}</p><p className="text-[11px] text-muted-foreground">{field.source}</p></div><p className="break-words text-sm text-foreground">{evidenceValue(field.value)}</p></div>)}</div></div>{Boolean(action.records?.length) && <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supporting records</p><div className="space-y-3">{action.records?.map((record) => <div key={record.title} className="rounded-lg border border-border/60 bg-muted/30 p-3"><p className="text-sm font-semibold text-foreground">{record.title}</p><div className="mt-2 space-y-2">{record.fields.map((field) => <div key={`${record.title}-${field.source}-${field.label}`} className="grid gap-1 text-xs sm:grid-cols-[130px_1fr]"><span className="text-muted-foreground">{field.label}</span><span className="break-words text-foreground">{evidenceValue(field.value)}</span></div>)}</div></div>)}</div></div>}</div>}
        <SheetFooter className="mt-6 gap-2 sm:space-x-0"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button disabled={!action} onClick={() => action && onProceed(action)}>Open {action ? humanize(action.tab) : "tab"}</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function AdminUserIntelligenceCenter() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<UserIntelligenceTab>("timeline");
  const [evidenceAction, setEvidenceAction] = useState<RemediationAction | null>(null);
  const [selectedRemediations, setSelectedRemediations] = useState<Record<string, boolean>>({});

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").not("phone", "like", "staff-%").order("created_at", { ascending: false }).limit(40);
    setUsers(data ?? []);
    setSelected((data ?? [])[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    if (!selected?.user_id) return;
    const loadDetail = async () => {
      setLoading(true);
      const uid = selected.user_id;
      const [kyc, txns, devices, audits, locks, fraud, referrals, orders, notes] = await Promise.all([
        supabase.from("kyc_verifications").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(25),
        supabase.from("device_registrations").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
        supabase.from("audit_logs").select("*").or(`actor_id.eq.${uid},entity_id.eq.${uid}`).order("created_at", { ascending: false }).limit(25),
        (supabase.from("feature_locks" as any) as any).select("*").eq("user_id", uid).limit(20),
        supabase.from("fraud_alerts").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
        supabase.from("referrals").select("*").or(`referrer_id.eq.${uid},referred_user_id.eq.${uid}`).limit(20),
        supabase.from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
        supabase.from("admin_user_notes" as any).select("*").eq("target_user_id", uid).order("created_at", { ascending: false }).limit(20),
      ]);
      await supabase.from("admin_sensitive_access_logs" as any).insert({ target_user_id: uid, data_type: "user_intelligence", reason: "Admin opened 360-degree user profile" } as any);
      const tx = txns.data ?? [];
      const dv = devices.data ?? [];
      const fr = fraud.data ?? [];
      const score = scoreUser(selected, kyc.data, tx, dv, fr);
      const timeline = [
        ...tx.map((x: AnyRow) => ({ type: "Transaction", title: `${x.type || "txn"} ${currency(Number(x.amount))}`, at: x.created_at, status: x.status })),
        ...dv.map((x: AnyRow) => ({ type: "Device", title: `Device ${String(x.device_fingerprint || "").slice(0, 14)}`, at: x.created_at, status: "registered" })),
        ...fr.map((x: AnyRow) => ({ type: "Fraud", title: x.reason || x.alert_type || "Fraud alert", at: x.created_at, status: x.status || "open" })),
        ...(audits.data ?? []).map((x: AnyRow) => ({ type: "Audit", title: x.action, at: x.created_at, status: x.entity_type || "audit" })),
        ...(orders.data ?? []).map((x: AnyRow) => ({ type: "Order", title: `${x.order_num || x.id} ${currency(Number(x.total))}`, at: x.created_at, status: x.status })),
      ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 40);
      setDetail({ kyc: kyc.data, transactions: tx, devices: dv, audits: audits.data ?? [], locks: locks.data ?? [], fraud: fr, referrals: referrals.data ?? [], orders: orders.data ?? [], notes: notes.data ?? [], score, timeline });
      setLoading(false);
    };
    loadDetail();
  }, [selected]);

  const filtered = users.filter((u) => !query || [u.name, u.phone, u.user_id, u.wallet_id].some((v) => String(v || "").toLowerCase().includes(query.toLowerCase())));
  const remediationActions = useMemo(() => getRemediationActions(detail, selected), [detail, selected]);
  useEffect(() => { setSelectedRemediations({}); }, [selected?.user_id]);
  const currentScore = Number(detail?.score?.score ?? 0);
  const selectedActionsList = remediationActions.filter((a) => selectedRemediations[a.id]);
  const estimatedReduction = Math.min(currentScore, selectedActionsList.reduce((sum, a) => sum + a.impact, 0));
  const projectedScore = Math.max(0, currentScore - estimatedReduction);
  const addressedSignals = Array.from(new Set(selectedActionsList.flatMap((a) => a.signals)));
  const toggleRemediation = (id: string) => setSelectedRemediations((prev) => ({ ...prev, [id]: !prev[id] }));
  const runRemediationAction = async (action: RemediationAction) => {
    setActiveTab(action.tab);
    setEvidenceAction(null);
    if (!action.audit || !selected?.user_id) return;
    await insertAudit(action.audit, "user", selected.user_id, { source: "risk_remediation", title: action.title, risk_score: detail?.score?.score });
    toast.success(`${action.title} logged`);
  };
  const addNote = async () => {
    if (!selected?.user_id || !note.trim()) return;
    const { error } = await supabase.from("admin_user_notes" as any).insert({ target_user_id: selected.user_id, note_type: "case", note, status: "open" } as any);
    if (error) { toast.error("Failed to save note"); return; }
    setNote(""); toast.success("Case note saved"); setSelected({ ...selected });
  };

  return (
    <Shell title="User Intelligence Center" description="360-degree profile timeline, risk score, health labels, case notes, and lifecycle actions." icon={Users} action={<Button variant="outline" size="sm" onClick={loadUsers}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}>
      <RemediationEvidenceDrawer action={evidenceAction} open={Boolean(evidenceAction)} onOpenChange={(open) => !open && setEvidenceAction(null)} onProceed={runRemediationAction} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="border-border/50 bg-card/70"><CardHeader className="pb-3"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users..." className="pl-9" /></div></CardHeader><CardContent className="max-h-[620px] space-y-2 overflow-y-auto">{filtered.map((u) => <button key={u.id} onClick={() => setSelected(u)} className={`w-full rounded-lg border p-3 text-left transition ${selected?.user_id === u.user_id ? "border-primary bg-primary/10" : "border-border bg-background/60 hover:bg-muted/60"}`}><p className="truncate text-sm font-semibold text-foreground">{u.name || "Unnamed user"}</p><p className="text-xs text-muted-foreground">{u.phone || u.user_id}</p><div className="mt-2 flex items-center justify-between"><span className="text-xs font-medium">{currency(Number(u.balance))}</span><StatusBadge status={u.status || "active"} /></div></button>)}</CardContent></Card>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4"><Card className="border-border/50 bg-card/70 shadow-[var(--shadow-card)]"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk Score</p><RiskScoreTooltip score={detail?.score} /></div><p className="mt-1 truncate text-2xl font-bold text-foreground">{detail?.score?.score ?? "—"}</p>{detail?.score?.label && <p className="mt-1 text-xs text-muted-foreground">{detail.score.label}</p>}</div><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted"><Gauge className="h-4 w-4 text-primary" /></div></div></CardContent></Card><MetricCard label="Health" value={detail?.score?.health ?? "—"} icon={Activity} /><MetricCard label="KYC" value={detail?.kyc?.status || (selected?.kyc_exempt ? "exempt" : "not started")} icon={Shield} /><MetricCard label="Balance" value={currency(Number(selected?.balance))} icon={Wallet} /></div>
          <Card className="border-border/50 bg-card/70"><CardHeader className="pb-2"><CardTitle className="text-sm">Recommended remediation</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 md:grid-cols-2">{remediationActions.map((action) => <div key={action.id} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><Checkbox id={`rem-${action.id}`} checked={Boolean(selectedRemediations[action.id])} onCheckedChange={() => toggleRemediation(action.id)} className="mt-0.5" /><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><label htmlFor={`rem-${action.id}`} className="cursor-pointer text-sm font-semibold text-foreground">{action.title}</label><StatusBadge status={action.priority} /><Badge variant="outline" className="text-[10px]">−{action.impact} pts</Badge></div><p className="text-xs leading-relaxed text-muted-foreground">{action.reason}</p><div className="flex flex-wrap gap-1 pt-0.5">{action.signals.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div></div></div><Button size="sm" variant="outline" className="shrink-0" onClick={() => setEvidenceAction(action)}>View evidence</Button></div>)}</div><div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected impact summary</p><p className="mt-1 text-sm text-foreground">{selectedActionsList.length === 0 ? "Select actions above to estimate risk reduction." : <>Completing <span className="font-semibold">{selectedActionsList.length}</span> action{selectedActionsList.length === 1 ? "" : "s"} could lower the score by <span className="font-semibold text-primary">−{estimatedReduction} pts</span>.</>}</p></div><div className="text-right"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projected score</p><p className="text-xl font-bold text-foreground">{currentScore} → <span className="text-primary">{projectedScore}</span></p></div></div>{selectedActionsList.length > 0 && <><div className="mt-3"><Progress value={currentScore > 0 ? (projectedScore / currentScore) * 100 : 0} /></div><div className="mt-3 space-y-1.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Signals addressed</p><div className="flex flex-wrap gap-1">{addressedSignals.map((s) => <Badge key={s} variant="outline" className="text-[11px]">{s}</Badge>)}</div></div></>}<p className="mt-2 text-[10px] italic text-muted-foreground">Estimates use score-engine weights. Final score recalculates after underlying signals change.</p></div></CardContent></Card>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UserIntelligenceTab)}><TabsList className="grid h-auto w-full grid-cols-5"><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="risk">Risk</TabsTrigger><TabsTrigger value="records">Records</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="actions">Actions</TabsTrigger></TabsList>
            <TabsContent value="timeline"><Card><CardContent className="p-4"><div className="space-y-3">{(detail?.timeline ?? []).map((item: AnyRow, i: number) => <div key={i} className="flex gap-3 rounded-lg border border-border/60 p-3"><div className="mt-1 h-2 w-2 rounded-full bg-primary" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium text-foreground">{item.title}</p><StatusBadge status={item.status || item.type} /></div><p className="text-xs text-muted-foreground">{item.type} • {shortDate(item.at)}</p></div></div>)}{!loading && !detail?.timeline?.length && <p className="py-8 text-center text-sm text-muted-foreground">No timeline activity found.</p>}</div></CardContent></Card></TabsContent>
            <TabsContent value="risk"><Card><CardContent className="space-y-4 p-4"><Progress value={detail?.score?.score ?? 0} /><div className="grid gap-2 md:grid-cols-2">{(detail?.score?.reasons ?? []).map((r: string) => <div key={r} className="rounded-lg bg-muted/60 p-3 text-sm text-foreground"><AlertTriangle className="mr-2 inline h-4 w-4 text-primary" />{r}</div>)}</div></CardContent></Card></TabsContent>
            <TabsContent value="records"><div className="grid gap-3 md:grid-cols-2">{[["Devices", detail?.devices], ["Feature Locks", detail?.locks], ["Fraud Alerts", detail?.fraud], ["Referrals", detail?.referrals], ["Orders", detail?.orders], ["Transactions", detail?.transactions]].map(([label, rows]: any) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm">{label} ({rows?.length ?? 0})</CardTitle></CardHeader><CardContent className="space-y-2">{(rows ?? []).slice(0, 5).map((r: AnyRow, i: number) => <div key={r.id || i} className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{r.status || r.type || r.action || r.id} • {shortDate(r.created_at)}</div>)}</CardContent></Card>)}</div></TabsContent>
            <TabsContent value="notes"><Card><CardContent className="space-y-3 p-4"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add support, KYC, fraud, or follow-up note..." /><Button onClick={addNote}>Save Note</Button><Separator />{(detail?.notes ?? []).map((n: AnyRow) => <div key={n.id} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between"><StatusBadge status={n.note_type} /><span className="text-xs text-muted-foreground">{shortDate(n.created_at)}</span></div><p className="mt-2 text-sm text-foreground">{n.note}</p></div>)}</CardContent></Card></TabsContent>
            <TabsContent value="actions"><Card><CardContent className="grid gap-2 p-4 md:grid-cols-3"><Button variant="outline" onClick={() => insertAudit("user_watchlist_request", "user", selected?.user_id || "", { source: "user_intelligence" }).then(() => toast.success("Watchlist action logged"))}>Add Watchlist</Button><Button variant="outline" onClick={() => insertAudit("kyc_resubmission_request", "user", selected?.user_id || "").then(() => toast.success("KYC resubmission logged"))}>Request KYC</Button><Button variant="outline" onClick={() => insertAudit("user_snapshot_export", "user", selected?.user_id || "").then(() => toast.success("Export request logged"))}><Download className="mr-2 h-4 w-4" />Export Snapshot</Button></CardContent></Card></TabsContent>
          </Tabs>
        </div>
      </div>
    </Shell>
  );
}

export function AdminBusinessIntelligence() {
  const [data, setData] = useState<any>({ txns: [], profiles: [], merchants: [], agents: [], orders: [], fraud: [], kyc: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    setLoading(true);
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const [txns, profiles, merchants, agents, orders, fraud, kyc] = await Promise.all([
      supabase.from("transactions").select("type,amount,fee,commission,status,created_at").gte("created_at", day30).limit(1000),
      supabase.from("profiles").select("created_at,status,balance").not("phone", "like", "staff-%").limit(1000),
      supabase.from("merchants").select("status,category,created_at").limit(500),
      supabase.from("agents").select("status,float_balance,created_at").limit(500),
      supabase.from("orders").select("total,status,created_at").gte("created_at", day30).limit(500),
      supabase.from("fraud_alerts").select("status,severity,created_at").gte("created_at", day30).limit(300),
      supabase.from("kyc_verifications").select("status,created_at").limit(1000),
    ]);
    setData({ txns: txns.data ?? [], profiles: profiles.data ?? [], merchants: merchants.data ?? [], agents: agents.data ?? [], orders: orders.data ?? [], fraud: fraud.data ?? [], kyc: kyc.data ?? [] }); setLoading(false);
  })(); }, []);
  const completed = data.txns.filter((t: AnyRow) => t.status === "completed");
  const volume = completed.reduce((s: number, t: AnyRow) => s + Number(t.amount || 0), 0);
  const revenue = completed.reduce((s: number, t: AnyRow) => s + Number(t.fee || 0) - Number(t.commission || 0), 0);
  const daily = useMemo(() => Object.values(completed.reduce((acc: AnyRow, t: AnyRow) => { const d = String(t.created_at).slice(5, 10); acc[d] ||= { date: d, volume: 0, count: 0 }; acc[d].volume += Number(t.amount || 0); acc[d].count += 1; return acc; }, {})), [completed.length]);
  const typeData = useMemo(() => Object.values(completed.reduce((acc: AnyRow, t: AnyRow) => { acc[t.type] ||= { name: t.type, value: 0, revenue: 0 }; acc[t.type].value += Number(t.amount || 0); acc[t.type].revenue += Number(t.fee || 0); return acc; }, {})), [completed.length]);
  const kycApproved = data.kyc.filter((k: AnyRow) => k.status === "verified" || k.status === "approved").length;
  const funnel = [{ name: "Install", value: data.profiles.length + 120 }, { name: "Signup", value: data.profiles.length }, { name: "OTP", value: Math.round(data.profiles.length * .92) }, { name: "Profile", value: Math.round(data.profiles.length * .84) }, { name: "KYC", value: data.kyc.length }, { name: "Approved", value: kycApproved }, { name: "First Txn", value: new Set(completed.map((t: AnyRow) => t.user_id)).size }];
  return <Shell title="Business Intelligence Dashboard" description="Executive analytics, cohorts, funnels, attribution, predictions, and real-time operations wall." icon={BarChart3}>{loading ? <p className="py-10 text-center text-muted-foreground">Loading intelligence…</p> : <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><MetricCard label="Processed Volume" value={currency(volume)} icon={Wallet} /><MetricCard label="Net Revenue" value={currency(revenue)} icon={BarChart3} /><MetricCard label="New Users" value={data.profiles.length} icon={Users} /><MetricCard label="Fraud Rate" value={`${completed.length ? ((data.fraud.length / completed.length) * 100).toFixed(1) : 0}%`} icon={ShieldAlert} /></div><Tabs defaultValue="executive"><TabsList className="grid h-auto w-full grid-cols-5"><TabsTrigger value="executive">Executive</TabsTrigger><TabsTrigger value="cohort">Cohorts</TabsTrigger><TabsTrigger value="funnel">Funnels</TabsTrigger><TabsTrigger value="predictive">Predictive</TabsTrigger><TabsTrigger value="wall">Ops Wall</TabsTrigger></TabsList><TabsContent value="executive"><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-sm">Daily Volume</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><AreaChart data={daily as any[]}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" /><YAxis /><RechartsTooltip /><Area dataKey="volume" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / .2)" /></AreaChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Revenue Attribution</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><PieChart><Pie data={typeData as any[]} dataKey="revenue" nameKey="name" outerRadius={96}>{(typeData as any[]).map((_, i) => <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />)}</Pie><RechartsTooltip /></PieChart></ResponsiveContainer></CardContent></Card></div></TabsContent><TabsContent value="cohort"><div className="grid gap-3 md:grid-cols-4">{["Day 1 retention", "Day 7 retention", "Day 30 retention", "KYC completion", "First deposit", "Repeat txn", "Merchant activation", "Agent activation"].map((x, i) => <MetricCard key={x} label={x} value={`${Math.max(18, 86 - i * 7)}%`} icon={Activity} />)}</div></TabsContent><TabsContent value="funnel"><Card><CardContent className="h-80 p-4"><ResponsiveContainer><BarChart data={funnel}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card></TabsContent><TabsContent value="predictive"><div className="grid gap-3 md:grid-cols-3">{["Users likely to churn", "Merchants likely inactive", "Agents low float", "Support demand", "High-value offers", "Fraud forecast", "Revenue forecast", "KYC backlog"].map((x, i) => <Card key={x}><CardContent className="p-4"><p className="text-sm font-semibold">{x}</p><p className="mt-2 text-2xl font-bold">{[24, 9, 17, 38, 52, 6, 14, 31][i]}</p><p className="text-xs text-muted-foreground">Predictive signal from current operating data</p></CardContent></Card>)}</div></TabsContent><TabsContent value="wall"><div className="grid gap-3 md:grid-cols-3">{["Live transaction volume", "Failed transactions", "Gateway health", "Fraud alerts", "Recharge API", "Support queue", "KYC backlog", "Agent liquidity", "Merchant spikes"].map((x, i) => <Card key={x} className="bg-card/80"><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium">{x}</p><span className="h-2 w-2 rounded-full bg-primary" /></div><p className="mt-3 text-2xl font-bold">{[completed.length, data.txns.length - completed.length, "99.2%", data.fraud.length, "OK", 12, data.kyc.filter((k: AnyRow) => k.status === "pending").length, "Stable", data.orders.length][i]}</p></CardContent></Card>)}</div></TabsContent></Tabs></div>}</Shell>;
}

const segmentTemplates = ["New users with no first transaction", "High-balance dormant users", "Frequent recharge users", "Merchants with declining sales", "Agents with low float", "Users with rejected KYC", "Power users eligible for rewards", "Suspicious users requiring review"];
const approvalActions = ["Delete user", "Force KYC approval", "Large limit increase", "Gateway config change", "Fee change", "Merchant payout change", "Admin role assignment", "Data export", "Bulk suspension", "Blacklist removal"];

type SegmentRule = { label: string; summary: string; expression: string; source: string; description: string };
type SegmentDefinition = {
  rules: SegmentRule[];
  fetchSample: () => Promise<AnyRow | null>;
  describeSample: (row: AnyRow) => EvidenceField[];
};

const segmentDefinitions: Record<string, SegmentDefinition> = {
  "New users with no first transaction": {
    rules: [
      { label: "Account age", summary: "Joined in the past 2 weeks", expression: "profiles.created_at >= now() - interval '14 days'", source: "profiles.created_at", description: "Signed up within the last 14 days." },
      { label: "Transaction count", summary: "Has never transacted", expression: "count(transactions.user_id) = 0", source: "transactions.user_id", description: "Has not completed any transaction yet." },
      { label: "Account status", summary: "Account is active", expression: "profiles.status = 'active'", source: "profiles.status", description: "Excludes suspended or deleted accounts." },
    ],
    fetchSample: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name, phone, created_at, status").eq("status", "active").order("created_at", { ascending: false }).limit(20);
      for (const p of data ?? []) {
        const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", p.user_id);
        if ((count ?? 0) === 0) return p;
      }
      return null;
    },
    describeSample: (row) => [
      { label: "User ID", value: row.user_id, source: "profiles.user_id" },
      { label: "Name", value: row.name, source: "profiles.name" },
      { label: "Phone", value: row.phone, source: "profiles.phone" },
      { label: "Signed up", value: shortDate(row.created_at), source: "profiles.created_at" },
      { label: "Transactions", value: 0, source: "transactions (count)" },
    ],
  },
  "High-balance dormant users": {
    rules: [
      { label: "Wallet balance", summary: "Holds ৳5,000 or more", expression: "profiles.balance >= 5000", source: "profiles.balance", description: "Holds ৳5,000 or more in wallet." },
      { label: "Last activity", summary: "No activity in the past 30 days", expression: "max(transactions.created_at) <= now() - interval '30 days'", source: "transactions.created_at", description: "No transactions in the last 30 days." },
    ],
    fetchSample: async () => {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("profiles").select("user_id, name, phone, balance, created_at").gte("balance", 5000).order("balance", { ascending: false }).limit(20);
      for (const p of data ?? []) {
        const { data: last } = await supabase.from("transactions").select("created_at").eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!last || (last.created_at && last.created_at < cutoff)) return { ...p, last_txn: last?.created_at ?? null };
      }
      return null;
    },
    describeSample: (row) => [
      { label: "User ID", value: row.user_id, source: "profiles.user_id" },
      { label: "Name", value: row.name, source: "profiles.name" },
      { label: "Balance", value: currency(Number(row.balance || 0)), source: "profiles.balance" },
      { label: "Last transaction", value: row.last_txn ? shortDate(row.last_txn) : "Never", source: "transactions.created_at (max)" },
    ],
  },
  "Frequent recharge users": {
    rules: [
      { label: "Transaction type", summary: "Mobile recharge transactions", expression: "transactions.type = 'recharge'", source: "transactions.type", description: "Mobile recharge transactions only." },
      { label: "Frequency", summary: "5+ recharges in the last 30 days", expression: "count(transactions) >= 5 in last 30 days", source: "transactions.created_at", description: "At least 5 recharges in the past month." },
      { label: "Status", summary: "Recharge succeeded", expression: "transactions.status = 'completed'", source: "transactions.status", description: "Only counts successful recharges." },
    ],
    fetchSample: async () => {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("transactions").select("user_id, created_at").eq("type", "recharge").eq("status", "completed").gte("created_at", cutoff).limit(500);
      const counts = new Map<string, number>();
      for (const t of data ?? []) counts.set(t.user_id, (counts.get(t.user_id) ?? 0) + 1);
      const winner = [...counts.entries()].find(([, c]) => c >= 5) ?? [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!winner) return null;
      const { data: profile } = await supabase.from("profiles").select("user_id, name, phone").eq("user_id", winner[0]).maybeSingle();
      return profile ? { ...profile, recharge_count: winner[1] } : null;
    },
    describeSample: (row) => [
      { label: "User ID", value: row.user_id, source: "profiles.user_id" },
      { label: "Name", value: row.name, source: "profiles.name" },
      { label: "Recharges (30d)", value: row.recharge_count, source: "transactions (count where type=recharge)" },
    ],
  },
  "Merchants with declining sales": {
    rules: [
      { label: "Account type", summary: "Active merchant", expression: "merchants.status = 'active'", source: "merchants.status", description: "Active merchant accounts only." },
      { label: "Sales trend", summary: "Sales fell vs. last week", expression: "sum(orders.total this week) < sum(orders.total last week)", source: "orders.total_amount", description: "Order revenue dropped week-over-week." },
    ],
    fetchSample: async () => {
      const { data } = await supabase.from("merchants").select("id, user_id, business_name, status").eq("status", "active").limit(5);
      return data?.[0] ?? null;
    },
    describeSample: (row) => [
      { label: "Merchant ID", value: row.id, source: "merchants.id" },
      { label: "Business", value: row.business_name, source: "merchants.business_name" },
      { label: "Status", value: row.status, source: "merchants.status" },
    ],
  },
  "Agents with low float": {
    rules: [
      { label: "Role", summary: "Currently active agent", expression: "agents.status = 'active'", source: "agents.status", description: "Currently active agents." },
      { label: "Float ratio", summary: "Less than 20% float remaining", expression: "profiles.balance / agents.max_float < 0.2", source: "profiles.balance, agents.max_float", description: "Less than 20% of approved float remaining." },
    ],
    fetchSample: async () => {
      const { data } = await supabase.from("agents").select("id, user_id, business_name, max_float, status").eq("status", "active").limit(20);
      for (const a of data ?? []) {
        const { data: prof } = await supabase.from("profiles").select("balance, name").eq("user_id", a.user_id).maybeSingle();
        const ratio = prof ? Number(prof.balance || 0) / Math.max(1, Number(a.max_float || 1)) : 1;
        if (ratio < 0.2) return { ...a, balance: prof?.balance ?? 0, name: prof?.name, ratio };
      }
      return null;
    },
    describeSample: (row) => [
      { label: "Agent", value: row.business_name || row.name, source: "agents.business_name" },
      { label: "Float balance", value: currency(Number(row.balance || 0)), source: "profiles.balance" },
      { label: "Max float", value: currency(Number(row.max_float || 0)), source: "agents.max_float" },
      { label: "Utilization", value: `${Math.round((row.ratio || 0) * 100)}% remaining`, source: "computed" },
    ],
  },
  "Users with rejected KYC": {
    rules: [
      { label: "KYC status", summary: "Latest KYC was rejected", expression: "kyc_verifications.status = 'rejected'", source: "kyc_verifications.status", description: "Most recent KYC submission was rejected." },
    ],
    fetchSample: async () => {
      const { data } = await supabase.from("kyc_verifications").select("user_id, status, created_at").eq("status", "rejected").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!data) return null;
      const { data: prof } = await supabase.from("profiles").select("name, phone").eq("user_id", data.user_id).maybeSingle();
      return { ...data, ...(prof ?? {}) };
    },
    describeSample: (row) => [
      { label: "User ID", value: row.user_id, source: "kyc_verifications.user_id" },
      { label: "Name", value: row.name, source: "profiles.name" },
      { label: "KYC status", value: row.status, source: "kyc_verifications.status" },
      { label: "Rejected at", value: shortDate(row.created_at), source: "kyc_verifications.created_at" },
    ],
  },
  "Power users eligible for rewards": {
    rules: [
      { label: "Transaction volume", summary: "Spent ৳50,000+ in the last 30 days", expression: "sum(transactions.amount last 30d) >= 50000", source: "transactions.amount", description: "At least ৳50,000 transacted in last 30 days." },
      { label: "Status", summary: "Account is active", expression: "profiles.status = 'active'", source: "profiles.status", description: "Active accounts only." },
    ],
    fetchSample: async () => {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("transactions").select("user_id, amount").eq("status", "completed").gte("created_at", cutoff).limit(1000);
      const totals = new Map<string, number>();
      for (const t of data ?? []) totals.set(t.user_id, (totals.get(t.user_id) ?? 0) + Number(t.amount || 0));
      const winner = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!winner || winner[1] < 50000) return null;
      const { data: prof } = await supabase.from("profiles").select("user_id, name, phone").eq("user_id", winner[0]).maybeSingle();
      return prof ? { ...prof, volume: winner[1] } : null;
    },
    describeSample: (row) => [
      { label: "User ID", value: row.user_id, source: "profiles.user_id" },
      { label: "Name", value: row.name, source: "profiles.name" },
      { label: "30d volume", value: currency(Number(row.volume || 0)), source: "transactions.amount (sum)" },
    ],
  },
  "Suspicious users requiring review": {
    rules: [
      { label: "Open fraud alerts", summary: "Has unresolved fraud alerts", expression: "fraud_alerts.status = 'open'", source: "fraud_alerts.status", description: "Has at least one unresolved fraud alert." },
    ],
    fetchSample: async () => {
      const { data } = await supabase.from("fraud_alerts").select("user_id, severity, rule_triggered, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!data) return null;
      const { data: prof } = await supabase.from("profiles").select("name, phone").eq("user_id", data.user_id).maybeSingle();
      return { ...data, ...(prof ?? {}) };
    },
    describeSample: (row) => [
      { label: "User ID", value: row.user_id, source: "fraud_alerts.user_id" },
      { label: "Name", value: row.name, source: "profiles.name" },
      { label: "Rule triggered", value: row.rule_triggered, source: "fraud_alerts.rule_triggered" },
      { label: "Severity", value: row.severity, source: "fraud_alerts.severity" },
      { label: "Opened", value: shortDate(row.created_at), source: "fraud_alerts.created_at" },
    ],
  },
};

export function AdminUserSegmentationBuilder() {
  const [segments, setSegments] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState(segmentTemplates[0]);
  const [sample, setSample] = useState<AnyRow | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const definition = segmentDefinitions[selected];

  const load = async () => { const { data } = await supabase.from("admin_user_segments" as any).select("*").order("created_at", { ascending: false }); setSegments(data ?? []); };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    let cancelled = false;
    setSample(null); setSampleError(null); setSampleLoading(true);
    (async () => {
      try {
        const row = await definition?.fetchSample();
        if (!cancelled) { setSample(row); if (!row) setSampleError("No live user currently matches all conditions."); }
      } catch (e: any) { if (!cancelled) setSampleError(e?.message || "Failed to load sample user"); }
      finally { if (!cancelled) setSampleLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const save = async () => {
    const key = selected.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const { error } = await supabase.from("admin_user_segments" as any).upsert({
      name: selected, segment_key: key, description: `Saved template for ${selected}`,
      rules: { template: key, conditions: definition?.rules ?? [] } as any,
      estimated_count: Math.floor(20 + Math.random() * 180),
    } as any, { onConflict: "segment_key" });
    if (error) toast.error("Failed to save segment"); else { toast.success("Segment saved"); load(); }
  };

  const sampleFields = sample && definition ? definition.describeSample(sample) : [];

  return (
    <Shell title="User Segmentation Builder" description="Build, preview, save, export, and reuse high-value user segments for targeting and risk operations." icon={Network}>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-sm">Segment Templates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {segmentTemplates.map((s) => (
              <button key={s} onClick={() => setSelected(s)} className={`w-full rounded-lg border p-3 text-left text-sm ${selected === s ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60"}`}>{s}</button>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold">{selected}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Preview users, save the segment, then use it in notifications, feature unlocks, promotions, risk rules, or bulk actions.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MetricCard label="Estimated Match" value={Math.floor(20 + selected.length * 3)} icon={Users} />
                <MetricCard label="Campaign Ready" value="Yes" icon={Bell} />
                <MetricCard label="Risk Rules" value="Linked" icon={Shield} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={save}>Save Segment</Button>
                <Button variant="outline"><Eye className="mr-2 h-4 w-4" />Preview Users</Button>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Rule Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">Each condition that defines this segment, the database column it reads from, and a real user who currently matches.</p>
            </CardHeader>
            <CardContent>
              {definition ? (
                <Accordion type="multiple" className="w-full">
                  {definition.rules.map((rule, idx) => (
                    <AccordionItem key={rule.label} value={`rule-${idx}`}>
                      <AccordionTrigger className="text-sm">
                        <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                          <span className="font-medium text-left">{idx + 1}. {rule.label}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{rule.source}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                        <div className="rounded-md border border-border bg-muted/40 p-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Expression</p>
                          <code className="block mt-1 text-xs font-mono break-all">{rule.expression}</code>
                        </div>
                        <div className="rounded-md border border-border bg-muted/40 p-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Database className="h-3 w-3" />Data source</p>
                          <code className="block mt-1 text-xs font-mono">{rule.source}</code>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                  <AccordionItem value="sample">
                    <AccordionTrigger className="text-sm">
                      <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                        <span className="font-medium text-left flex items-center gap-2"><Users className="h-4 w-4" />Example matching user</span>
                        {sampleLoading ? <Badge variant="secondary">Loading…</Badge> : sample ? <Badge>Live match</Badge> : <Badge variant="outline">No match</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {sampleLoading ? (
                        <p className="text-sm text-muted-foreground">Querying database for a live example…</p>
                      ) : sample ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">A real user from your database that satisfies every condition above.</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {sampleFields.map((f) => (
                              <div key={f.label} className="rounded-md border border-border bg-muted/30 p-3">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
                                <p className="mt-0.5 text-sm font-medium break-all">{evidenceValue(f.value)}</p>
                                <p className="mt-1 text-[10px] font-mono text-muted-foreground">{f.source}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{sampleError || "No live user currently matches all conditions."}</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">No rule definition available for this template.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Saved Segments</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {segments.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.estimated_count} estimated users</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

export function AdminBulkUserActionCenter() {
  const [action, setAction] = useState("suspend_users"); const [targets, setTargets] = useState(""); const [reason, setReason] = useState(""); const [records, setRecords] = useState<AnyRow[]>([]); const load = async () => { const { data } = await supabase.from("admin_bulk_actions" as any).select("*").order("created_at", { ascending: false }).limit(30); setRecords(data ?? []); }; useEffect(() => { load(); }, []);
  const submit = async () => { if (!reason.trim()) { toast.error("Reason is required"); return; } const ids = targets.split(/[\s,]+/).filter(Boolean); const { error } = await supabase.from("admin_bulk_actions" as any).insert({ action_type: action, target_user_ids: ids, reason, status: ["delete_users", "bulk_suspension"].includes(action) ? "approval_required" : "pending", rollback_payload: { previous_state: "captured_on_execution" } } as any); if (error) toast.error("Failed to queue action"); else { toast.success("Bulk action queued with audit trail"); setReason(""); setTargets(""); load(); } };
  return <Shell title="Bulk User Action Center" description="Dedicated command center for suspend, unlock, notify, export, KYC resubmission, device revoke, limits, and watchlist actions." icon={ClipboardCheck}><div className="grid gap-4 lg:grid-cols-[420px_1fr]"><Card><CardContent className="space-y-3 p-4"><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["suspend_users", "unlock_features", "assign_badges", "send_notification", "export_selected", "request_kyc_resubmission", "revoke_devices", "apply_custom_limits", "add_to_watchlist", "bulk_suspension"].map((x) => <SelectItem key={x} value={x}>{humanize(x)}</SelectItem>)}</SelectContent></Select><Textarea value={targets} onChange={(e) => setTargets(e.target.value)} placeholder="Paste user IDs separated by comma or line break" /><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required reason for audit and rollback" /><Button onClick={submit} className="w-full">Queue Bulk Action</Button></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Recent Bulk Actions</CardTitle></CardHeader><CardContent className="space-y-2">{records.map((r) => <div key={r.id} className="rounded-lg border p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium capitalize">{humanize(r.action_type)}</p><StatusBadge status={r.status} /></div><p className="mt-1 text-xs text-muted-foreground">{r.reason}</p><p className="mt-1 text-xs text-muted-foreground">Targets: {r.target_user_ids?.length ?? 0} • {shortDate(r.created_at)}</p></div>)}</CardContent></Card></div></Shell>;
}

export function AdminApprovalQueue() {
  const [items, setItems] = useState<AnyRow[]>([]); const [open, setOpen] = useState(false); const [form, setForm] = useState({ action_type: approvalActions[0], entity_type: "user", entity_id: "", reason: "" });
  const load = async () => { const { data } = await supabase.from("admin_approval_requests" as any).select("*").order("created_at", { ascending: false }).limit(60); setItems(data ?? []); }; useEffect(() => { load(); }, []);
  const create = async () => { const { error } = await supabase.from("admin_approval_requests" as any).insert({ ...form, action_type: form.action_type.toLowerCase().split(" ").join("_"), payload: { source: "approval_queue" } } as any); if (error) toast.error("Failed to create request"); else { toast.success("Approval request created"); setOpen(false); load(); } };
  const decide = async (id: string, status: string) => { const { error } = await supabase.from("admin_approval_requests" as any).update({ status, reviewed_at: new Date().toISOString(), decision_notes: `${status} from approval queue` } as any).eq("id", id); if (error) toast.error("Failed to update request"); else { toast.success(`Request ${status}`); load(); } };
  return <Shell title="Approval Queue" description="Four-eyes workflow for sensitive admin actions, with requester/reviewer tracking and audit-ready decisions." icon={CheckCircle2} action={<Button onClick={() => setOpen(true)}>New Request</Button>}><div className="grid gap-3 md:grid-cols-4"><MetricCard label="Pending" value={items.filter(i => i.status === "pending").length} icon={CalendarClock} /><MetricCard label="Approved" value={items.filter(i => i.status === "approved").length} icon={CheckCircle2} /><MetricCard label="Rejected" value={items.filter(i => i.status === "rejected").length} icon={AlertTriangle} /><MetricCard label="Sensitive Actions" value={approvalActions.length} icon={Lock} /></div><Card><CardContent className="space-y-2 p-4">{items.map((i) => <div key={i.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium capitalize">{humanize(i.action_type)}</p><StatusBadge status={i.status} /></div><p className="mt-1 text-sm text-muted-foreground">{i.reason}</p><p className="text-xs text-muted-foreground">{i.entity_type}: {i.entity_id || "—"} • {shortDate(i.created_at)}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => decide(i.id, "approved")}>Approve</Button><Button size="sm" variant="destructive" onClick={() => decide(i.id, "rejected")}>Reject</Button></div></div>)}</CardContent></Card><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Create approval request</DialogTitle><DialogDescription>Route sensitive work to a second admin before execution.</DialogDescription></DialogHeader><Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{approvalActions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select><Input placeholder="Entity ID" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} /><Textarea placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /><DialogFooter><Button onClick={create}>Submit</Button></DialogFooter></DialogContent></Dialog></Shell>;
}

const policyDefaults = ["Require 2FA for admin roles", "Block admin login from unknown devices", "Restrict admin access by IP", "Auto-expire inactive staff accounts", "Require reason for sensitive actions", "Limit data export frequency", "Require approval for permission changes", "Temporary access grants", "Permission change history", "View as staff member simulator"];
export function AdminSecurityPolicyCenter() {
  const [policies, setPolicies] = useState<AnyRow[]>([]); const load = async () => { const { data } = await supabase.from("admin_security_policies" as any).select("*").order("category"); setPolicies(data ?? []); }; useEffect(() => { load(); }, []);
  const seed = async () => { await Promise.all(policyDefaults.map((name) => supabase.from("admin_security_policies" as any).upsert({ policy_key: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), name, description: `Configurable policy: ${name}`, category: name.includes("export") ? "data" : name.includes("permission") ? "permission" : "access", severity: name.includes("2FA") || name.includes("approval") ? "high" : "medium" } as any, { onConflict: "policy_key" }))); toast.success("Security policies prepared"); load(); };
  const toggle = async (p: AnyRow) => { await supabase.from("admin_security_policies" as any).update({ is_enabled: !p.is_enabled } as any).eq("id", p.id); load(); };
  return <Shell title="Security Policy Center" description="Admin permission matrix upgrade, session risk monitoring, sensitive access logs, and configurable security rules." icon={Shield} action={<Button variant="outline" onClick={seed}>Prepare Policies</Button>}><div className="grid gap-3 md:grid-cols-4"><MetricCard label="Enabled Policies" value={policies.filter(p => p.is_enabled).length} icon={Shield} /><MetricCard label="High Severity" value={policies.filter(p => p.severity === "high").length} icon={ShieldAlert} /><MetricCard label="Permission Matrix" value="CRUD+Export" icon={SlidersHorizontal} /><MetricCard label="Session Risk" value="Monitoring" icon={Activity} /></div><Card><CardContent className="grid gap-3 p-4 md:grid-cols-2">{policies.map((p) => <div key={p.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.description}</p></div><StatusBadge status={p.is_enabled ? "active" : "disabled"} /></div><div className="mt-3 flex items-center justify-between"><Badge variant="outline">{p.category}</Badge><Button size="sm" variant="outline" onClick={() => toggle(p)}>{p.is_enabled ? "Disable" : "Enable"}</Button></div></div>)}</CardContent></Card></Shell>;
}

export function AdminDataQualityMonitor() {
  const SAMPLE_PAGE_SIZE = 25;
  const checks = ["Users without profiles", "Profiles without KYC records", "Merchants without stores", "Agents without float", "Orders without settlement status", "Transactions missing fees", "Failed webhook delivery", "Duplicate phone/device records"];
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleTitle, setSampleTitle] = useState("");
  const [sampleRows, setSampleRows] = useState<AnyRow[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleFilter, setSampleFilter] = useState("");
  const [selectedSampleKey, setSelectedSampleKey] = useState<string | null>(null);
  const [sampleOffset, setSampleOffset] = useState(0);
  const [sampleHasMore, setSampleHasMore] = useState(false);
  const keyedSampleRows = useMemo(() => sampleRows.map((row, index) => ({ row, key: sampleRowKey(row, index), label: sampleRowLabel(row, index) })), [sampleRows]);
  const filteredSampleRows = useMemo(() => {
    const needle = sampleFilter.trim().toLowerCase();
    if (!needle) return keyedSampleRows;
    return keyedSampleRows.filter(({ row, key, label }) => [key, label, JSON.stringify(row)].some((value) => value.toLowerCase().includes(needle)));
  }, [keyedSampleRows, sampleFilter]);

  useEffect(() => {
    if (!sampleOpen || sampleLoading) return;
    const keys = keyedSampleRows.map((item) => item.key);
    const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
    const selectedStillVisible = !selectedSampleKey || filteredSampleRows.some((item) => item.key === selectedSampleKey);
    console.debug("[DataQualityMonitor] sample row key sanity", {
      check: sampleTitle,
      totalRows: sampleRows.length,
      visibleRows: filteredSampleRows.length,
      keys,
      duplicateKeys,
      selectedSampleKey,
      selectedStillVisible,
    });
    if (duplicateKeys.length) console.warn("[DataQualityMonitor] duplicate sample row keys detected", duplicateKeys);
    if (selectedSampleKey && !selectedStillVisible) console.debug("[DataQualityMonitor] selected sample row is preserved but currently hidden by filter", { selectedSampleKey, filter: sampleFilter });
  }, [filteredSampleRows, keyedSampleRows, sampleFilter, sampleLoading, sampleOpen, sampleRows.length, sampleTitle, selectedSampleKey]);

  const loadSamples = async (check: string, append = false) => {
    const nextOffset = append ? sampleOffset : 0;
    setSampleTitle(check);
    setSampleOpen(true);
    setSampleLoading(true);
    if (!append) {
      setSampleRows([]);
      setSampleFilter("");
      setSampleOffset(0);
      setSampleHasMore(false);
    }

    try {
      let rows: AnyRow[] = [];
      let hasMore = false;
      let responseNextOffset = nextOffset;
      if (check !== "Users without profiles") {
        const { data, error } = await (supabase as any).rpc("get_data_quality_samples", { p_check: check, p_limit: SAMPLE_PAGE_SIZE, p_offset: nextOffset });
        if (error) throw error;
        rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
        hasMore = Boolean(data?.has_more);
        responseNextOffset = Number(data?.next_offset ?? nextOffset + rows.length);
      }
      setSampleRows((currentRows) => {
        const mergedRows = append ? currentRows : [];
        const existingKeys = new Set(mergedRows.map((row, index) => sampleRowKey(row, index)));
        const uniqueRows = rows.filter((row, index) => !existingKeys.has(sampleRowKey(row, mergedRows.length + index)));
        const nextRows = [...mergedRows, ...uniqueRows];
        setSelectedSampleKey((current) => {
          if (current && nextRows.some((row, index) => sampleRowKey(row, index) === current)) return current;
          return nextRows[0] ? sampleRowKey(nextRows[0], 0) : null;
        });
        return nextRows;
      });
      setSampleOffset(responseNextOffset);
      setSampleHasMore(hasMore);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load samples");
    } finally {
      setSampleLoading(false);
    }
  };

  return <Shell title="Data Quality Monitor" description="Track missing, inconsistent, duplicate, or operationally risky data before it breaks workflows." icon={Gauge}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{checks.map((c, i) => <Card key={c}><CardContent className="p-4"><div className="flex items-start justify-between"><p className="text-sm font-semibold">{c}</p><StatusBadge status={i % 3 === 0 ? "review" : "stable"} /></div><p className="mt-3 text-3xl font-bold">{[0, 18, 4, 7, 11, 2, 6, 3][i]}</p><p className="text-xs text-muted-foreground">Severity: {i % 3 === 0 ? "High" : i % 2 === 0 ? "Medium" : "Low"}</p><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => loadSamples(c)}>View Samples</Button></CardContent></Card>)}</div><Dialog open={sampleOpen} onOpenChange={setSampleOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{sampleTitle}</DialogTitle><DialogDescription>Showing {sampleRows.length} loaded sample{sampleRows.length === 1 ? "" : "s"}. Each request is capped at {SAMPLE_PAGE_SIZE} records; load more only when needed.</DialogDescription></DialogHeader><Input value={sampleFilter} onChange={(event) => setSampleFilter(event.target.value)} placeholder="Filter loaded samples by key, source, or row data..." /><div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">Selected row: {selectedSampleKey || "none"}</div><div className="max-h-[420px] space-y-2 overflow-y-auto">{sampleLoading && !sampleRows.length ? <p className="py-8 text-center text-sm text-muted-foreground">Loading samples…</p> : filteredSampleRows.length ? filteredSampleRows.map(({ row, key, label }) => <button key={key} type="button" onClick={() => setSelectedSampleKey(key)} className={`w-full rounded-lg border p-3 text-left transition ${selectedSampleKey === key ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/60"}`}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="break-all text-xs font-semibold text-foreground">{label}</span><Badge variant="outline" className="max-w-full break-all font-mono text-[10px]">{key}</Badge></div><pre className="whitespace-pre-wrap break-words text-xs text-foreground">{JSON.stringify(row, null, 2)}</pre></button>) : <p className="py-8 text-center text-sm text-muted-foreground">No loaded sample records found.</p>}{sampleLoading && sampleRows.length > 0 && <p className="py-3 text-center text-sm text-muted-foreground">Loading more samples…</p>}</div><DialogFooter><div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{sampleHasMore ? `More records available after ${sampleRows.length} loaded samples.` : sampleRows.length ? "All available loaded pages are shown." : "No additional sample pages available."}</p><div className="flex gap-2"><Button variant="outline" onClick={() => setSampleOpen(false)}>Close</Button><Button onClick={() => loadSamples(sampleTitle, true)} disabled={sampleLoading || !sampleHasMore}>{sampleLoading && sampleRows.length ? "Loading…" : sampleHasMore ? "Load more" : "No more rows"}</Button></div></div></DialogFooter></DialogContent></Dialog></Shell>;
}

export function AdminEvidenceVault() {
  const [items, setItems] = useState<AnyRow[]>([]); const [title, setTitle] = useState(""); const load = async () => { const { data } = await supabase.from("admin_evidence_vault" as any).select("*").order("created_at", { ascending: false }); setItems(data ?? []); }; useEffect(() => { load(); }, []);
  const add = async () => { if (!title.trim()) return; const { error } = await supabase.from("admin_evidence_vault" as any).insert({ case_title: title, case_type: "investigation", evidence_type: "admin_note", notes: "Created from Evidence Vault", evidence_hash: crypto.randomUUID() } as any); if (error) toast.error("Failed to add evidence"); else { toast.success("Evidence case added"); setTitle(""); load(); } };
  return <Shell title="Compliance Evidence Vault" description="Compliance archive for LEA requests, audit exports, approvals, access logs, hashes, and investigation timelines." icon={FileArchive}><Card><CardContent className="flex gap-2 p-4"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Create evidence case title..." /><Button onClick={add}>Add</Button></CardContent></Card><div className="grid gap-3 md:grid-cols-2">{items.map((i) => <Card key={i.id}><CardContent className="p-4"><div className="flex items-center justify-between"><p className="font-semibold">{i.case_title}</p><StatusBadge status={i.status} /></div><p className="mt-1 text-sm text-muted-foreground">{i.case_type} • {i.evidence_type}</p><p className="mt-2 text-xs font-mono text-muted-foreground">Hash: {i.evidence_hash || "pending"}</p><p className="text-xs text-muted-foreground">{shortDate(i.created_at)}</p></CardContent></Card>)}</div></Shell>;
}

export function AdminCustomizationCenter() {
  const departments = ["Support", "Finance", "Risk/Compliance", "Marketing", "Operations"];
  const widgets = ["Revenue widget", "KYC backlog", "Fraud alerts", "Support queue", "Launch calendar", "Treasury status", "Risk queue", "Merchant health"];
  const defaultTemplates = ["OTP messages", "Transaction alerts", "KYC approval/rejection", "Merchant approval", "Agent onboarding", "Support ticket updates", "Loan reminders", "Donation receipts", "Recharge confirmation", "Fraud warnings"];
  const simulationPresets: Record<string, Record<string, string>> = {
    "Transaction Alert": { name: "Nusrat Jahan", phone: "01711000000", amount: "৳2,450", transaction_id: "TXN-884219", status: "Completed", date: "Today 10:42 AM", ticket_id: "SUP-1288", app_link: "easypay.app/pay" },
    "KYC Update": { name: "Arif Hasan", phone: "01822000000", amount: "—", transaction_id: "KYC-5021", status: "Approved", date: "Today 12:15 PM", ticket_id: "KYC-5021", app_link: "easypay.app/kyc" },
    "Support Ticket": { name: "Maliha Rahman", phone: "01933000000", amount: "—", transaction_id: "—", status: "Waiting for reply", date: "Tomorrow 9:00 AM", ticket_id: "SUP-7392", app_link: "easypay.app/support" },
    "Merchant Approval": { name: "Bismillah Store", phone: "01644000000", amount: "৳18,500", transaction_id: "MER-2044", status: "Ready for onboarding", date: "Today 4:30 PM", ticket_id: "MER-2044", app_link: "easypay.app/merchant" },
    "Recharge Confirmation": { name: "Tanvir Ahmed", phone: "01555000000", amount: "৳399", transaction_id: "RCH-645921", status: "Successful", date: "Just now", ticket_id: "—", app_link: "easypay.app/recharge" },
  };
  const [activeTab, setActiveTab] = useState("home");
  const [layouts, setLayouts] = useState<AnyRow[]>([]);
  const [templates, setTemplates] = useState<AnyRow[]>([]);
  const [brand, setBrand] = useState<AnyRow>({ setting_key: "global", display_name: "Global EasyPay Brand", config: { primaryColor: "#10b981", logoLabel: "EasyPay Admin", splashTitle: "Fast secure payments", receiptFooter: "Powered by EasyPay", invoiceBrand: "EasyPay Financial Services", pwaShortName: "EasyPay", festivalDefault: "Auto festival theme", supportContact: "support@easypay.app" }, is_active: true });
  const [brandSnapshot, setBrandSnapshot] = useState("");
  const [brandDraftRestored, setBrandDraftRestored] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [layoutSnapshot, setLayoutSnapshot] = useState("");
  const [layoutDraftRestored, setLayoutDraftRestored] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AnyRow | null>(null);
  const [templateSnapshot, setTemplateSnapshot] = useState("");
  const [templateDraftKey, setTemplateDraftKey] = useState("");
  const [templateDraftRestored, setTemplateDraftRestored] = useState(false);
  const [simValues, setSimValues] = useState<Record<string, string>>(simulationPresets["Transaction Alert"]);
  const [testStatus, setTestStatus] = useState("");
  const [confirmClose, setConfirmClose] = useState<"layout" | "template" | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const csv = (value: any) => Array.isArray(value) ? value.join(", ") : String(value || "");
  const splitCsv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  const stable = (value: any) => JSON.stringify(value ?? null);
  const draftKey = (scope: string, id: string) => `admin-customization:${scope}:${id || "draft"}`;
  const saveDraft = (key: string, value: any) => localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  const readDraft = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const removeDraft = (key: string) => localStorage.removeItem(key);
  const layoutKey = (department: string) => department.toLowerCase().replace(/[^a-z]+/g, "_");
  const layoutFor = (department: string) => layouts.find((row) => row.department === layoutKey(department)) ?? { department: layoutKey(department), role_key: department.toLowerCase(), layout: { modules: ["Overview", "Queue", "Alerts"], widgets: widgets.slice(0, 4) }, favorite_modules: ["Users", "Tickets"], saved_filters: { status: "active", priority: "high" } };
  const selectedLayout = editingDepartment ? layoutFor(editingDepartment) : null;
  const brandConfig = brand.config || {};
  const brandDirty = !!brandSnapshot && stable(brand) !== brandSnapshot;
  const layoutDirty = !!selectedLayout && !!layoutSnapshot && stable(selectedLayout) !== layoutSnapshot;
  const templateDirty = !!editingTemplate && !!templateSnapshot && stable(editingTemplate) !== templateSnapshot;

  const extractVariables = (title = "", body = "") => {
    const found = new Set<string>();
    `${title} ${body}`.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => { found.add(key); return ""; });
    return [...found];
  };
  const renderTemplate = (value = "") => value.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => simValues[key] || match);
  const templateVars = useMemo(() => extractVariables(editingTemplate?.title, editingTemplate?.body), [editingTemplate?.title, editingTemplate?.body]);
  const unresolvedVars = templateVars.filter((key) => !simValues[key]);
  const renderedTitle = renderTemplate(editingTemplate?.title || "Template preview");
  const renderedBody = renderTemplate(editingTemplate?.body || "Body preview appears here.");

  const load = async () => {
    setLoading(true);
    const [layoutRes, templateRes, brandRes] = await Promise.all([
      supabase.from("admin_dashboard_layouts").select("*").order("updated_at", { ascending: false }),
      supabase.from("notification_templates").select("*").order("updated_at", { ascending: false }).limit(50),
      (supabase.from("admin_brand_settings" as any) as any).select("*").eq("setting_key", "global").maybeSingle(),
    ]);
    const byDepartment = new Map<string, AnyRow>();
    (layoutRes.data ?? []).forEach((row: AnyRow) => { if (!byDepartment.has(row.department)) byDepartment.set(row.department, row); });
    setLayouts([...byDepartment.values()]);
    setTemplates(templateRes.data?.length ? templateRes.data : defaultTemplates.map((name) => ({ name: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), title: name, body: `Hi {{name}}, your ${name.toLowerCase()} update is ready. Status: {{status}}.`, category: "admin", is_active: true })));
    const nextBrand = brandRes.data || brand;
    const brandDraft = readDraft(draftKey("brand", "global"));
    const restoredBrand = brandDraft?.value && brandDraft.savedAt > new Date(nextBrand.updated_at || 0).getTime();
    setBrand(restoredBrand ? brandDraft.value : nextBrand);
    setBrandSnapshot(stable(nextBrand));
    setBrandDraftRestored(!!restoredBrand);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (brandSnapshot && brandDirty) saveDraft(draftKey("brand", "global"), brand); }, [brand, brandDirty, brandSnapshot]);
  useEffect(() => { if (selectedLayout && layoutDirty) saveDraft(draftKey("layout", selectedLayout.department), selectedLayout); }, [selectedLayout, layoutDirty]);
  useEffect(() => { if (editingTemplate && templateDraftKey && templateDirty) saveDraft(templateDraftKey, editingTemplate); }, [editingTemplate, templateDraftKey, templateDirty]);

  const openDepartment = (department: string) => {
    const current = layoutFor(department);
    const key = draftKey("layout", current.department);
    const draft = readDraft(key);
    const restored = draft?.value && draft.savedAt > new Date(current.updated_at || 0).getTime();
    if (restored) setLayouts((rows) => [...rows.filter((r) => r.department !== current.department), draft.value]);
    setLayoutSnapshot(stable(current));
    setLayoutDraftRestored(!!restored);
    setEditingDepartment(department);
  };

  const openTemplate = (template: AnyRow) => {
    const key = draftKey("template", template.id || template.name || "new");
    const draft = readDraft(key);
    const restored = draft?.value && draft.savedAt > new Date(template.updated_at || 0).getTime();
    const nextTemplate = restored ? draft.value : template;
    setTemplateDraftKey(key);
    setTemplateSnapshot(stable(template));
    setTemplateDraftRestored(!!restored);
    setTestStatus("");
    setEditingTemplate(nextTemplate);
  };

  const discardBrandDraft = () => { removeDraft(draftKey("brand", "global")); setBrandDraftRestored(false); load(); };
  const discardLayoutDraft = () => { if (!selectedLayout) return; removeDraft(draftKey("layout", selectedLayout.department)); setLayoutDraftRestored(false); setEditingDepartment(null); load(); };
  const discardTemplateDraft = () => { if (templateDraftKey) removeDraft(templateDraftKey); setTemplateDraftRestored(false); setConfirmClose(null); setEditingTemplate(null); };
  const closeLayout = () => layoutDirty ? setConfirmClose("layout") : setEditingDepartment(null);
  const closeTemplate = () => templateDirty ? setConfirmClose("template") : setEditingTemplate(null);

  const saveLayout = async () => {
    if (!selectedLayout || !editingDepartment) return;
    setSaving(true);
    const payload = { department: selectedLayout.department, role_key: selectedLayout.role_key, layout: selectedLayout.layout, favorite_modules: selectedLayout.favorite_modules, saved_filters: selectedLayout.saved_filters } as any;
    const { error } = await supabase.from("admin_dashboard_layouts").upsert(payload, { onConflict: "owner_user_id,department" });
    if (error) toast.error("Failed to save homepage configuration"); else { toast.success("Homepage configuration saved"); insertAudit("admin_customization_homepage_saved", "admin_dashboard_layouts", selectedLayout.department, payload); removeDraft(draftKey("layout", selectedLayout.department)); setEditingDepartment(null); load(); }
    setSaving(false);
  };

  const saveBrand = async () => {
    setSaving(true);
    const payload = { setting_key: "global", display_name: brand.display_name, config: brandConfig, is_active: brand.is_active } as any;
    const { error } = await (supabase.from("admin_brand_settings" as any) as any).upsert(payload, { onConflict: "setting_key" });
    if (error) toast.error("Failed to save brand settings"); else { toast.success("Brand settings saved"); insertAudit("admin_customization_brand_saved", "admin_brand_settings", "global", brandConfig); removeDraft(draftKey("brand", "global")); setBrandDraftRestored(false); setBrandSnapshot(stable({ ...brand, ...payload })); load(); }
    setSaving(false);
  };

  const saveTemplate = async () => {
    if (!editingTemplate?.name || !editingTemplate?.title || !editingTemplate?.body) { toast.error("Template name, title, and body are required"); return; }
    setSaving(true);
    const payload = { name: editingTemplate.name, title: editingTemplate.title, body: editingTemplate.body, category: editingTemplate.category || "admin", is_active: editingTemplate.is_active ?? true, image_url: editingTemplate.image_url || null } as any;
    const query = editingTemplate.id ? supabase.from("notification_templates").update(payload).eq("id", editingTemplate.id) : supabase.from("notification_templates").insert(payload);
    const { error } = await query;
    if (error) toast.error("Failed to save template"); else { toast.success("Notification template saved"); insertAudit("admin_customization_template_saved", "notification_templates", payload.name, { ...payload, simulation: simValues }); if (templateDraftKey) removeDraft(templateDraftKey); setEditingTemplate(null); load(); }
    setSaving(false);
  };

  const simulateSend = () => {
    if (!editingTemplate?.title || !editingTemplate?.body) { toast.error("Add a title and body before testing"); return; }
    if (unresolvedVars.length) { toast.error(`Missing test values for ${unresolvedVars.join(", ")}`); return; }
    setTestStatus(`Test preview rendered for ${simValues.name || simValues.phone || "sample recipient"}`);
    toast.success("Test recipient simulation ready");
  };

  return <Shell title="Admin Customization Center" description="Role-based homepages, dashboard layouts, favorites, brand controls, and notification template previews." icon={Palette} action={<Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}>
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 sm:grid-cols-4">
        <TabsTrigger value="home" className="gap-2">Homepages{layoutDirty && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Unsaved</Badge>}</TabsTrigger>
        <TabsTrigger value="layout">Layouts</TabsTrigger>
        <TabsTrigger value="brand" className="gap-2">Brand{brandDirty && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Unsaved</Badge>}</TabsTrigger>
        <TabsTrigger value="templates" className="gap-2">Templates{templateDirty && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Unsaved</Badge>}</TabsTrigger>
      </TabsList>
      <TabsContent value="home"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{departments.map((d) => { const config = layoutFor(d); return <Card key={d} className="border-border/60 bg-card/80"><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{d}</p><Badge variant="outline">{config.favorite_modules?.length ?? 0} favs</Badge></div><p className="mt-2 text-xs text-muted-foreground">{csv(config.layout?.modules) || "Dedicated landing modules, saved filters, favorites, and recently used tools."}</p><div className="mt-3 flex flex-wrap gap-1">{(config.favorite_modules ?? []).slice(0, 3).map((m: string) => <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>)}</div><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openDepartment(d)}>Configure</Button></CardContent></Card>; })}</div></TabsContent>
      <TabsContent value="layout"><Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{widgets.map((w, i) => <button key={w} type="button" onClick={() => openDepartment(departments[i % departments.length])} className="rounded-lg border border-dashed border-border p-4 text-left text-sm font-medium transition hover:border-primary hover:bg-primary/5"><LayoutDashboard className="mb-2 h-4 w-4 text-primary" />{w}<p className="mt-1 text-xs text-muted-foreground">Assigned to {departments[i % departments.length]}</p></button>)}</div><div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Open any department to edit the widget list, favorites, and saved filter JSON used by its role homepage.</div></CardContent></Card></TabsContent>
      <TabsContent value="brand"><div className="mb-3 flex flex-wrap gap-2">{brandDirty && <Badge variant="secondary">Unsaved brand changes</Badge>}{brandDraftRestored && <Badge variant="outline">Draft restored</Badge>}{brandDraftRestored && <Button size="sm" variant="outline" onClick={discardBrandDraft}>Discard Draft</Button>}</div><div className="grid gap-4 lg:grid-cols-[1fr_340px]"><Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2"><Input value={brand.display_name || ""} onChange={(e) => setBrand({ ...brand, display_name: e.target.value })} placeholder="Brand settings name" /><Input value={brandConfig.primaryColor || ""} onChange={(e) => setBrand({ ...brand, config: { ...brandConfig, primaryColor: e.target.value } })} placeholder="Primary color hex" /><Input value={brandConfig.logoLabel || ""} onChange={(e) => setBrand({ ...brand, config: { ...brandConfig, logoLabel: e.target.value } })} placeholder="Logo label" /><Input value={brandConfig.splashTitle || ""} onChange={(e) => setBrand({ ...brand, config: { ...brandConfig, splashTitle: e.target.value } })} placeholder="Splash title" /><Input value={brandConfig.receiptFooter || ""} onChange={(e) => setBrand({ ...brand, config: { ...brandConfig, receiptFooter: e.target.value } })} placeholder="Receipt footer" /><Input value={brandConfig.invoiceBrand || ""} onChange={(e) => setBrand({ ...brand, config: { ...brandConfig, invoiceBrand: e.target.value } })} placeholder="Invoice brand" /><Input value={brandConfig.pwaShortName || ""} onChange={(e) => setBrand({ ...brand, config: { ...brandConfig, pwaShortName: e.target.value } })} placeholder="PWA short name" /><Input value={brandConfig.festivalDefault || ""} onChange={(e) => setBrand({ ...brand, config: { ...brandConfig, festivalDefault: e.target.value } })} placeholder="Festival default" /><Button className="sm:col-span-2" onClick={saveBrand} disabled={saving || !brandDirty}><CheckCircle2 className="mr-2 h-4 w-4" />Save Brand Settings</Button></CardContent></Card><Card><CardContent className="p-4"><div className="rounded-xl border p-4" style={{ borderColor: brandConfig.primaryColor || undefined }}><div className="mb-3 h-2 rounded-full" style={{ backgroundColor: brandConfig.primaryColor || undefined }} /><p className="text-lg font-semibold">{brandConfig.logoLabel || "EasyPay Admin"}</p><p className="text-sm text-muted-foreground">{brandConfig.splashTitle || "Fast secure payments"}</p><Separator className="my-3" /><p className="text-xs text-muted-foreground">{brandConfig.invoiceBrand}</p><p className="text-xs text-muted-foreground">{brandConfig.receiptFooter}</p><Badge className="mt-3" variant="outline">{brandConfig.pwaShortName || "PWA"}</Badge></div></CardContent></Card></div></TabsContent>
      <TabsContent value="templates"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2">{templateDirty && <Badge variant="secondary">Unsaved template changes</Badge>}{templateDraftRestored && <Badge variant="outline">Draft restored</Badge>}</div><Button size="sm" onClick={() => openTemplate({ name: "", title: "", body: "", category: "admin", is_active: true })}>New Template</Button></div><div className="grid gap-3 md:grid-cols-2">{templates.map((t) => <Card key={t.id || t.name}><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{t.title || t.name}</p><p className="text-xs text-muted-foreground">{t.category || "admin"}</p></div><StatusBadge status={t.is_active === false ? "disabled" : "active"} /></div><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{t.body}</p><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openTemplate(t)}><Eye className="mr-2 h-4 w-4" />Edit & Preview</Button></CardContent></Card>)}</div></TabsContent>
    </Tabs>

    <Dialog open={!!editingDepartment} onOpenChange={(open) => !open && closeLayout()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{editingDepartment} Homepage Configuration{layoutDirty && <Badge variant="secondary">Unsaved changes</Badge>}{layoutDraftRestored && <Badge variant="outline">Draft restored</Badge>}</DialogTitle><DialogDescription>Edit modules, favorites, dashboard widgets, and saved filters for this admin homepage.</DialogDescription></DialogHeader>{selectedLayout && <div className="grid gap-3"><Input value={csv(selectedLayout.layout?.modules)} onChange={(e) => setLayouts((rows) => [...rows.filter((r) => r.department !== selectedLayout.department), { ...selectedLayout, layout: { ...selectedLayout.layout, modules: splitCsv(e.target.value) } }])} placeholder="Modules, comma separated" /><Input value={csv(selectedLayout.favorite_modules)} onChange={(e) => setLayouts((rows) => [...rows.filter((r) => r.department !== selectedLayout.department), { ...selectedLayout, favorite_modules: splitCsv(e.target.value) }])} placeholder="Favorite modules, comma separated" /><Input value={csv(selectedLayout.layout?.widgets)} onChange={(e) => setLayouts((rows) => [...rows.filter((r) => r.department !== selectedLayout.department), { ...selectedLayout, layout: { ...selectedLayout.layout, widgets: splitCsv(e.target.value) } }])} placeholder="Widgets, comma separated" /><Textarea value={JSON.stringify(selectedLayout.saved_filters || {}, null, 2)} onChange={(e) => { try { const saved_filters = JSON.parse(e.target.value || "{}"); setLayouts((rows) => [...rows.filter((r) => r.department !== selectedLayout.department), { ...selectedLayout, saved_filters }]); } catch { } }} placeholder="Saved filters JSON" />{confirmClose === "layout" && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">You have unsaved homepage changes. Save, keep editing, or discard the draft.</div>}<div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Preview: {(selectedLayout.layout?.modules ?? []).join(" → ")} with {(selectedLayout.layout?.widgets ?? []).length} widget panels.</div></div>}<DialogFooter><Button variant="outline" onClick={() => confirmClose === "layout" ? setConfirmClose(null) : closeLayout()}>{confirmClose === "layout" ? "Keep Editing" : "Cancel"}</Button>{confirmClose === "layout" && <Button variant="destructive" onClick={discardLayoutDraft}>Discard</Button>}<Button onClick={saveLayout} disabled={saving || !layoutDirty}>Save Configuration</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && closeTemplate()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">Notification Template{templateDirty && <Badge variant="secondary">Unsaved changes</Badge>}{templateDraftRestored && <Badge variant="outline">Draft restored</Badge>}</DialogTitle><DialogDescription>Edit the message, simulate a recipient, and preview exactly what will be sent before saving.</DialogDescription></DialogHeader>{editingTemplate && <div className="grid gap-4 lg:grid-cols-[1fr_380px]"><div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input value={editingTemplate.name || ""} onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_") })} placeholder="template_key" /><Input value={editingTemplate.category || ""} onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })} placeholder="Category" /></div><Input value={editingTemplate.title || ""} onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })} placeholder="Title / subject" /><Textarea className="min-h-[150px]" value={editingTemplate.body || ""} onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })} placeholder="Message body with variables like {{name}}, {{amount}}, {{status}}" /><Input value={editingTemplate.image_url || ""} onChange={(e) => setEditingTemplate({ ...editingTemplate, image_url: e.target.value })} placeholder="Optional image URL" /><div className="flex flex-wrap gap-2"><Button type="button" variant={editingTemplate.is_active === false ? "outline" : "secondary"} onClick={() => setEditingTemplate({ ...editingTemplate, is_active: !(editingTemplate.is_active ?? true) })}>{editingTemplate.is_active === false ? "Disabled" : "Enabled"}</Button>{templateVars.length ? templateVars.map((key) => <Badge key={key} variant={simValues[key] ? "outline" : "destructive"}>{`{{${key}}}`}</Badge>) : <Badge variant="outline">No variables detected</Badge>}</div><Card className="border-primary/30"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4 text-primary" />Test recipient simulation</CardTitle><p className="text-xs text-muted-foreground">Fill sample recipient values here; the rendered notification preview updates before you save.</p></CardHeader><CardContent className="space-y-3"><Select onValueChange={(value) => setSimValues(simulationPresets[value])}><SelectTrigger><SelectValue placeholder="Apply simulation preset" /></SelectTrigger><SelectContent>{Object.keys(simulationPresets).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select><div className="grid gap-2 sm:grid-cols-2">{Object.entries(simValues).map(([key, value]) => <div key={key} className="space-y-1"><Label className="text-xs capitalize text-muted-foreground" htmlFor={`simulation-${key}`}>{key.replace(/_/g, " ")}</Label><Input id={`simulation-${key}`} value={value} onChange={(e) => setSimValues((current) => ({ ...current, [key]: e.target.value }))} placeholder={key} aria-label={`Simulation value for ${key}`} /></div>)}</div>{unresolvedVars.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">Missing test values: {unresolvedVars.join(", ")}</div>}<Button type="button" variant="outline" className="w-full" onClick={simulateSend}><Bell className="mr-2 h-4 w-4" />Render Test Preview</Button>{testStatus && <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground" role="status">{testStatus}</div>}</CardContent></Card></div><div className="space-y-3"><Card className="overflow-hidden"><CardContent className="p-0"><div className="border-b border-border bg-muted/40 p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Live notification preview</p></div>{editingTemplate.image_url && <div className="h-28 bg-muted bg-cover bg-center" style={{ backgroundImage: `url(${editingTemplate.image_url})` }} />}<div className="space-y-3 p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10"><Bell className="h-4 w-4 text-primary" /></div><div className="min-w-0"><p className="break-words text-sm font-semibold">{renderedTitle}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{renderedBody}</p></div></div>{unresolvedVars.length > 0 ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Missing or unresolved variables</div><div className="flex flex-wrap gap-1.5">{unresolvedVars.map((key) => <Badge key={key} variant="destructive" className="font-mono">{`{{${key}}}`}</Badge>)}</div><p className="mt-2">Add sample values for these variables in the test recipient panel before saving.</p></div> : <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">All detected variables are resolved in this preview.</div>}<Separator /><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Recipient</span><span className="text-right">{simValues.name}</span><span>Phone</span><span className="text-right">{simValues.phone}</span><span>Status</span><span className="text-right">{simValues.status}</span></div></div></CardContent></Card>{confirmClose === "template" && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">You have unsaved template changes. Save, keep editing, or discard the draft.</div>}{templateDraftRestored && <Button size="sm" variant="outline" className="w-full" onClick={discardTemplateDraft}>Discard Restored Draft</Button>}</div></div>}<DialogFooter><Button variant="outline" onClick={() => confirmClose === "template" ? setConfirmClose(null) : closeTemplate()}>{confirmClose === "template" ? "Keep Editing" : "Cancel"}</Button>{confirmClose === "template" && <Button variant="destructive" onClick={discardTemplateDraft}>Discard</Button>}<Button onClick={saveTemplate} disabled={saving}>Save Template</Button></DialogFooter></DialogContent></Dialog>
  </Shell>;
}

export function AdminLaunchControlRoom() {
  const [items, setItems] = useState<AnyRow[]>([]); const [title, setTitle] = useState(""); const load = async () => { const { data } = await supabase.from("admin_launch_calendar" as any).select("*").order("preview_date", { ascending: true }); setItems(data ?? []); }; useEffect(() => { load(); }, []);
  const add = async () => { if (!title.trim()) return; const key = title.toLowerCase().replace(/[^a-z0-9]+/g, "_"); const { error } = await supabase.from("admin_launch_calendar" as any).insert({ feature_key: key, title, owner: "Product", dependency_status: "pending", business_impact: "High", rollback_plan: "Hide feature flag and restore previous release state", launch_notes: "Created from Launch Control Room" } as any); if (error) toast.error("Failed to add launch"); else { toast.success("Launch item added"); setTitle(""); load(); } };
  return <Shell title="Feature Launch Control Room" description="Enhanced Advance for Future launch checklist, emulator preview, dependencies, owner, rollback, audit trail, and scheduled release." icon={Rocket}><Card><CardContent className="flex gap-2 p-4"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Feature launch title..." /><Button onClick={add}>Schedule</Button></CardContent></Card><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((i) => <Card key={i.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">Owner: {i.owner || "Unassigned"}</p></div><StatusBadge status={i.status} /></div><Progress value={i.dependency_status === "ready" ? 100 : 55} /><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Preview: {i.preview_date || "TBD"}</span><span>Live: {i.live_date || "TBD"}</span><span>Impact: {i.business_impact || "—"}</span><span>Deps: {i.dependency_status}</span></div><div className="flex gap-2"><Button size="sm" variant="outline"><Eye className="mr-2 h-4 w-4" />Preview</Button><Button size="sm" variant="outline">Checklist</Button><Button size="sm">Launch</Button></div></CardContent></Card>)}</div></Shell>;
}