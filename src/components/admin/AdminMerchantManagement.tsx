import React, { useState, useEffect, useCallback } from "react";
import AdminApiRequests from "./AdminApiRequests";
import AdminMerchantApplications from "./AdminMerchantApplications";
import MerchantApplyTargeting from "./MerchantApplyTargeting";
import { motion } from "framer-motion";
import {
  Store, Search, Download, Eye, Lock, CheckCircle, XCircle, TrendingUp,
  CreditCard, Settings, Key, BarChart3, FileText, ExternalLink, Trash2,
  Filter, ChevronDown, Edit2, Save, X, RefreshCw, Globe, Ban, Shield,
  Plus, Copy, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

type MerchantStatus = "pending" | "active" | "suspended";
type MerchantCategory = string;

interface MerchantDetail {
  merchant: any;
  ownerProfile: any;
  apiKeys: any[];
  apiRequests: any[];
  sessions: any[];
  transactions: any[];
}

import { useMerchantCategories } from "@/hooks/use-merchant-categories";

const SETTLEMENT_OPTIONS = ["T+0", "T+1", "T+2", "T+3"];

// ─── Helpers ───
async function fetchMerchantDetail(merchantId: string, userId: string): Promise<MerchantDetail> {
  const [merchantRes, profileRes, keysRes, reqRes, sessionsRes, txnRes] = await Promise.all([
    supabase.from("merchants").select("*").eq("id", merchantId).maybeSingle(),
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("merchant_api_keys").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
    (supabase as any).from("merchant_api_requests").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
    supabase.from("merchant_payment_sessions").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(50),
    supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  // Audit
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "view_merchant_detail",
      entity_type: "merchant",
      entity_id: merchantId,
      details: { business_name: merchantRes.data?.business_name },
    }).then();
  }
  return {
    merchant: merchantRes.data,
    ownerProfile: profileRes.data,
    apiKeys: keysRes.data ?? [],
    apiRequests: reqRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    transactions: txnRes.data ?? [],
  };
}

