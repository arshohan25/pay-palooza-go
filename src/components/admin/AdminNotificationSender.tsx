import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Send, Tag, Gift, Megaphone, ShieldCheck, Coins, Users,
  Store, UserCheck, Crown, Truck, Image as ImageIcon, Link2, Copy, CheckCheck,
  RotateCcw, Pencil, Trash2, RefreshCw, Clock, Eye, ChevronDown, ChevronUp,
  Activity, UserX, TrendingUp, TrendingDown, Target, Search, MessageSquare,
  Mail, Filter, MailCheck, MailX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, startOfDay, endOfDay, subDays } from "date-fns";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "notification", entity_id: entityId, details
    });
  }
}
import { formatDistanceToNow, format, startOfDay, endOfDay, subDays } from "date-fns";

const CATEGORIES = [
  { value: "promo", label: "Promotion", icon: Megaphone, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "update", label: "Update", icon: ShieldCheck, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "offer", label: "Offer", icon: Tag, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { value: "coupon", label: "Coupon", icon: Gift, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "cashback", label: "Cashback", icon: Coins, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "system", label: "System", icon: Bell, color: "bg-muted text-muted-foreground" },
];

const ROLES = [
  { value: "all", label: "All Users", icon: Users },
  { value: "customer", label: "Customers", icon: UserCheck },
  { value: "agent", label: "Agents", icon: UserCheck },
  { value: "merchant", label: "Merchants", icon: Store },
  { value: "distributor", label: "Distributors", icon: Truck },
  { value: "super_distributor", label: "Super Distributors", icon: Crown },
];

const AREAS = [
  "All Areas", "Dhaka", "Chittagong", "Khulna", "Rajshahi", "Barishal", "Cumilla",
];

const TARGET_USERS = [
  { value: "", label: "All (No Filter)", icon: Users },
  { value: "high_txn", label: "High Transaction Users", icon: TrendingUp },
  { value: "low_txn", label: "Low Transaction Users", icon: TrendingDown },
  { value: "inactive", label: "Inactive Users", icon: UserX },
  { value: "txn_10+", label: "10+ Transactions", icon: Activity },
  { value: "txn_20+", label: "20+ Transactions", icon: Activity },
  { value: "txn_50+", label: "50+ Transactions", icon: Activity },
  { value: "txn_80+", label: "80+ Transactions", icon: Activity },
  { value: "txn_100+", label: "100+ Transactions", icon: Activity },
];

const FEATURES = [
  { value: "", label: "None" },
  { value: "send-money", label: "Send Money" },
  { value: "cash-out", label: "Cash Out" },
  { value: "add-money", label: "Add Money" },
  { value: "mobile-recharge", label: "Mobile Recharge" },
  { value: "pay-bill", label: "Pay Bill" },
  { value: "payment", label: "Payment" },
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "shop", label: "Shop" },
  { value: "savings", label: "Savings" },
  { value: "merchant-apply", label: "Merchant Application" },
  { value: "scan-pay", label: "Scan & Pay" },
  { value: "kyc", label: "KYC Verification" },
  { value: "/refer", label: "Refer & Earn" },
  { value: "/spending-insights", label: "Spending Insights" },
  { value: "/dynamic-qr", label: "Dynamic QR" },
  { value: "/agent", label: "Agent Dashboard" },
  { value: "/merchant", label: "Merchant Dashboard" },
  { value: "/distributor", label: "Distributor Dashboard" },
  { value: "/admin", label: "Admin Dashboard" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High Priority" },
  { value: "urgent", label: "Urgent" },
];

interface AdminNotif {
  id: string;
  title: string;
  body: string;
  category: string;
  target_roles: string[];
  target_area: string | null;
  target_user: string | null;
  sent_count: number;
  created_at: string;
  metadata: any;
}

type MainTab = "compose" | "notif_logs" | "sms_logs" | "templates";

export default function AdminNotificationSender() {
  const [mainTab, setMainTab] = useState<MainTab>("compose");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("promo");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["all"]);
  const [targetArea, setTargetArea] = useState("All Areas");
  const [targetUser, setTargetUser] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [linkedFeature, setLinkedFeature] = useState("");
  const [priority, setPriority] = useState("normal");
  const [expiresEnabled, setExpiresEnabled] = useState(false);
  const [expiresHours, setExpiresHours] = useState("24");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AdminNotif[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [editNotif, setEditNotif] = useState<AdminNotif | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  // Notification Logs state
  const [notifLogs, setNotifLogs] = useState<any[]>([]);
  const [notifLogsLoading, setNotifLogsLoading] = useState(false);
  const [notifSearch, setNotifSearch] = useState("");
  const [notifFilter, setNotifFilter] = useState("all"); // all | read | unread

  // SMS Logs state
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsLogsLoading, setSmsLogsLoading] = useState(false);
  const [smsFilter, setSmsFilter] = useState("all"); // all | sms | otp | notify
  const [smsTodayCount, setSmsTodayCount] = useState(0);
  const [otpTodayCount, setOtpTodayCount] = useState(0);

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", title: "", body: "", category: "promo", image_url: "" });
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (mainTab === "notif_logs") loadNotifLogs();
    if (mainTab === "sms_logs") loadSmsLogs();
    if (mainTab === "templates") loadTemplates();
  }, [mainTab]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("admin_notifications" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data as any[]) || []);
    setHistoryLoading(false);
  };

  const loadNotifLogs = async () => {
    setNotifLogsLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setNotifLogs(data || []);
    setNotifLogsLoading(false);
  };

  const loadSmsLogs = async () => {
    setSmsLogsLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .or("action.ilike.%sms%,action.ilike.%otp%,action.ilike.%notify%,action.ilike.%notification%")
      .order("created_at", { ascending: false })
      .limit(200);
    setSmsLogs(data || []);
    // Count today's
    const todayStart = startOfDay(new Date()).toISOString();
    const todayLogs = (data || []).filter(l => l.created_at >= todayStart);
    setSmsTodayCount(todayLogs.filter(l => l.action?.toLowerCase().includes("sms") || l.action?.toLowerCase().includes("notify")).length);
    setOtpTodayCount(todayLogs.filter(l => l.action?.toLowerCase().includes("otp")).length);
    setSmsLogsLoading(false);
  };

  const toggleRole = (role: string) => {
    if (role === "all") { setSelectedRoles(["all"]); return; }
    setSelectedRoles((prev) => {
      const without = prev.filter((r) => r !== "all" && r !== role);
      if (prev.includes(role)) return without.length === 0 ? ["all"] : without;
      return [...without, role];
    });
  };

  const buildMetadata = () => {
    const metadata: any = {};
    if (couponCode) metadata.coupon_code = couponCode;
    if (imageUrl) metadata.image_url = imageUrl;
    if (actionUrl) metadata.action_url = actionUrl;
    if (actionLabel) metadata.action_label = actionLabel;
    if (linkedFeature && linkedFeature !== "none") metadata.action_url = linkedFeature;
    if (linkedFeature && linkedFeature !== "none" && !actionLabel)
      metadata.action_label = FEATURES.find(f => f.value === linkedFeature)?.label || "Open";
    if (priority !== "normal") metadata.priority = priority;
    if (expiresEnabled && expiresHours) metadata.expires_hours = parseInt(expiresHours);
    return metadata;
  };

  const sendNotification = async (overrides?: { title?: string; body?: string; category?: string; target_roles?: string[]; target_area?: string | null; target_user?: string | null; metadata?: any }) => {
    const payload = {
      title: (overrides?.title ?? title).trim(),
      body: (overrides?.body ?? body).trim(),
      category: overrides?.category ?? category,
      target_roles: overrides?.target_roles ?? (selectedRoles.includes("all") ? [] : selectedRoles),
      target_area: overrides?.target_area !== undefined ? overrides.target_area : (targetArea === "All Areas" ? null : targetArea.toLowerCase()),
      target_user: overrides?.target_user !== undefined ? overrides.target_user : (targetUser || null),
      metadata: overrides?.metadata ?? buildMetadata(),
    };

    if (!payload.title || !payload.body) { toast.error("Title and body are required"); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-admin-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to send");
    return result;
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await sendNotification();
      toast.success(`Notification sent to ${result.sent_count} users`);
      resetForm();
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setBody(""); setCouponCode(""); setImageUrl("");
    setActionUrl(""); setActionLabel(""); setLinkedFeature("");
    setPriority("normal"); setExpiresEnabled(false); setExpiresHours("24");
    setTargetUser("");
  };

  const handleResend = async (n: AdminNotif) => {
    setResending(n.id);
    try {
      const result = await sendNotification({
        title: n.title, body: n.body, category: n.category,
        target_roles: n.target_roles?.length ? n.target_roles : [],
        target_area: n.target_area, target_user: n.target_user,
        metadata: n.metadata || {},
      });
      toast.success(`Resent to ${result.sent_count} users`);
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Resend failed");
    } finally { setResending(null); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("admin_notifications" as any).delete().eq("id", id);
    if (error) { toast.error("Delete failed"); return; }
    toast.success("Notification deleted");
    setHistory(prev => prev.filter(n => n.id !== id));
    setDeleteConfirm(null);
  };

  const openEdit = (n: AdminNotif) => {
    setEditNotif(n); setEditTitle(n.title); setEditBody(n.body);
  };

  const handleEditSave = async () => {
    if (!editNotif) return;
    const { error } = await supabase.from("admin_notifications" as any)
      .update({ title: editTitle.trim(), body: editBody.trim() }).eq("id", editNotif.id);
    if (error) { toast.error("Update failed"); return; }
    toast.success("Notification updated");
    setHistory(prev => prev.map(n => n.id === editNotif.id ? { ...n, title: editTitle.trim(), body: editBody.trim() } : n));
    setEditNotif(null);
  };

  const handleDuplicate = (n: AdminNotif) => {
    setTitle(n.title); setBody(n.body); setCategory(n.category);
    setSelectedRoles(n.target_roles?.length ? n.target_roles : ["all"]);
    setTargetArea(n.target_area ? n.target_area.charAt(0).toUpperCase() + n.target_area.slice(1) : "All Areas");
    setTargetUser(n.target_user || "");
    const meta = n.metadata || {};
    setCouponCode(meta.coupon_code || ""); setImageUrl(meta.image_url || "");
    setActionUrl(meta.action_url || ""); setActionLabel(meta.action_label || "");
    setPriority(meta.priority || "normal");
    setMainTab("compose");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Notification loaded into compose form");
  };

  // Filtered notification logs
  const filteredNotifLogs = notifLogs.filter(n => {
    if (notifFilter === "read" && !n.read) return false;
    if (notifFilter === "unread" && n.read) return false;
    if (notifSearch && !n.title?.toLowerCase().includes(notifSearch.toLowerCase()) && !n.body?.toLowerCase().includes(notifSearch.toLowerCase())) return false;
    return true;
  });

  const notifReadRate = notifLogs.length > 0 ? Math.round((notifLogs.filter(n => n.read).length / notifLogs.length) * 100) : 0;

  // Filtered SMS logs
  const filteredSmsLogs = smsLogs.filter(l => {
    if (smsFilter === "sms") return l.action?.toLowerCase().includes("sms") || l.action?.toLowerCase().includes("notify");
    if (smsFilter === "otp") return l.action?.toLowerCase().includes("otp");
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={mainTab === "compose" ? "default" : "outline"} size="sm" onClick={() => setMainTab("compose")}>
          <Send className="w-4 h-4 mr-1" /> Compose
        </Button>
        <Button variant={mainTab === "notif_logs" ? "default" : "outline"} size="sm" onClick={() => setMainTab("notif_logs")}>
          <Mail className="w-4 h-4 mr-1" /> Notification Logs
        </Button>
        <Button variant={mainTab === "sms_logs" ? "default" : "outline"} size="sm" onClick={() => setMainTab("sms_logs")}>
          <MessageSquare className="w-4 h-4 mr-1" /> SMS Logs
        </Button>
      </div>

      {/* ═══ COMPOSE TAB ═══ */}
      {mainTab === "compose" && (
        <>
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell size={18} className="text-primary" /> Compose Notification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    const active = category === c.value;
                    return (
                      <button key={c.value} onClick={() => setCategory(c.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          active ? `${c.color} border-current shadow-sm` : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                        }`}>
                        <Icon size={13} /> {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 🎉 Eid Special Cashback!" className="font-semibold" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your notification message..." rows={3} maxLength={500} />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => {
                    const checked = selectedRoles.includes(r.value);
                    const Icon = r.icon;
                    return (
                      <label key={r.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-xs font-medium ${
                          checked ? "bg-primary/10 border-primary/30 text-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                        }`}>
                        <Checkbox checked={checked} onCheckedChange={() => toggleRole(r.value)} className="data-[state=checked]:bg-primary" />
                        <Icon size={13} /> {r.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Area</Label>
                  <Select value={targetArea} onValueChange={setTargetArea}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AREAS.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Target size={12} /> Target User Activity
                  </Label>
                  <Select value={targetUser} onValueChange={setTargetUser}>
                    <SelectTrigger><SelectValue placeholder="All (No Filter)" /></SelectTrigger>
                    <SelectContent>
                      {TARGET_USERS.map((t) => (
                        <SelectItem key={t.value || "none"} value={t.value || "none"}>
                          <span className="flex items-center gap-2"><t.icon size={12} /> {t.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Clock size={12} /> Auto-Expire
                  </Label>
                  <div className="flex items-center gap-2">
                    <Switch checked={expiresEnabled} onCheckedChange={setExpiresEnabled} />
                    {expiresEnabled && (
                      <div className="flex items-center gap-1">
                        <Input type="number" value={expiresHours} onChange={(e) => setExpiresHours(e.target.value)}
                          className="w-16 h-8 text-xs" min={1} max={720} />
                        <span className="text-xs text-muted-foreground">hours</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Optional Extras</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Gift size={12} /> Coupon Code</Label>
                    <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="e.g. EID2026" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><ImageIcon size={12} /> Image URL</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Link2 size={12} /> Link to Feature</Label>
                    <Select value={linkedFeature} onValueChange={setLinkedFeature}>
                      <SelectTrigger><SelectValue placeholder="Select a feature..." /></SelectTrigger>
                      <SelectContent>
                        {FEATURES.map((f) => (
                          <SelectItem key={f.value || "none"} value={f.value || "none"}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Link2 size={12} /> Or Custom URL</Label>
                    <Input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag size={12} /> Action Label</Label>
                    <Input value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder="e.g. Claim Now" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                <div className="text-xs text-muted-foreground">
                  Targeting: <span className="font-semibold text-foreground">{selectedRoles.includes("all") ? "All Users" : selectedRoles.join(", ")}</span>
                  {targetArea !== "All Areas" && <> · <span className="font-semibold text-foreground">{targetArea}</span></>}
                  {targetUser && targetUser !== "none" && <> · <span className="font-semibold text-foreground">{TARGET_USERS.find(t => t.value === targetUser)?.label}</span></>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetForm} className="gap-1 text-xs">
                    <RotateCcw size={12} /> Reset
                  </Button>
                  <Button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()} className="gap-2">
                    <Send size={14} /> {sending ? "Sending..." : "Send Notification"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Sent History</CardTitle>
                <Button variant="ghost" size="sm" onClick={loadHistory} className="gap-1 text-xs h-7">
                  <RefreshCw size={12} /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : history.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No notifications sent yet</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {history.map((n) => {
                      const cat = CATEGORIES.find((c) => c.value === n.category);
                      const isExpanded = expandedId === n.id;
                      const meta = n.metadata as any;
                      return (
                        <motion.div key={n.id} layout
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8, height: 0 }}
                          className="rounded-xl border border-border/60 bg-card overflow-hidden">
                          <div className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedId(isExpanded ? null : n.id)}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat?.color || "bg-muted text-muted-foreground"}`}>
                              {cat ? <cat.icon size={14} /> : <Bell size={14} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.body}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{n.sent_count} sent</Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {n.target_roles?.length ? n.target_roles.join(", ") : "All Users"}
                                </Badge>
                                {n.target_user && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    {TARGET_USERS.find(t => t.value === n.target_user)?.label || n.target_user}
                                  </Badge>
                                )}
                                {n.target_area && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{n.target_area}</Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground/60">
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2">
                                  <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 rounded-lg p-2">
                                    <p><span className="font-semibold text-foreground">Full message:</span> {n.body}</p>
                                    <p><span className="font-semibold">Sent:</span> {format(new Date(n.created_at), "PPp")}</p>
                                    {meta?.coupon_code && <p><span className="font-semibold">Coupon:</span> {meta.coupon_code}</p>}
                                    {meta?.action_url && <p><span className="font-semibold">Link:</span> {meta.action_url}</p>}
                                    {meta?.priority && meta.priority !== "normal" && <p><span className="font-semibold">Priority:</span> {meta.priority}</p>}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={resending === n.id}
                                      onClick={(e) => { e.stopPropagation(); handleResend(n); }}>
                                      <Send size={11} /> {resending === n.id ? "Sending..." : "Resend"}
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                                      onClick={(e) => { e.stopPropagation(); handleDuplicate(n); }}>
                                      <Copy size={11} /> Duplicate
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                                      onClick={(e) => { e.stopPropagation(); openEdit(n); }}>
                                      <Pencil size={11} /> Edit
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(n.id); }}>
                                      <Trash2 size={11} /> Delete
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ NOTIFICATION LOGS TAB ═══ */}
      {mainTab === "notif_logs" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Sent</p><p className="text-xl font-bold text-primary">{notifLogs.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Read</p><p className="text-xl font-bold text-emerald-600">{notifLogs.filter(n => n.read).length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Unread</p><p className="text-xl font-bold text-amber-600">{notifLogs.filter(n => !n.read).length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Read Rate</p><p className="text-xl font-bold text-foreground">{notifReadRate}%</p></CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={notifSearch} onChange={e => setNotifSearch(e.target.value)} placeholder="Search by title..." className="pl-9 h-9" />
            </div>
            <Select value={notifFilter} onValueChange={setNotifFilter}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={loadNotifLogs} className="h-9"><RefreshCw size={14} /></Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {notifLogsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Read</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNotifLogs.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No notification logs found</TableCell></TableRow>
                      ) : filteredNotifLogs.map(n => (
                        <TableRow key={n.id}>
                          <TableCell>
                            <p className="font-medium text-sm text-foreground truncate max-w-[250px]">{n.title}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{n.body}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs capitalize">{n.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {n.read ? (
                              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200"><MailCheck size={11} className="mr-1" /> Read</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200"><MailX size={11} className="mr-1" /> Unread</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(n.created_at), "MMM d, HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ SMS LOGS TAB ═══ */}
      {mainTab === "sms_logs" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Logs</p><p className="text-xl font-bold text-primary">{smsLogs.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">SMS/Notify Today</p><p className="text-xl font-bold text-emerald-600">{smsTodayCount}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">OTP Requests Today</p><p className="text-xl font-bold text-amber-600">{otpTodayCount}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Unique Actions</p><p className="text-xl font-bold text-foreground">{new Set(smsLogs.map(l => l.action)).size}</p></CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={smsFilter} onValueChange={setSmsFilter}>
              <SelectTrigger className="w-[150px] h-9"><Filter className="w-4 h-4 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sms">SMS / Notify</SelectItem>
                <SelectItem value="otp">OTP Only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={loadSmsLogs} className="h-9"><RefreshCw size={14} /></Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {smsLogsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSmsLogs.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No SMS/notification logs found</TableCell></TableRow>
                      ) : filteredSmsLogs.map(l => {
                        const details = l.details as any;
                        return (
                          <TableRow key={l.id}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{l.action}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {l.entity_type && <span className="capitalize">{l.entity_type}</span>}
                              {l.entity_id && <span className="text-xs ml-1 font-mono">({l.entity_id.slice(0, 8)}…)</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {details?.phone && <span>📱 {details.phone} </span>}
                              {details?.status && <Badge variant="outline" className="text-[10px] ml-1">{details.status}</Badge>}
                              {details?.recipient_phone && <span>📱 {details.recipient_phone} </span>}
                              {!details?.phone && !details?.status && !details?.recipient_phone && (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(l.created_at), "MMM d, HH:mm")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editNotif} onOpenChange={(o) => { if (!o) setEditNotif(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Notification</DialogTitle>
            <DialogDescription>Update the title or body of this notification record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} maxLength={500} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditNotif(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={!editTitle.trim() || !editBody.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete Notification?</DialogTitle>
            <DialogDescription>This will remove the notification from history. Already delivered notifications won't be affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
