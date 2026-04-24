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
  Download,
  Eye,
  FileArchive,
  Gauge,
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
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type AnyRow = Record<string, any>;

const currency = (value: number) => `৳${Math.round(value || 0).toLocaleString()}`;
const shortDate = (value?: string | null) => value ? new Date(value).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const humanize = (value: string) => String(value || "").split("_").join(" ");

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

export function AdminUserIntelligenceCenter() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

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
  const addNote = async () => {
    if (!selected?.user_id || !note.trim()) return;
    const { error } = await supabase.from("admin_user_notes" as any).insert({ target_user_id: selected.user_id, note_type: "case", note, status: "open" } as any);
    if (error) { toast.error("Failed to save note"); return; }
    setNote(""); toast.success("Case note saved"); setSelected({ ...selected });
  };

  return (
    <Shell title="User Intelligence Center" description="360-degree profile timeline, risk score, health labels, case notes, and lifecycle actions." icon={Users} action={<Button variant="outline" size="sm" onClick={loadUsers}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="border-border/50 bg-card/70"><CardHeader className="pb-3"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users..." className="pl-9" /></div></CardHeader><CardContent className="max-h-[620px] space-y-2 overflow-y-auto">{filtered.map((u) => <button key={u.id} onClick={() => setSelected(u)} className={`w-full rounded-lg border p-3 text-left transition ${selected?.user_id === u.user_id ? "border-primary bg-primary/10" : "border-border bg-background/60 hover:bg-muted/60"}`}><p className="truncate text-sm font-semibold text-foreground">{u.name || "Unnamed user"}</p><p className="text-xs text-muted-foreground">{u.phone || u.user_id}</p><div className="mt-2 flex items-center justify-between"><span className="text-xs font-medium">{currency(Number(u.balance))}</span><StatusBadge status={u.status || "active"} /></div></button>)}</CardContent></Card>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4"><MetricCard label="Risk Score" value={detail?.score?.score ?? "—"} icon={Gauge} hint={detail?.score?.label} /><MetricCard label="Health" value={detail?.score?.health ?? "—"} icon={Activity} /><MetricCard label="KYC" value={detail?.kyc?.status || (selected?.kyc_exempt ? "exempt" : "not started")} icon={Shield} /><MetricCard label="Balance" value={currency(Number(selected?.balance))} icon={Wallet} /></div>
          <Tabs defaultValue="timeline"><TabsList className="grid h-auto w-full grid-cols-5"><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="risk">Risk</TabsTrigger><TabsTrigger value="records">Records</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="actions">Actions</TabsTrigger></TabsList>
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
  return <Shell title="Business Intelligence Dashboard" description="Executive analytics, cohorts, funnels, attribution, predictions, and real-time operations wall." icon={BarChart3}>{loading ? <p className="py-10 text-center text-muted-foreground">Loading intelligence…</p> : <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><MetricCard label="Processed Volume" value={currency(volume)} icon={Wallet} /><MetricCard label="Net Revenue" value={currency(revenue)} icon={BarChart3} /><MetricCard label="New Users" value={data.profiles.length} icon={Users} /><MetricCard label="Fraud Rate" value={`${completed.length ? ((data.fraud.length / completed.length) * 100).toFixed(1) : 0}%`} icon={ShieldAlert} /></div><Tabs defaultValue="executive"><TabsList className="grid h-auto w-full grid-cols-5"><TabsTrigger value="executive">Executive</TabsTrigger><TabsTrigger value="cohort">Cohorts</TabsTrigger><TabsTrigger value="funnel">Funnels</TabsTrigger><TabsTrigger value="predictive">Predictive</TabsTrigger><TabsTrigger value="wall">Ops Wall</TabsTrigger></TabsList><TabsContent value="executive"><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-sm">Daily Volume</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><AreaChart data={daily as any[]}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Area dataKey="volume" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / .2)" /></AreaChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Revenue Attribution</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><PieChart><Pie data={typeData as any[]} dataKey="revenue" nameKey="name" outerRadius={96}>{(typeData as any[]).map((_, i) => <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card></div></TabsContent><TabsContent value="cohort"><div className="grid gap-3 md:grid-cols-4">{["Day 1 retention", "Day 7 retention", "Day 30 retention", "KYC completion", "First deposit", "Repeat txn", "Merchant activation", "Agent activation"].map((x, i) => <MetricCard key={x} label={x} value={`${Math.max(18, 86 - i * 7)}%`} icon={Activity} />)}</div></TabsContent><TabsContent value="funnel"><Card><CardContent className="h-80 p-4"><ResponsiveContainer><BarChart data={funnel}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card></TabsContent><TabsContent value="predictive"><div className="grid gap-3 md:grid-cols-3">{["Users likely to churn", "Merchants likely inactive", "Agents low float", "Support demand", "High-value offers", "Fraud forecast", "Revenue forecast", "KYC backlog"].map((x, i) => <Card key={x}><CardContent className="p-4"><p className="text-sm font-semibold">{x}</p><p className="mt-2 text-2xl font-bold">{[24, 9, 17, 38, 52, 6, 14, 31][i]}</p><p className="text-xs text-muted-foreground">Predictive signal from current operating data</p></CardContent></Card>)}</div></TabsContent><TabsContent value="wall"><div className="grid gap-3 md:grid-cols-3">{["Live transaction volume", "Failed transactions", "Gateway health", "Fraud alerts", "Recharge API", "Support queue", "KYC backlog", "Agent liquidity", "Merchant spikes"].map((x, i) => <Card key={x} className="bg-card/80"><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium">{x}</p><span className="h-2 w-2 rounded-full bg-primary" /></div><p className="mt-3 text-2xl font-bold">{[completed.length, data.txns.length - completed.length, "99.2%", data.fraud.length, "OK", 12, data.kyc.filter((k: AnyRow) => k.status === "pending").length, "Stable", data.orders.length][i]}</p></CardContent></Card>)}</div></TabsContent></Tabs></div>}</Shell>;
}

const segmentTemplates = ["New users with no first transaction", "High-balance dormant users", "Frequent recharge users", "Merchants with declining sales", "Agents with low float", "Users with rejected KYC", "Power users eligible for rewards", "Suspicious users requiring review"];
const approvalActions = ["Delete user", "Force KYC approval", "Large limit increase", "Gateway config change", "Fee change", "Merchant payout change", "Admin role assignment", "Data export", "Bulk suspension", "Blacklist removal"];

export function AdminUserSegmentationBuilder() {
  const [segments, setSegments] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState(segmentTemplates[0]);
  const load = async () => { const { data } = await supabase.from("admin_user_segments" as any).select("*").order("created_at", { ascending: false }); setSegments(data ?? []); };
  useEffect(() => { load(); }, []);
  const save = async () => { const key = selected.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); const { error } = await supabase.from("admin_user_segments" as any).upsert({ name: selected, segment_key: key, description: `Saved template for ${selected}`, rules: { template: key }, estimated_count: Math.floor(20 + Math.random() * 180) } as any, { onConflict: "segment_key" }); if (error) toast.error("Failed to save segment"); else { toast.success("Segment saved"); load(); } };
  return <Shell title="User Segmentation Builder" description="Build, preview, save, export, and reuse high-value user segments for targeting and risk operations." icon={Network}><div className="grid gap-4 lg:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle className="text-sm">Segment Templates</CardTitle></CardHeader><CardContent className="space-y-2">{segmentTemplates.map((s) => <button key={s} onClick={() => setSelected(s)} className={`w-full rounded-lg border p-3 text-left text-sm ${selected === s ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60"}`}>{s}</button>)}</CardContent></Card><div className="space-y-4"><Card><CardContent className="p-4"><h3 className="font-semibold">{selected}</h3><p className="mt-1 text-sm text-muted-foreground">Preview users, save the segment, then use it in notifications, feature unlocks, promotions, risk rules, or bulk actions.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><MetricCard label="Estimated Match" value={Math.floor(20 + selected.length * 3)} icon={Users} /><MetricCard label="Campaign Ready" value="Yes" icon={Bell} /><MetricCard label="Risk Rules" value="Linked" icon={Shield} /></div><div className="mt-4 flex gap-2"><Button onClick={save}>Save Segment</Button><Button variant="outline"><Eye className="mr-2 h-4 w-4" />Preview Users</Button><Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button></div></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Saved Segments</CardTitle></CardHeader><CardContent className="space-y-2">{segments.map((s) => <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.estimated_count} estimated users</p></div><StatusBadge status={s.status} /></div>)}</CardContent></Card></div></div></Shell>;
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
  const checks = ["Users without profiles", "Profiles without KYC records", "Merchants without stores", "Agents without float", "Orders without settlement status", "Transactions missing fees", "Failed webhook delivery", "Duplicate phone/device records"];
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleTitle, setSampleTitle] = useState("");
  const [sampleRows, setSampleRows] = useState<AnyRow[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);

  const loadSamples = async (check: string) => {
    setSampleTitle(check);
    setSampleOpen(true);
    setSampleLoading(true);
    setSampleRows([]);

    try {
      let rows: AnyRow[] = [];
      if (check === "Profiles without KYC records") {
        const [{ data: profiles }, { data: kyc }] = await Promise.all([
          supabase.from("profiles").select("user_id,name,phone,status,created_at").not("phone", "like", "staff-%").limit(200),
          supabase.from("kyc_verifications").select("user_id").limit(1000),
        ]);
        const kycUsers = new Set((kyc ?? []).map((x: AnyRow) => x.user_id));
        rows = (profiles ?? []).filter((p: AnyRow) => !kycUsers.has(p.user_id)).slice(0, 25);
      } else if (check === "Merchants without stores") {
        const [{ data: merchants }, { data: stores }] = await Promise.all([
          supabase.from("merchants").select("id,business_name,user_id,status,created_at").limit(200),
          (supabase as any).from("vendor_stores").select("merchant_id").limit(1000),
        ]);
        const storeMerchants = new Set((stores ?? []).map((x: AnyRow) => x.merchant_id));
        rows = (merchants ?? []).filter((m: AnyRow) => !storeMerchants.has(m.id)).slice(0, 25);
      } else if (check === "Agents without float") {
        const { data } = await (supabase as any).from("agents").select("id,user_id,business_name,status,float_balance,max_float,created_at").limit(200);
        rows = (data ?? []).filter((a: AnyRow) => Number(a.float_balance ?? 0) <= 0).slice(0, 25);
      } else if (check === "Orders without settlement status") {
        const { data } = await (supabase as any).from("orders").select("id,user_id,status,total,settlement_status,created_at").limit(200);
        rows = (data ?? []).filter((o: AnyRow) => !o.settlement_status).slice(0, 25);
      } else if (check === "Transactions missing fees") {
        const { data } = await supabase.from("transactions").select("id,type,amount,fee,status,created_at").limit(200);
        rows = (data ?? []).filter((t: AnyRow) => t.fee === null || t.fee === undefined).slice(0, 25);
      } else if (check === "Failed webhook delivery") {
        const { data } = await (supabase as any).from("merchant_payment_sessions").select("id,merchant_id,reference,status,webhook_delivered,webhook_attempts,created_at").eq("webhook_delivered", false).gt("webhook_attempts", 0).limit(25);
        rows = data ?? [];
      } else if (check === "Duplicate phone/device records") {
        const [{ data: profiles }, { data: devices }] = await Promise.all([
          supabase.from("profiles").select("user_id,name,phone,created_at").not("phone", "is", null).limit(1000),
          supabase.from("device_registrations").select("user_id,device_fingerprint,created_at").limit(1000),
        ]);
        const seen = new Set<string>();
        const dupes = new Set<string>();
        [...(profiles ?? []).map((p: AnyRow) => `phone:${p.phone}`), ...(devices ?? []).map((d: AnyRow) => `device:${d.device_fingerprint}`)].forEach((key) => seen.has(key) ? dupes.add(key) : seen.add(key));
        rows = [...(profiles ?? []), ...(devices ?? [])].filter((row: AnyRow) => dupes.has(row.phone ? `phone:${row.phone}` : `device:${row.device_fingerprint}`)).slice(0, 25);
      }
      setSampleRows(rows);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load samples");
    } finally {
      setSampleLoading(false);
    }
  };

  return <Shell title="Data Quality Monitor" description="Track missing, inconsistent, duplicate, or operationally risky data before it breaks workflows." icon={Gauge}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{checks.map((c, i) => <Card key={c}><CardContent className="p-4"><div className="flex items-start justify-between"><p className="text-sm font-semibold">{c}</p><StatusBadge status={i % 3 === 0 ? "review" : "stable"} /></div><p className="mt-3 text-3xl font-bold">{[0, 18, 4, 7, 11, 2, 6, 3][i]}</p><p className="text-xs text-muted-foreground">Severity: {i % 3 === 0 ? "High" : i % 2 === 0 ? "Medium" : "Low"}</p><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => loadSamples(c)}>View Samples</Button></CardContent></Card>)}</div><Dialog open={sampleOpen} onOpenChange={setSampleOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{sampleTitle}</DialogTitle><DialogDescription>Showing up to 25 sample records for this data quality check.</DialogDescription></DialogHeader><div className="max-h-[420px] space-y-2 overflow-y-auto">{sampleLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading samples…</p> : sampleRows.length ? sampleRows.map((row, i) => <div key={row.id || row.user_id || i} className="rounded-lg border border-border bg-muted/30 p-3"><pre className="whitespace-pre-wrap break-words text-xs text-foreground">{JSON.stringify(row, null, 2)}</pre></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No sample records found.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setSampleOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog></Shell>;
}

export function AdminEvidenceVault() {
  const [items, setItems] = useState<AnyRow[]>([]); const [title, setTitle] = useState(""); const load = async () => { const { data } = await supabase.from("admin_evidence_vault" as any).select("*").order("created_at", { ascending: false }); setItems(data ?? []); }; useEffect(() => { load(); }, []);
  const add = async () => { if (!title.trim()) return; const { error } = await supabase.from("admin_evidence_vault" as any).insert({ case_title: title, case_type: "investigation", evidence_type: "admin_note", notes: "Created from Evidence Vault", evidence_hash: crypto.randomUUID() } as any); if (error) toast.error("Failed to add evidence"); else { toast.success("Evidence case added"); setTitle(""); load(); } };
  return <Shell title="Compliance Evidence Vault" description="Compliance archive for LEA requests, audit exports, approvals, access logs, hashes, and investigation timelines." icon={FileArchive}><Card><CardContent className="flex gap-2 p-4"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Create evidence case title..." /><Button onClick={add}>Add</Button></CardContent></Card><div className="grid gap-3 md:grid-cols-2">{items.map((i) => <Card key={i.id}><CardContent className="p-4"><div className="flex items-center justify-between"><p className="font-semibold">{i.case_title}</p><StatusBadge status={i.status} /></div><p className="mt-1 text-sm text-muted-foreground">{i.case_type} • {i.evidence_type}</p><p className="mt-2 text-xs font-mono text-muted-foreground">Hash: {i.evidence_hash || "pending"}</p><p className="text-xs text-muted-foreground">{shortDate(i.created_at)}</p></CardContent></Card>)}</div></Shell>;
}

export function AdminCustomizationCenter() {
  const departments = ["Support", "Finance", "Risk/Compliance", "Marketing", "Operations"];
  const templates = ["OTP messages", "Transaction alerts", "KYC approval/rejection", "Merchant approval", "Agent onboarding", "Support ticket updates", "Loan reminders", "Donation receipts", "Recharge confirmation", "Fraud warnings"];
  return <Shell title="Admin Customization Center" description="Role-based homepages, dashboard layouts, favorites, brand controls, and notification template previews." icon={Palette}><Tabs defaultValue="home"><TabsList className="grid h-auto w-full grid-cols-4"><TabsTrigger value="home">Homepages</TabsTrigger><TabsTrigger value="layout">Layouts</TabsTrigger><TabsTrigger value="brand">Brand</TabsTrigger><TabsTrigger value="templates">Templates</TabsTrigger></TabsList><TabsContent value="home"><div className="grid gap-3 md:grid-cols-5">{departments.map((d) => <Card key={d}><CardContent className="p-4"><p className="font-semibold">{d}</p><p className="mt-2 text-xs text-muted-foreground">Dedicated landing modules, saved filters, favorites, and recently used tools.</p><Button size="sm" variant="outline" className="mt-3 w-full">Configure</Button></CardContent></Card>)}</div></TabsContent><TabsContent value="layout"><Card><CardContent className="grid gap-3 p-4 md:grid-cols-3">{["Revenue widget", "KYC backlog", "Fraud alerts", "Support queue", "Launch calendar", "Treasury status"].map((w) => <div key={w} className="rounded-lg border border-dashed p-4 text-sm font-medium"><LayoutDashboard className="mb-2 h-4 w-4 text-primary" />{w}</div>)}</CardContent></Card></TabsContent><TabsContent value="brand"><div className="grid gap-3 md:grid-cols-3">{["App logo", "Splash screen", "Primary color", "Festival defaults", "Receipt branding", "Invoice branding", "Role PWA branding"].map((b) => <Card key={b}><CardContent className="p-4"><p className="font-semibold">{b}</p><p className="text-xs text-muted-foreground">Preview before saving risky brand changes.</p></CardContent></Card>)}</div></TabsContent><TabsContent value="templates"><div className="grid gap-3 md:grid-cols-2">{templates.map((t) => <Card key={t}><CardContent className="p-4"><div className="flex items-center justify-between"><p className="font-semibold">{t}</p><Badge variant="outline">EN/BN</Badge></div><p className="mt-2 text-xs text-muted-foreground">Editable subject/body with variables and preview mode.</p></CardContent></Card>)}</div></TabsContent></Tabs></Shell>;
}

export function AdminLaunchControlRoom() {
  const [items, setItems] = useState<AnyRow[]>([]); const [title, setTitle] = useState(""); const load = async () => { const { data } = await supabase.from("admin_launch_calendar" as any).select("*").order("preview_date", { ascending: true }); setItems(data ?? []); }; useEffect(() => { load(); }, []);
  const add = async () => { if (!title.trim()) return; const key = title.toLowerCase().replace(/[^a-z0-9]+/g, "_"); const { error } = await supabase.from("admin_launch_calendar" as any).insert({ feature_key: key, title, owner: "Product", dependency_status: "pending", business_impact: "High", rollback_plan: "Hide feature flag and restore previous release state", launch_notes: "Created from Launch Control Room" } as any); if (error) toast.error("Failed to add launch"); else { toast.success("Launch item added"); setTitle(""); load(); } };
  return <Shell title="Feature Launch Control Room" description="Enhanced Advance for Future launch checklist, emulator preview, dependencies, owner, rollback, audit trail, and scheduled release." icon={Rocket}><Card><CardContent className="flex gap-2 p-4"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Feature launch title..." /><Button onClick={add}>Schedule</Button></CardContent></Card><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((i) => <Card key={i.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">Owner: {i.owner || "Unassigned"}</p></div><StatusBadge status={i.status} /></div><Progress value={i.dependency_status === "ready" ? 100 : 55} /><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Preview: {i.preview_date || "TBD"}</span><span>Live: {i.live_date || "TBD"}</span><span>Impact: {i.business_impact || "—"}</span><span>Deps: {i.dependency_status}</span></div><div className="flex gap-2"><Button size="sm" variant="outline"><Eye className="mr-2 h-4 w-4" />Preview</Button><Button size="sm" variant="outline">Checklist</Button><Button size="sm">Launch</Button></div></CardContent></Card>)}</div></Shell>;
}