function exportMerchantsCSV(merchants: any[]) {
  const headers = ["Business Name", "Category", "Status", "MDR Rate", "Settlement", "Bank", "Created At"];
  const rows = merchants.map(m => [
    m.business_name, m.category, m.status, m.mdr_rate,
    m.settlement_frequency, m.bank_name || "", m.created_at,
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.map((v: any) => `"${v}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `merchants-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminMerchantManagement() {
  const { categories: dbCategories, addCategory, getLabelForName } = useMerchantCategories();
  const [mainTab, setMainTab] = useState<"merchants" | "api-requests" | "applications" | "targeting">("merchants");
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Detail sheet
  const [detailMerchant, setDetailMerchant] = useState<any>(null);
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("profile");

  // Approval dialog
  const [approvalTarget, setApprovalTarget] = useState<any>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");

  // Inline edit for MDR / settlement
  const [editingMdr, setEditingMdr] = useState<{ id: string; mdr: string; settlement: string } | null>(null);
  const [savingMdr, setSavingMdr] = useState(false);

  // Analytics
  const [analyticsRange, setAnalyticsRange] = useState<"7" | "30" | "90">("30");

  // API key generation
  const [showNewSecret, setShowNewSecret] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Create Merchant dialog
  const [showCreateMerchant, setShowCreateMerchant] = useState(false);
  const [createForm, setCreateForm] = useState({ phone: "", business_name: "", trade_license: "", category: "retail", bank_name: "", bank_account_number: "", bank_routing: "" });
  const [createLoading, setCreateLoading] = useState(false);

  const loadMerchants = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("merchants").select("*").order("created_at", { ascending: false }).limit(200);
    setMerchants(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadMerchants(); }, [loadMerchants]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("admin-merchant-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, () => loadMerchants())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadMerchants]);

  const filtered = merchants.filter(m => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.business_name?.toLowerCase().includes(q) || m.category?.includes(q) || m.id?.includes(q);
    }
    return true;
  });

  const pendingCount = merchants.filter(m => m.status === "pending").length;
  const activeCount = merchants.filter(m => m.status === "active").length;

  // ─── Detail Sheet ───
  const openDetail = async (m: any) => {
    setDetailMerchant(m);
    setDetailLoading(true);
    setDetailTab("profile");
    try {
      const d = await fetchMerchantDetail(m.id, m.user_id);
      setDetail(d);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  // ─── Approval ───
  const handleApproval = async () => {
    if (!approvalTarget) return;
    const newStatus = approvalAction === "approve" ? "active" : "suspended";
    const { error } = await supabase.from("merchants")
      .update({ status: newStatus as any, ...(approvalAction === "approve" ? { updated_at: new Date().toISOString() } : {}) })
      .eq("id", approvalTarget.id);
    if (error) { toast.error("Failed to update merchant"); return; }
    // Notify merchant
    await supabase.from("notifications").insert({
      user_id: approvalTarget.user_id,
      title: approvalAction === "approve" ? "Merchant Account Approved" : "Merchant Application Rejected",
      body: approvalAction === "approve"
        ? "Your merchant account has been approved. You can now accept payments."
        : `Your merchant application was rejected. ${approvalNotes ? `Reason: ${approvalNotes}` : ""}`,
      category: "merchant",
    });
    // Audit
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: `merchant_${approvalAction}`,
        entity_type: "merchant",
        entity_id: approvalTarget.id,
        details: { business_name: approvalTarget.business_name, notes: approvalNotes },
      }).then();
    }
    toast.success(`Merchant ${approvalAction === "approve" ? "approved" : "rejected"}`);
    setApprovalTarget(null);
    setApprovalNotes("");
    loadMerchants();
  };

  // ─── Status toggle ───
  const toggleStatus = async (m: any) => {
    const newStatus = m.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("merchants").update({ status: newStatus as any }).eq("id", m.id);
    if (error) { toast.error("Failed"); return; }
    toast.success(`Merchant ${newStatus}`);
    loadMerchants();
  };

  // ─── MDR save ───
  const saveMdr = async () => {
    if (!editingMdr) return;
    setSavingMdr(true);
    const { error } = await supabase.from("merchants")
      .update({ mdr_rate: parseFloat(editingMdr.mdr), settlement_frequency: editingMdr.settlement } as any)
      .eq("id", editingMdr.id);
    if (error) { toast.error("Failed to update"); }
    else {
      toast.success("MDR & settlement updated");
      if (detail?.merchant?.id === editingMdr.id) {
        setDetail(prev => prev ? { ...prev, merchant: { ...prev.merchant, mdr_rate: parseFloat(editingMdr.mdr), settlement_frequency: editingMdr.settlement } } : prev);
      }
    }
    setSavingMdr(false);
    setEditingMdr(null);
    loadMerchants();
  };

  // ─── Bulk actions ───
  const bulkApprove = async () => {
    setBulkLoading(true);
    const pending = merchants.filter(m => selectedIds.has(m.id) && m.status === "pending");
    for (const m of pending) {
      await supabase.from("merchants").update({ status: "active" as any }).eq("id", m.id);
      await supabase.from("notifications").insert({
        user_id: m.user_id, title: "Merchant Account Approved",
        body: "Your merchant account has been approved.", category: "merchant",
      });
    }
    toast.success(`Approved ${pending.length} merchants`);
    setSelectedIds(new Set());
    setBulkLoading(false);
    loadMerchants();
  };

  const bulkSuspend = async () => {
    setBulkLoading(true);
    const targets = merchants.filter(m => selectedIds.has(m.id));
    for (const m of targets) {
      const ns = m.status === "suspended" ? "active" : "suspended";
      await supabase.from("merchants").update({ status: ns as any }).eq("id", m.id);
    }
    toast.success(`Toggled ${targets.length} merchants`);
    setSelectedIds(new Set());
    setBulkLoading(false);
    loadMerchants();
  };

  // ─── Revoke API key ───
  const revokeApiKey = async (keyId: string) => {
    const { error } = await supabase.from("merchant_api_keys").update({ is_active: false }).eq("id", keyId);
    if (error) { toast.error("Failed"); return; }
    toast.success("API key revoked");
    if (detail) {
      setDetail({ ...detail, apiKeys: detail.apiKeys.map(k => k.id === keyId ? { ...k, is_active: false } : k) });
    }
  };

  // ─── Generate API key for merchant ───
  const generateApiKey = async (merchantId: string) => {
    const apiKey = "epk_" + crypto.randomUUID().replace(/-/g, "");
    const secretKey = "eps_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const appPassword = "epp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const { error } = await supabase.from("merchant_api_keys").insert({ merchant_id: merchantId, api_key: apiKey, secret_key: secretKey, app_password: appPassword } as any).select().single();
    if (error) { toast.error("Failed to generate key: " + error.message); return; }
    setShowNewSecret(secretKey);
    toast.success("API key generated");
    if (detailMerchant) {
      const d = await fetchMerchantDetail(detailMerchant.id, detailMerchant.user_id);
      setDetail(d);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ─── Create Merchant directly ───
  const handleCreateMerchant = async () => {
    if (!createForm.phone.trim() || !createForm.business_name.trim()) {
      toast.error("Phone and business name are required");
      return;
    }
    setCreateLoading(true);
    try {
      // Find user by phone
      const { data: profile } = await supabase.from("profiles").select("user_id, phone").eq("phone", createForm.phone.trim()).maybeSingle();
      if (!profile) { toast.error("No user found with that phone number"); setCreateLoading(false); return; }

      // Check if already a merchant
      const { data: existingMerchant } = await supabase.from("merchants").select("id").eq("user_id", profile.user_id).maybeSingle();
      if (existingMerchant) { toast.error("This user is already a merchant"); setCreateLoading(false); return; }

      // Create merchant
      const { error: mErr } = await supabase.from("merchants").insert({
        user_id: profile.user_id,
        business_name: createForm.business_name.trim(),
        trade_license: createForm.trade_license.trim() || null,
        category: createForm.category as any,
        status: "active" as any,
        bank_name: createForm.bank_name || null,
        bank_account_number: createForm.bank_account_number || null,
        bank_routing: createForm.bank_routing || null,
      });
      if (mErr) { toast.error("Failed to create merchant: " + mErr.message); setCreateLoading(false); return; }

      // Assign merchant role
      await (supabase as any).from("user_roles").insert({ user_id: profile.user_id, role: "merchant" });

      // Notify user
      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        title: "Merchant Account Created",
        body: `Your merchant account "${createForm.business_name}" has been created and is active.`,
        category: "merchant",
      });

      toast.success("Merchant created successfully");
      setShowCreateMerchant(false);
      setCreateForm({ phone: "", business_name: "", trade_license: "", category: "retail", bank_name: "", bank_account_number: "", bank_routing: "" });
      loadMerchants();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Unknown"));
    }
    setCreateLoading(false);
  };

  // ─── Approve/Reject API request ───
  const handleApiRequest = async (requestId: string, action: "approved" | "rejected", notes?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await (supabase as any).from("merchant_api_requests").update({
      status: action,
      admin_notes: notes || null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);
    toast.success(`Request ${action}`);
    if (detailMerchant) {
      const d = await fetchMerchantDetail(detailMerchant.id, detailMerchant.user_id);
      setDetail(d);
    }
  };

  const computeAnalytics = () => {
    if (!detail) return { summary: { total: 0, completed: 0, revenue: 0, successRate: 0 }, daily: [] as any[] };
    const days = parseInt(analyticsRange);
    const cutoff = new Date(Date.now() - days * 86400000);
    const sessions = detail.sessions.filter(s => new Date(s.created_at) >= cutoff);
    const completed = sessions.filter(s => s.status === "completed");
    const revenue = completed.reduce((s, x) => s + Number(x.amount || 0), 0);
    const successRate = sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0;

    // Daily grouping
    const dayMap: Record<string, { date: string; completed: number; failed: number; expired: number; pending: number; revenue: number }> = {};
    sessions.forEach(s => {
      const day = new Date(s.created_at).toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { date: day, completed: 0, failed: 0, expired: 0, pending: 0, revenue: 0 };
      const statusKey = s.status as string;
      if (statusKey in dayMap[day]) {
        (dayMap[day] as any)[statusKey] = ((dayMap[day] as any)[statusKey] || 0) + 1;
      }
      if (s.status === "completed") dayMap[day].revenue += Number(s.amount || 0);
    });
    const daily = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    return { summary: { total: sessions.length, completed: completed.length, revenue, successRate }, daily };
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge
      variant={status === "suspended" ? "destructive" : status === "active" ? "secondary" : "outline"}
      className={`text-xs ${status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300" : ""}`}
    >
      {status}
    </Badge>
  );

  return (
    <div className="space-y-4">
      {/* Top-level sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={mainTab === "merchants" ? "default" : "outline"} size="sm" onClick={() => setMainTab("merchants")}>
          <Store className="w-4 h-4 mr-1" /> Merchants
        </Button>
        <Button variant={mainTab === "api-requests" ? "default" : "outline"} size="sm" onClick={() => setMainTab("api-requests")}>
          <Key className="w-4 h-4 mr-1" /> API Requests
        </Button>
        <Button variant={mainTab === "applications" ? "default" : "outline"} size="sm" onClick={() => setMainTab("applications")}>
          <FileText className="w-4 h-4 mr-1" /> Applications
        </Button>
        <Button variant={mainTab === "targeting" ? "default" : "outline"} size="sm" onClick={() => setMainTab("targeting")}>
          <Filter className="w-4 h-4 mr-1" /> Targeting
        </Button>
      </div>

      {mainTab === "api-requests" && <AdminApiRequests />}
      {mainTab === "applications" && <AdminMerchantApplications />}
      {mainTab === "targeting" && <MerchantApplyTargeting />}

      {mainTab === "merchants" && <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-foreground">{merchants.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold text-foreground">{activeCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold text-foreground">{pendingCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
              <Ban className="w-5 h-5 text-primary-foreground" />
            </div>
            <div><p className="text-xs text-muted-foreground">Suspended</p><p className="text-xl font-bold text-foreground">{merchants.filter(m => m.status === "suspended").length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search merchants…" className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {dbCategories.map(c => <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => exportMerchantsCSV(filtered)} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button size="sm" onClick={() => setShowCreateMerchant(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Create Merchant
            </Button>
            <Button variant="outline" size="icon" onClick={loadMerchants} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
              <Button size="sm" variant="default" className="text-xs h-7" onClick={bulkApprove} disabled={bulkLoading}>
                <CheckCircle className="w-3 h-3 mr-1" /> Bulk Approve
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={bulkSuspend} disabled={bulkLoading}>
                Bulk Suspend/Activate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merchant Table */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 w-8">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={() => {
                        if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filtered.map(m => m.id)));
                      }}
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Business Name</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">MDR</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Settlement</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Created</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={() => {
                          setSelectedIds(prev => {
                            const n = new Set(prev);
                            n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{m.business_name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{getLabelForName(m.category)}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{(Number(m.mdr_rate) * 100).toFixed(2)}%</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{m.settlement_frequency}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {new Date(m.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => openDetail(m)}>
                          <Eye className="w-3 h-3" /> View
                        </Button>
                        {m.status === "pending" && (
                          <Button size="sm" variant="default" className="text-xs h-7 gap-1" onClick={() => { setApprovalTarget(m); setApprovalAction("approve"); }}>
                            <CheckCircle className="w-3 h-3" /> Review
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={m.status === "suspended" ? "default" : "destructive"}
                          className="text-xs h-7"
                          onClick={() => toggleStatus(m)}
                        >
                          {m.status === "suspended" ? "Activate" : "Suspend"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <Store className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No merchants found</p>
              <p className="text-xs text-muted-foreground mt-1">Adjust filters or wait for registrations</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Approval Dialog ═══ */}
      <AlertDialog open={!!approvalTarget} onOpenChange={v => { if (!v) setApprovalTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review Merchant: {approvalTarget?.business_name}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><span className="text-muted-foreground">Category:</span> <span className="capitalize font-medium">{approvalTarget?.category}</span></div>
                <div><span className="text-muted-foreground">MDR:</span> <span className="font-medium">{approvalTarget ? (Number(approvalTarget.mdr_rate) * 100).toFixed(2) : 0}%</span></div>
                {approvalTarget?.trade_license && <div className="col-span-2"><span className="text-muted-foreground">Trade License:</span> <span className="font-mono text-xs">{approvalTarget.trade_license}</span></div>}
                {approvalTarget?.bank_name && <div className="col-span-2"><span className="text-muted-foreground">Bank:</span> {approvalTarget.bank_name} - {approvalTarget.bank_account_number}</div>}
              </div>
              <Input
                placeholder="Notes (optional)"
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                className="mt-3"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => { setApprovalAction("reject"); handleApproval(); }}>
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
            <AlertDialogAction onClick={() => { setApprovalAction("approve"); handleApproval(); }} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="w-4 h-4 mr-1" /> Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Merchant Detail Sheet ═══ */}
      <Sheet open={!!detailMerchant} onOpenChange={v => { if (!v) { setDetailMerchant(null); setDetail(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-2 shrink-0">
            <SheetTitle className="text-lg">{detailMerchant?.business_name || "Merchant Details"}</SheetTitle>
            <SheetDescription>{detailMerchant?.category} • {detailMerchant?.status}</SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 shrink-0">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="apikeys">API Keys</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-6 pb-6">
                {/* ── Profile Tab ── */}
                <TabsContent value="profile" className="space-y-4 mt-4">
                  {/* Owner info */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {(detail.ownerProfile?.name || "?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{detail.ownerProfile?.name || "—"}</h3>
                      <p className="text-sm text-muted-foreground">{detail.ownerProfile?.phone}</p>
                      {detail.ownerProfile?.email && <p className="text-xs text-muted-foreground">{detail.ownerProfile.email}</p>}
                    </div>
                    <StatusBadge status={detail.merchant.status} />
                  </div>

                  <Separator />

                  {/* Business info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoCell label="Business Name" value={detail.merchant.business_name} />
                    <InfoCell label="Category" value={detail.merchant.category} className="capitalize" />
                    <InfoCell label="MDR Rate" value={`${(Number(detail.merchant.mdr_rate) * 100).toFixed(2)}%`} />
                    <InfoCell label="Settlement" value={detail.merchant.settlement_frequency} />
                    <InfoCell label="Trade License" value={detail.merchant.trade_license || "—"} />
                    <InfoCell label="QR Code" value={detail.merchant.qr_code_data ? "Generated" : "—"} />
                  </div>

                  <Separator />

                  {/* Bank info */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Bank Details</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoCell label="Bank" value={detail.merchant.bank_name || "—"} />
                      <InfoCell label="Account" value={detail.merchant.bank_account_number || "—"} />
                      <InfoCell label="Routing" value={detail.merchant.bank_routing || "—"} />
                    </div>
                  </div>
                </TabsContent>

                {/* ── Transactions Tab ── */}
                <TabsContent value="transactions" className="mt-4">
                  <div className="space-y-2">
                    {detail.transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No transactions found</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left px-3 py-2 font-medium">Type</th>
                            <th className="text-left px-3 py-2 font-medium">Amount</th>
                            <th className="text-left px-3 py-2 font-medium">Status</th>
                            <th className="text-left px-3 py-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.transactions.map((t: any) => (
                            <tr key={t.id} className="border-b border-border/50">
                              <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{t.type}</Badge></td>
                              <td className="px-3 py-2 font-semibold">৳{Number(t.amount).toLocaleString()}</td>
                              <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{t.status}</Badge></td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </TabsContent>

                {/* ── API Keys Tab ── */}
                <TabsContent value="apikeys" className="mt-4 space-y-4">
                  {/* Generate Key Button */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">API Keys</h4>
                    <Button size="sm" className="text-xs h-8 gap-1" onClick={() => generateApiKey(detail.merchant.id)}>
                      <Plus className="w-3 h-3" /> Generate Key
                    </Button>
                  </div>

                  {/* New secret alert */}
                  {showNewSecret && (
                    <Card className="p-3 border-amber-500/30 bg-amber-500/5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-700">Save the Secret Key now!</p>
                          <p className="text-[10px] text-amber-600 mb-2">This will not be shown again. Share it securely with the merchant.</p>
                          <div className="flex items-center gap-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg p-2">
                            <code className="text-[10px] break-all flex-1 font-mono">{showNewSecret}</code>
                            <button onClick={() => copyText(showNewSecret, "admin-secret")}>
                              {copiedField === "admin-secret" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                            </button>
                          </div>
                          <Button size="sm" variant="outline" className="mt-2 h-7 text-[10px]" onClick={() => setShowNewSecret(null)}>Dismiss</Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {detail.apiKeys.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No API keys generated yet</p>
                  ) : (
                    detail.apiKeys.map(k => (
                      <Card key={k.id} className="border border-border">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Key className="w-4 h-4 text-muted-foreground" />
                              <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{k.api_key}</code>
                              <button onClick={() => copyText(k.api_key, "key-" + k.id)}>
                                {copiedField === "key-" + k.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                              </button>
                            </div>
                            <Badge variant={k.is_active ? "secondary" : "destructive"} className="text-xs">
                              {k.is_active ? "Active" : "Revoked"}
                            </Badge>
                          </div>
                          {k.webhook_url && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              <span className="truncate">{k.webhook_url}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Created: {new Date(k.created_at).toLocaleDateString()}</span>
                            {k.is_active && (
                              <Button size="sm" variant="destructive" className="text-xs h-6" onClick={() => revokeApiKey(k.id)}>
                                Revoke
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}

                  {/* ── API Access Requests ── */}
                  <Separator />
                  <h4 className="text-sm font-semibold text-foreground">API Access Requests ({detail.apiRequests.length})</h4>
                  {detail.apiRequests.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No requests from this merchant</p>
                  ) : (
                    detail.apiRequests.map((r: any) => (
                      <Card key={r.id} className="border border-border">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge className={`text-xs ${r.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : r.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                              {r.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                          </div>
                          {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
                          {r.webhook_url && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              <span className="truncate">{r.webhook_url}</span>
                            </div>
                          )}
                          {r.admin_notes && <p className="text-xs bg-muted/50 rounded p-2"><span className="font-semibold">Notes:</span> {r.admin_notes}</p>}
                          {r.status === "pending" && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button size="sm" className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
                                await handleApiRequest(r.id, "approved");
                                generateApiKey(detail.merchant.id);
                              }}>
                                <CheckCircle className="w-3 h-3" /> Approve & Generate Key
                              </Button>
                              <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => handleApiRequest(r.id, "rejected")}>
                                <XCircle className="w-3 h-3" /> Reject
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}

                  {/* Session log */}
                  <Separator />
                  <h4 className="text-sm font-semibold text-foreground">Payment Sessions ({detail.sessions.length})</h4>
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {detail.sessions.slice(0, 20).map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                        <div>
                          <span className="font-mono text-muted-foreground">{s.id.slice(0, 8)}</span>
                          <span className="ml-2 text-foreground font-semibold">৳{Number(s.amount).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                          <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* ── Analytics Tab ── */}
                <TabsContent value="analytics" className="mt-4 space-y-4">
                  {(() => {
                    const { summary, daily } = computeAnalytics();
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">Payment Analytics</h4>
                          <Select value={analyticsRange} onValueChange={v => setAnalyticsRange(v as any)}>
                            <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 days</SelectItem>
                              <SelectItem value="30">30 days</SelectItem>
                              <SelectItem value="90">90 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InfoCell label="Total Sessions" value={summary.total.toString()} />
                          <InfoCell label="Completed" value={summary.completed.toString()} />
                          <InfoCell label="Revenue" value={`৳${summary.revenue.toLocaleString()}`} />
                          <InfoCell label="Success Rate" value={`${summary.successRate}%`} />
                        </div>
                        {daily.length > 0 && (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Daily Volume</p>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={daily}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                                  <ReTooltip />
                                  <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                                  <Bar dataKey="failed" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                                  <Bar dataKey="expired" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Revenue Trend</p>
                              <ResponsiveContainer width="100%" height={160}>
                                <LineChart data={daily}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                                  <ReTooltip />
                                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>

                {/* ── Settings Tab ── */}
                <TabsContent value="settings" className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Fee & Settlement Configuration</h4>
                    {editingMdr?.id === detail.merchant.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground">MDR Rate (%)</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editingMdr.mdr}
                            onChange={e => setEditingMdr({ ...editingMdr, mdr: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Settlement Frequency</label>
                          <Select value={editingMdr.settlement} onValueChange={v => setEditingMdr({ ...editingMdr, settlement: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SETTLEMENT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveMdr} disabled={savingMdr} className="gap-1">
                            <Save className="w-3 h-3" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingMdr(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                          <div>
                            <p className="text-xs text-muted-foreground">MDR Rate</p>
                            <p className="font-semibold text-foreground">{(Number(detail.merchant.mdr_rate) * 100).toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Settlement</p>
                            <p className="font-semibold text-foreground">{detail.merchant.settlement_frequency}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setEditingMdr({
                              id: detail.merchant.id,
                              mdr: (Number(detail.merchant.mdr_rate) * 100).toFixed(2),
                              settlement: detail.merchant.settlement_frequency,
                            })}
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Category & Bank Details</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoCell label="Category" value={detail.merchant.category} className="capitalize" />
                      <InfoCell label="Bank" value={detail.merchant.bank_name || "Not set"} />
                      <InfoCell label="Account" value={detail.merchant.bank_account_number || "Not set"} />
                      <InfoCell label="Routing" value={detail.merchant.bank_routing || "Not set"} />
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          ) : (
            <div className="px-6 py-12 text-center text-muted-foreground">Failed to load details</div>
          )}
        </SheetContent>
      </Sheet>
      </>}

      {/* Create Merchant Dialog */}
      <Sheet open={showCreateMerchant} onOpenChange={setShowCreateMerchant}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[75vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-5 pb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Plus size={18} /> Create Merchant
            </SheetTitle>
            <SheetDescription>Directly create a merchant account for an existing user.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">User Phone *</label>
              <Input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="01XXXXXXXXX" maxLength={15} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Business Name *</label>
              <Input value={createForm.business_name} onChange={e => setCreateForm(f => ({ ...f, business_name: e.target.value }))} placeholder="Business name" maxLength={100} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Category</label>
              <Select value={createForm.category} onValueChange={v => setCreateForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dbCategories.map(c => <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Trade License (optional)</label>
              <Input value={createForm.trade_license} onChange={e => setCreateForm(f => ({ ...f, trade_license: e.target.value }))} placeholder="License number" maxLength={50} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Bank Name (optional)</label>
              <Input value={createForm.bank_name} onChange={e => setCreateForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g. Dutch Bangla Bank" maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Account Number</label>
                <Input value={createForm.bank_account_number} onChange={e => setCreateForm(f => ({ ...f, bank_account_number: e.target.value }))} maxLength={30} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Routing</label>
                <Input value={createForm.bank_routing} onChange={e => setCreateForm(f => ({ ...f, bank_routing: e.target.value }))} maxLength={20} />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreateMerchant} disabled={createLoading || !createForm.phone.trim() || !createForm.business_name.trim()}>
              {createLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
              Create Merchant
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`font-medium text-foreground text-sm ${className ?? ""}`}>{value}</p>
    </div>
  );
}
