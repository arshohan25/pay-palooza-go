import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Search, MapPin, Eye, CheckCircle, XCircle, UserPlus, Loader2, Pencil, Trash2, PauseCircle, Save, X, Star, MessageSquare, Building2, ArrowRightLeft, Upload, Image as ImageIcon, KeyRound, RefreshCw, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signUpWithPhonePassword } from "@/lib/auth";
import { toast } from "sonner";
import DistributorPickerDialog from "./DistributorPickerDialog";
import { reassignAgent } from "@/lib/distributorAdmin";
import DistrictRoutePicker from "@/components/DistrictRoutePicker";
import DivisionDistrictUpazilaPicker from "@/components/DivisionDistrictUpazilaPicker";
import { districtToRouteCode } from "@/lib/districtRouteCode";
import AdminSmsDeliveryLogs from "./AdminSmsDeliveryLogs";

interface Agent {
  id: string;
  user_id: string;
  business_name: string | null;
  status: string;
  territory_code: string | null;
  commission_earned: number;
  customers_onboarded: number;
  max_float: number;
  nid_number: string | null;
  trade_license: string | null;
  distributor_id: string | null;
  created_at: string;
  profile?: { name: string | null; phone: string; balance: number; avatar_url: string | null };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  suspended: { label: "Suspended", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  hold: { label: "On Hold", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
};

export default function AdminAgentHub() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" /> Agent Management Hub
      </h3>
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="w-full grid grid-cols-8 h-auto">
          <TabsTrigger value="list" className="text-xs">Agents</TabsTrigger>
          <TabsTrigger value="kyc" className="text-xs">KYC</TabsTrigger>
          <TabsTrigger value="wallets" className="text-xs">Wallets</TabsTrigger>
          <TabsTrigger value="commission" className="text-xs">Comm.</TabsTrigger>
          <TabsTrigger value="areas" className="text-xs">Areas</TabsTrigger>
          <TabsTrigger value="settlements" className="text-xs">Settle</TabsTrigger>
          <TabsTrigger value="ratings" className="text-xs">Ratings</TabsTrigger>
          <TabsTrigger value="sms" className="text-xs">SMS Log</TabsTrigger>
        </TabsList>
        <TabsContent value="list"><AgentListTab /></TabsContent>
        <TabsContent value="kyc"><AgentKycTab /></TabsContent>
        <TabsContent value="wallets"><AgentWalletsTab /></TabsContent>
        <TabsContent value="commission"><AgentCommissionTab /></TabsContent>
        <TabsContent value="areas"><AgentAreasTab /></TabsContent>
        <TabsContent value="settlements"><AgentSettlementsTab /></TabsContent>
        <TabsContent value="ratings"><AgentRatingsTab /></TabsContent>
        <TabsContent value="sms"><AdminSmsDeliveryLogs /></TabsContent>
      </Tabs>
    </div>
  );
}

function KycImagePreview({ file, existingPath, alt, onClear, onReplace }: { file: File | null; existingPath?: string | null; alt: string; onClear?: () => void; onReplace?: () => void }) {
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setLocalUrl(null); return; }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    if (file || !existingPath) { setSignedUrl(null); return; }
    supabase.storage.from("kyc-documents").createSignedUrl(existingPath, 300).then(({ data }) => {
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [file, existingPath]);

  const url = localUrl ?? signedUrl;
  if (!url) return null;
  return (
    <div className="mt-2 relative rounded-md overflow-hidden border border-border bg-muted group">
      <img src={url} alt={alt} className="w-full h-24 object-cover" />
      {file && <span className="absolute top-1 left-1 rounded bg-primary/90 text-primary-foreground text-[9px] px-1.5 py-0.5">New</span>}
      {!file && signedUrl && <span className="absolute top-1 left-1 rounded bg-emerald-600/90 text-white text-[9px] px-1.5 py-0.5">On file</span>}
      <div className="absolute top-1 right-1 flex gap-1">
        {onReplace && (
          <button
            type="button"
            onClick={onReplace}
            className="rounded bg-background/90 hover:bg-background text-foreground text-[9px] px-1.5 py-0.5 border border-border shadow-sm"
            aria-label="Replace"
          >
            Replace
          </button>
        )}
        {file && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground w-5 h-5 flex items-center justify-center shadow-sm"
            aria-label="Remove"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

import { TempPinResendPanel } from "./TempPinResendPanel";




function AgentListTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Agent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", email: "", business_name: "", territory_code: "", division: "", district: "", upazila: "", union_parishad: "", area_type: "" as "" | "union" | "powrashava" | "city_corporation", nid_number: "", trade_license: "", max_float: "500000", latitude: "", longitude: "", address: "" });
  const [nidFile, setNidFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const nidInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState({ business_name: "", territory_code: "", division: "", district: "", upazila: "", union_parishad: "", area_type: "" as "" | "union" | "powrashava" | "city_corporation", max_float: "", nid_number: "", trade_license: "", latitude: "", longitude: "", address: "" });
  const [editNidFile, setEditNidFile] = useState<File | null>(null);
  const [editSelfieFile, setEditSelfieFile] = useState<File | null>(null);
  const editNidInputRef = useRef<HTMLInputElement>(null);
  const editSelfieInputRef = useRef<HTMLInputElement>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [distMap, setDistMap] = useState<Record<string, string>>({});
  const [distFilter, setDistFilter] = useState<string>("all"); // "all" | "unassigned" | <id>
  const [changeDistAgent, setChangeDistAgent] = useState<Agent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
    if (data) {
      const userIds = data.map(a => a.user_id);
      const [{ data: profiles }, { data: dists }] = await Promise.all([
        supabase.from("profiles").select("user_id, name, phone, balance, avatar_url").in("user_id", userIds),
        supabase.from("distributors").select("id, business_name"),
      ]);
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
      setDistMap(Object.fromEntries((dists ?? []).map((d: any) => [d.id, d.business_name])));
      setAgents(data.map(a => ({ ...a, profile: profileMap[a.user_id] })) as Agent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = agents.filter(a => {
    if (distFilter === "unassigned" && a.distributor_id) return false;
    if (distFilter !== "all" && distFilter !== "unassigned" && a.distributor_id !== distFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return !!(a.business_name?.toLowerCase().includes(q) || a.profile?.phone?.includes(search) || a.profile?.name?.toLowerCase().includes(q));
  });

  const handleChangeDistributor = async (toId: string | null, toName: string) => {
    if (!changeDistAgent) return;
    const agent = changeDistAgent;
    try {
      const res = await reassignAgent(agent.id, agent.distributor_id, toId);
      toast.success(`Agent moved to ${toName}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await reassignAgent(agent.id, toId, res.prevDistId);
              toast.success("Undo — agent restored");
              load();
            } catch (e: any) { toast.error(e.message || "Undo failed"); }
          },
        },
      });
      setChangeDistAgent(null);
      load();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };


  const statusCounts = {
    active: agents.filter(a => a.status === "active").length,
    pending: agents.filter(a => a.status === "pending").length,
    suspended: agents.filter(a => a.status === "suspended").length,
    hold: agents.filter(a => a.status === "hold").length,
  };

  const setStatus = async (agent: Agent, newStatus: string) => {
    await supabase.from("agents").update({ status: newStatus as any }).eq("id", agent.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({ actor_id: session.user.id, action: `agent_${newStatus}`, entity_type: "agent", entity_id: agent.id, details: { business_name: agent.business_name, previous_status: agent.status } }).then();
    }
    toast.success(`Agent ${newStatus}`);
    load();
  };

  const handleCreateAgent = async () => {
    const phone = form.phone.replace(/\D/g, "").replace(/^88/, "");
    if (!/^01[3-9]\d{8}$/.test(phone)) { toast.error("Enter a valid 11-digit BD phone number"); return; }
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Full Name");
    if (!form.email.trim()) missing.push("Email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toast.error("Enter a valid email address"); return; }
    if (!form.business_name.trim()) missing.push("Business Name");
    if (!form.division) missing.push("Division");
    if (!form.district) missing.push("District");
    if (!form.upazila) missing.push("Upazila/Thana");
    if (!form.max_float || parseInt(form.max_float) <= 0) missing.push("Max Float");
    if (!form.nid_number.trim()) missing.push("NID Number");
    if (!nidFile) missing.push("NID Card Photo");
    if (!selfieFile) missing.push("Selfie / Photo");
    if (!form.trade_license.trim()) missing.push("Trade License");
    if (!form.address.trim()) missing.push("Address");
    if (!form.latitude || isNaN(parseFloat(form.latitude))) missing.push("Latitude");
    if (!form.longitude || isNaN(parseFloat(form.longitude))) missing.push("Longitude");
    if (missing.length) {
      toast.error(`Required: ${missing.join(", ")}`);
      return;
    }

    setCreating(true);
    try {
      // Look up existing user by phone
      const { data: existingProfile } = await supabase
        .from("profiles").select("user_id").eq("phone", phone).maybeSingle();

      let userId: string;
      let isNewUser = false;

      if (existingProfile?.user_id) {
        userId = existingProfile.user_id;
        // Guard against duplicate agent row
        const { data: existingAgent } = await supabase
          .from("agents").select("id").eq("user_id", userId).maybeSingle();
        if (existingAgent) { toast.error("This user is already an agent"); setCreating(false); return; }
        if (form.name || form.email) {
          await supabase.from("profiles").update({ name: form.name || undefined, email: form.email.trim() || undefined }).eq("user_id", userId);
        }
      } else {
        // Sign up with a random placeholder password; the temp PIN is set
        // later by the issue-agent-temp-pin edge function.
        const placeholder = crypto.randomUUID().replace(/-/g, "") + "!Ep";
        const { data: authData } = await signUpWithPhonePassword(phone, placeholder, { display_name: form.name || phone });
        if (!authData?.user) throw new Error("Account creation failed");
        userId = authData.user.id;
        isNewUser = true;
        await supabase.from("profiles").update({ name: form.name || null, phone, email: form.email.trim() || null }).eq("user_id", userId);
      }

      // Assign agent role (skip if already present)
      const { data: hasRole } = await supabase
        .from("user_roles").select("id").eq("user_id", userId).eq("role", "agent" as any).maybeSingle();
      if (!hasRole) {
        await supabase.from("user_roles").insert({ user_id: userId, role: "agent" } as any);
      }
      // Upload NID image and selfie (if provided) to kyc-documents
      let nid_image_path: string | null = null;
      let selfie_path: string | null = null;
      if (nidFile) {
        const ext = nidFile.name.split(".").pop() || "jpg";
        const path = `agents/${userId}/nid-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("kyc-documents").upload(path, nidFile, { upsert: true, contentType: nidFile.type });
        if (upErr) throw new Error(`NID upload failed: ${upErr.message}`);
        nid_image_path = path;
      }
      if (selfieFile) {
        const ext = selfieFile.name.split(".").pop() || "jpg";
        const path = `agents/${userId}/selfie-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("kyc-documents").upload(path, selfieFile, { upsert: true, contentType: selfieFile.type });
        if (upErr) throw new Error(`Selfie upload failed: ${upErr.message}`);
        selfie_path = path;
      }

      await supabase.from("agents").insert({
        user_id: userId, business_name: form.business_name || null, territory_code: form.territory_code || null,
        division: form.division || null, district: form.district || null, upazila: form.upazila || null,
        union_parishad: form.union_parishad || null, area_type: form.area_type || null,
        nid_number: form.nid_number || null, trade_license: form.trade_license || null,
        max_float: parseInt(form.max_float) || 500000, status: "active",
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        address: form.address || "",
        nid_image_path, selfie_path,
      } as any);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "agent_created", entity_type: "agent", entity_id: userId, details: { phone, business_name: form.business_name, promoted_existing: !isNewUser } }).then();
      }

      // Issue temp PIN + SMS for freshly created accounts
      if (isNewUser) {
        try {
          const { data: issueData, error: issueErr } = await supabase.functions.invoke("issue-agent-temp-pin", {
            body: { agent_user_id: userId, phone, name: form.name || undefined, purpose: "create" },
          });
          if (issueErr) throw issueErr;
          const payload = issueData as { sms_status?: string; pin_fallback?: string } | null;
          if (payload?.sms_status === "sent") {
            toast.success(`Agent created! Temporary PIN sent by SMS to +88${phone}`, { duration: 8000 });
          } else if (payload?.pin_fallback) {
            toast.warning(`Agent created, but SMS failed. Temp PIN: ${payload.pin_fallback}`, { duration: 15000 });
          } else {
            toast.warning(`Agent created, but SMS status unknown. Check delivery logs.`, { duration: 10000 });
          }
        } catch (e: any) {
          console.error("issue temp PIN failed", e);
          toast.error(`Agent created, but PIN could not be issued: ${e?.message ?? "unknown error"}`);
        }
      } else {
        toast.success(`Existing user promoted to agent`, { duration: 6000 });
      }
      setCreateOpen(false);
      setForm({ phone: "", name: "", email: "", business_name: "", territory_code: "", division: "", district: "", upazila: "", union_parishad: "", area_type: "", nid_number: "", trade_license: "", max_float: "500000", latitude: "", longitude: "", address: "" });
      setNidFile(null); setSelfieFile(null);
      load();
    } catch (err: any) { toast.error(err.message || "Failed to create agent"); }
    finally { setCreating(false); }
  };

  // Edit agent
  const openEdit = (a: Agent) => {
    setEditAgent(a);
    setEditForm({
      business_name: a.business_name || "",
      territory_code: a.territory_code || "",
      division: (a as any).division || "",
      district: (a as any).district || "",
      upazila: (a as any).upazila || "",
      union_parishad: (a as any).union_parishad || "",
      area_type: ((a as any).area_type || "") as "" | "union" | "powrashava" | "city_corporation",
      max_float: String(a.max_float),
      nid_number: a.nid_number || "",
      trade_license: a.trade_license || "",
      latitude: (a as any).latitude != null ? String((a as any).latitude) : "",
      longitude: (a as any).longitude != null ? String((a as any).longitude) : "",
      address: (a as any).address || "",
    });
  };

  const saveEdit = async () => {
    if (!editAgent) return;
    if (!editForm.division || !editForm.district || !editForm.upazila) {
      toast.error("Division, District and Upazila/Thana are required");
      return;
    }
    setEditSaving(true);
    try {
      let nid_image_path: string | undefined;
      let selfie_path: string | undefined;
      if (editNidFile) {
        const ext = editNidFile.name.split(".").pop() || "jpg";
        const path = `agents/${editAgent.user_id}/nid-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("kyc-documents").upload(path, editNidFile, { upsert: true, contentType: editNidFile.type });
        if (upErr) throw new Error(`NID upload failed: ${upErr.message}`);
        nid_image_path = path;
      }
      if (editSelfieFile) {
        const ext = editSelfieFile.name.split(".").pop() || "jpg";
        const path = `agents/${editAgent.user_id}/selfie-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("kyc-documents").upload(path, editSelfieFile, { upsert: true, contentType: editSelfieFile.type });
        if (upErr) throw new Error(`Selfie upload failed: ${upErr.message}`);
        selfie_path = path;
      }
      // Auto-derive wallet territory route code when district changes.
      const previousDistrict = (editAgent as any).district || "";
      const previousTerritory = editAgent.territory_code || "";
      let nextTerritory = editForm.territory_code || "";
      if (editForm.district && editForm.district !== previousDistrict) {
        const derived = await districtToRouteCode(editForm.district);
        if (derived) nextTerritory = derived;
      }

      const updatePayload: any = {
        business_name: editForm.business_name || null,
        territory_code: nextTerritory || null,
        division: editForm.division || null,
        district: editForm.district || null,
        upazila: editForm.upazila || null,
        union_parishad: editForm.union_parishad || null,
        area_type: editForm.area_type || null,
        max_float: parseInt(editForm.max_float) || editAgent.max_float,
        nid_number: editForm.nid_number || null,
        trade_license: editForm.trade_license || null,
        latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
        longitude: editForm.longitude ? parseFloat(editForm.longitude) : null,
        address: editForm.address || "",
      };
      if (nid_image_path) updatePayload.nid_image_path = nid_image_path;
      if (selfie_path) updatePayload.selfie_path = selfie_path;
      const { error } = await supabase.from("agents").update(updatePayload).eq("id", editAgent.id);
      if (error) { toast.error("Failed to update"); } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "agent_edited", entity_type: "agent", entity_id: editAgent.id, details: { changes: editForm } }).then();

          // Dedicated location-change audit: only when a hierarchy field or
          // wallet territory code actually changed.
          const locBefore = {
            division: (editAgent as any).division || null,
            district: previousDistrict || null,
            upazila: (editAgent as any).upazila || null,
            union_parishad: (editAgent as any).union_parishad || null,
            area_type: (editAgent as any).area_type || null,
            territory_code: previousTerritory || null,
          };
          const locAfter = {
            division: editForm.division || null,
            district: editForm.district || null,
            upazila: editForm.upazila || null,
            union_parishad: editForm.union_parishad || null,
            area_type: editForm.area_type || null,
            territory_code: nextTerritory || null,
          };
          const locChanged = (Object.keys(locBefore) as (keyof typeof locBefore)[]).some(k => locBefore[k] !== locAfter[k]);
          if (locChanged) {
            supabase.from("audit_logs").insert({
              actor_id: session.user.id,
              action: "agent_location_changed",
              entity_type: "agent",
              entity_id: editAgent.id,
              details: { before: locBefore, after: locAfter } as any,
            }).then();
          }
        }
        toast.success("Agent updated");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
    setEditSaving(false);
    setEditNidFile(null);
    setEditSelfieFile(null);
    setEditAgent(null);
    load();
  };

  // Delete agent
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("agents").delete().eq("id", deleteTarget.id);
    await supabase.from("user_roles").delete().eq("user_id", deleteTarget.user_id).eq("role", "agent" as any);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "agent_deleted", entity_type: "agent", entity_id: deleteTarget.id, details: { business_name: deleteTarget.business_name } }).then();
    }
    toast.success("Agent deleted");
    setDeleteTarget(null);
    setDeleting(false);
    load();
  };

  // Bulk
  const bulkSetStatus = async (status: string) => {
    setBulkLoading(true);
    const targets = agents.filter(a => selectedIds.has(a.id));
    await Promise.allSettled(targets.map(a => supabase.from("agents").update({ status: status as any }).eq("id", a.id)));
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "agent_bulk_status", entity_type: "agent", entity_id: "bulk", details: { count: targets.length, new_status: status, agent_ids: targets.map(a => a.id) } }).then();
    }
    toast.success(`${targets.length} agents set to ${status}`);
    setSelectedIds(new Set());
    setBulkLoading(false);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(statusCounts).map(([s, c]) => (
          <Card key={s} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground capitalize">{s === "hold" ? "On Hold" : s}</p>
              <p className="text-lg font-bold text-foreground">{c}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" /></div>
        <select
          value={distFilter}
          onChange={(e) => setDistFilter(e.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-background px-2 max-w-[160px]"
          title="Filter by distributor"
        >
          <option value="all">All distributors</option>
          <option value="unassigned">Unassigned</option>
          {Object.entries(distMap).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <Button size="icon" className="shrink-0 h-8 w-8" onClick={() => setCreateOpen(true)}><UserPlus className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="default" className="text-xs h-7" onClick={() => bulkSetStatus("active")} disabled={bulkLoading}>Activate</Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => bulkSetStatus("hold")} disabled={bulkLoading}>Hold</Button>
          <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => bulkSetStatus("suspended")} disabled={bulkLoading}>Suspend</Button>
        </div>
      )}

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2.5 w-8">
                  <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={() => {
                    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(filtered.map(a => a.id)));
                  }} />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Phone</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Territory</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden md:table-cell">Distributor</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <Checkbox checked={selectedIds.has(a.id)} onCheckedChange={() => {
                        setSelectedIds(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; });
                      }} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground text-xs">{a.business_name || a.profile?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{a.profile?.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{a.territory_code || "—"}</td>
                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">
                      {a.distributor_id ? (
                        <span className="inline-flex items-center gap-1 text-foreground"><Building2 className="w-3 h-3 text-muted-foreground" />{distMap[a.distributor_id] || a.distributor_id.slice(0, 8)}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><Badge className={`text-[10px] ${STATUS_MAP[a.status]?.color || ""}`}>{STATUS_MAP[a.status]?.label || a.status}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(a)}><Eye className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Change distributor" onClick={() => setChangeDistAgent(a)}><ArrowRightLeft className="w-3.5 h-3.5" /></Button>
                        {a.status === "active" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStatus(a, "hold")}><PauseCircle className="w-3.5 h-3.5 text-amber-600" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStatus(a, a.status === "suspended" ? "active" : "suspended")}>
                          {a.status === "suspended" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(a)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && <EmptyState text="No agents found" />}
        </CardContent>
      </Card>

      {/* Change distributor picker */}
      <DistributorPickerDialog
        open={!!changeDistAgent}
        onOpenChange={(o) => { if (!o) setChangeDistAgent(null); }}
        title="Change distributor"
        description={`Assign ${changeDistAgent?.business_name || "agent"} to a distributor.`}
        excludeIds={changeDistAgent?.distributor_id ? [changeDistAgent.distributor_id] : []}
        allowUnassign
        onPick={handleChangeDistributor}
      />

      {/* Agent Detail Sheet */}
      <Sheet open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Agent Details</SheetTitle></SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Business Name</p><p className="font-medium">{detail.business_name || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{detail.profile?.phone || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Territory</p><p className="font-medium">{detail.territory_code || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Max Float</p><p className="font-medium">৳{detail.max_float.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Commission Earned</p><p className="font-medium text-emerald-600">৳{detail.commission_earned.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Customers</p><p className="font-medium">{detail.customers_onboarded}</p></div>
                <div><p className="text-muted-foreground text-xs">NID</p><p className="font-medium">{detail.nid_number || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Trade License</p><p className="font-medium">{detail.trade_license || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Wallet Balance</p><p className="font-medium">৳{(detail.profile?.balance ?? 0).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><Badge className={STATUS_MAP[detail.status]?.color}>{STATUS_MAP[detail.status]?.label || detail.status}</Badge></div>
              </div>

              <TempPinResendPanel kind="agent" userId={detail.user_id} phone={detail.profile?.phone} name={detail.profile?.name} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-5 pt-5 pb-2 pr-12 shrink-0"><DialogTitle className="truncate text-base sm:text-lg">Create New Agent</DialogTitle></DialogHeader>
          <div className="space-y-3 px-5 pt-1 pb-3 overflow-y-auto flex-1 min-h-0">
            <div><Label>Phone Number *</Label><Input placeholder="01XXXXXXXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 11) }))} /></div>
            <div><Label>Full Name *</Label><Input placeholder="Agent's name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input type="email" placeholder="agent@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Business Name *</Label><Input placeholder="Shop / business name" value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 gap-2">
              <DivisionDistrictUpazilaPicker
                value={{ division: form.division || null, district: form.district || null, upazila: form.upazila || null, union_parishad: form.union_parishad || null, area_type: (form.area_type || null) as any }}
                onChange={(v) => setForm(f => ({ ...f, division: v.division || "", district: v.district || "", upazila: v.upazila || "", union_parishad: v.union_parishad || "", area_type: (v.area_type || "") as any }))}
                required
              />
              <div><Label>Max Float *</Label><Input type="number" value={form.max_float} onChange={e => setForm(f => ({ ...f, max_float: e.target.value }))} /></div>
            </div>
            <div><Label>NID Number *</Label><Input placeholder="National ID" value={form.nid_number} onChange={e => setForm(f => ({ ...f, nid_number: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />NID Card Photo *</Label>
                <Input ref={nidInputRef} type="file" accept="image/*" onChange={e => setNidFile(e.target.files?.[0] || null)} className="mt-1 cursor-pointer file:mr-2 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-2 file:py-1 file:text-xs" />
                {nidFile && <p className="text-[10px] text-muted-foreground mt-1 truncate">✓ {nidFile.name}</p>}
                <KycImagePreview
                  file={nidFile}
                  alt="NID preview"
                  onReplace={() => nidInputRef.current?.click()}
                  onClear={() => { setNidFile(null); if (nidInputRef.current) nidInputRef.current.value = ""; }}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Selfie / Photo *</Label>
                <Input ref={selfieInputRef} type="file" accept="image/*" capture="user" onChange={e => setSelfieFile(e.target.files?.[0] || null)} className="mt-1 cursor-pointer file:mr-2 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-2 file:py-1 file:text-xs" />
                {selfieFile && <p className="text-[10px] text-muted-foreground mt-1 truncate">✓ {selfieFile.name}</p>}
                <KycImagePreview
                  file={selfieFile}
                  alt="Selfie preview"
                  onReplace={() => selfieInputRef.current?.click()}
                  onClear={() => { setSelfieFile(null); if (selfieInputRef.current) selfieInputRef.current.value = ""; }}
                />
              </div>
            </div>
            <div><Label>Trade License *</Label><Input placeholder="Trade license number" value={form.trade_license} onChange={e => setForm(f => ({ ...f, trade_license: e.target.value }))} /></div>
            <div><Label>Address *</Label><Input placeholder="Shop address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><Label>Latitude *</Label><Input type="number" step="any" placeholder="23.8103" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
              <div><Label>Longitude *</Label><Input type="number" step="any" placeholder="90.4125" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border shrink-0 bg-background">
            <Button className="w-full" onClick={handleCreateAgent} disabled={creating || !form.phone || !form.name.trim() || !form.email.trim() || !form.business_name.trim() || !form.division || !form.district || !form.upazila || !form.max_float || !form.nid_number.trim() || !nidFile || !selfieFile || !form.trade_license.trim() || !form.address.trim() || !form.latitude || !form.longitude}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={!!editAgent} onOpenChange={o => { if (!o) setEditAgent(null); }}>

        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-5 pt-5 pb-2 pr-12 shrink-0"><DialogTitle className="truncate text-base sm:text-lg">Edit Agent — {editAgent?.business_name || editAgent?.profile?.name || "Agent"}</DialogTitle></DialogHeader>
          <div className="space-y-3 px-5 pt-1 pb-3 overflow-y-auto flex-1 min-h-0">
            <div><Label>Business Name</Label><Input value={editForm.business_name} onChange={e => setEditForm(f => ({ ...f, business_name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 gap-2">
              <DivisionDistrictUpazilaPicker
                value={{ division: editForm.division || null, district: editForm.district || null, upazila: editForm.upazila || null, union_parishad: editForm.union_parishad || null, area_type: (editForm.area_type || null) as any }}
                onChange={(v) => setEditForm(f => ({ ...f, division: v.division || "", district: v.district || "", upazila: v.upazila || "", union_parishad: v.union_parishad || "", area_type: (v.area_type || "") as any }))}
                required
              />
              <div><Label>Max Float</Label><Input type="number" value={editForm.max_float} onChange={e => setEditForm(f => ({ ...f, max_float: e.target.value }))} /></div>
            </div>
            <div><Label>NID Number</Label><Input value={editForm.nid_number} onChange={e => setEditForm(f => ({ ...f, nid_number: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />NID Card Photo{(editAgent as any)?.nid_image_path ? " (replace)" : ""}</Label>
                <Input ref={editNidInputRef} type="file" accept="image/*" onChange={e => setEditNidFile(e.target.files?.[0] || null)} className="mt-1 cursor-pointer file:mr-2 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-2 file:py-1 file:text-xs" />
                {editNidFile ? <p className="text-[10px] text-muted-foreground mt-1 truncate">✓ {editNidFile.name}</p> : (editAgent as any)?.nid_image_path && <p className="text-[10px] text-emerald-600 mt-1 truncate">On file</p>}
                <KycImagePreview
                  file={editNidFile}
                  existingPath={(editAgent as any)?.nid_image_path}
                  alt="NID preview"
                  onReplace={() => editNidInputRef.current?.click()}
                  onClear={() => { setEditNidFile(null); if (editNidInputRef.current) editNidInputRef.current.value = ""; }}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Selfie / Photo{(editAgent as any)?.selfie_path ? " (replace)" : ""}</Label>
                <Input ref={editSelfieInputRef} type="file" accept="image/*" capture="user" onChange={e => setEditSelfieFile(e.target.files?.[0] || null)} className="mt-1 cursor-pointer file:mr-2 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-2 file:py-1 file:text-xs" />
                {editSelfieFile ? <p className="text-[10px] text-muted-foreground mt-1 truncate">✓ {editSelfieFile.name}</p> : (editAgent as any)?.selfie_path && <p className="text-[10px] text-emerald-600 mt-1 truncate">On file</p>}
                <KycImagePreview
                  file={editSelfieFile}
                  existingPath={(editAgent as any)?.selfie_path}
                  alt="Selfie preview"
                  onReplace={() => editSelfieInputRef.current?.click()}
                  onClear={() => { setEditSelfieFile(null); if (editSelfieInputRef.current) editSelfieInputRef.current.value = ""; }}
                />
              </div>
            </div>
            <div><Label>Trade License</Label><Input value={editForm.trade_license} onChange={e => setEditForm(f => ({ ...f, trade_license: e.target.value }))} /></div>
            <div><Label>Address</Label><Input placeholder="Shop address" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input type="number" step="any" placeholder="e.g. 23.8103" value={editForm.latitude} onChange={e => setEditForm(f => ({ ...f, latitude: e.target.value }))} /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" placeholder="e.g. 90.4125" value={editForm.longitude} onChange={e => setEditForm(f => ({ ...f, longitude: e.target.value }))} /></div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border shrink-0 bg-background">
            <Button className="w-full" onClick={saveEdit} disabled={editSaving || !editForm.division || !editForm.district || !editForm.upazila}>
              {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteTarget?.business_name || deleteTarget?.profile?.name}</strong>? This removes their agent record and role. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AgentKycTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: agentData } = await supabase.from("agents").select("id, user_id, business_name, status, nid_number");
      if (agentData) {
        const uids = agentData.map(a => a.user_id);
        const [{ data: profiles }, { data: kycs }] = await Promise.all([
          supabase.from("profiles").select("user_id, name, phone").in("user_id", uids),
          supabase.from("kyc_verifications").select("user_id, status, full_name").in("user_id", uids),
        ]);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        const kMap = Object.fromEntries((kycs ?? []).map(k => [k.user_id, k]));
        setAgents(agentData.map(a => ({ ...a, profile: pMap[a.user_id], kyc: kMap[a.user_id] || null })));
      }
      setLoading(false);
    })();
  }, []);

  const kycStatus = (kyc: any) => kyc?.status || "not_submitted";
  const kycColor = (s: string) => s === "verified" ? "text-emerald-600" : s === "pending" ? "text-amber-600" : "text-red-500";

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">NID</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">KYC Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">KYC Name</th>
            </tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">{a.business_name || a.profile?.name || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.nid_number || "—"}</td>
                  <td className={`px-3 py-2.5 text-xs font-semibold capitalize ${kycColor(kycStatus(a.kyc))}`}>{kycStatus(a.kyc)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.kyc?.full_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && agents.length === 0 && <EmptyState text="No agents registered" />}
      </CardContent>
    </Card>
  );
}

function AgentWalletsTab() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: agentData } = await supabase.from("agents").select("id, user_id, business_name, max_float, commission_earned, status");
      if (agentData) {
        const uids = agentData.map(a => a.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, balance, phone").in("user_id", uids);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        setWallets(agentData.map(a => ({ ...a, balance: pMap[a.user_id]?.balance ?? 0, phone: pMap[a.user_id]?.phone })));
      }
      setLoading(false);
    })();
  }, []);

  const totalFloat = wallets.reduce((s, w) => s + w.balance, 0);
  const totalCommission = wallets.reduce((s, w) => s + w.commission_earned, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Float</p><p className="text-lg font-bold text-foreground">৳{totalFloat.toLocaleString()}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Commission</p><p className="text-lg font-bold text-emerald-600">৳{totalCommission.toLocaleString()}</p></CardContent></Card>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Balance</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Max Float</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Utilization</th>
              </tr></thead>
              <tbody>
                {wallets.map(w => {
                  const util = w.max_float > 0 ? ((w.balance / w.max_float) * 100).toFixed(1) : "0";
                  return (
                    <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-xs font-medium">{w.business_name || w.phone || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{w.balance.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground text-right">৳{w.max_float.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-xs text-right hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Number(util))}%` }} /></div>
                          <span className="text-muted-foreground">{util}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && wallets.length === 0 && <EmptyState text="No agent wallets" />}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentAreasTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState<any>(null);
  const [territory, setTerritory] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("agents").select("id, user_id, business_name, territory_code, status");
      if (data) {
        const uids = data.map(a => a.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", uids);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        setAgents(data.map(a => ({ ...a, profile: pMap[a.user_id] })));
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!editAgent) return;
    await supabase.from("agents").update({ territory_code: territory || null }).eq("id", editAgent.id);
    toast.success("Territory updated");
    setEditAgent(null);
    setAgents(prev => prev.map(a => a.id === editAgent.id ? { ...a, territory_code: territory || null } : a));
  };

  const areaCounts: Record<string, number> = {};
  agents.forEach(a => { const area = a.territory_code || "Unassigned"; areaCounts[area] = (areaCounts[area] || 0) + 1; });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(areaCounts).map(([area, count]) => (
          <Badge key={area} variant="secondary" className="text-xs">{area}: {count}</Badge>
        ))}
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Territory</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Edit</th>
              </tr></thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{a.business_name || a.profile?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs"><Badge variant="outline" className="text-[10px]"><MapPin className="w-3 h-3 mr-1" />{a.territory_code || "Unassigned"}</Badge></td>
                    <td className="px-3 py-2.5"><Badge className={`text-[10px] ${STATUS_MAP[a.status]?.color}`}>{a.status}</Badge></td>
                    <td className="px-3 py-2.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditAgent(a); setTerritory(a.territory_code || ""); }}><Pencil className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && agents.length === 0 && <EmptyState text="No agents" />}
        </CardContent>
      </Card>

      <Dialog open={!!editAgent} onOpenChange={o => !o && setEditAgent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Territory — {editAgent?.business_name || "Agent"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>District (route code)</Label><DistrictRoutePicker value={territory} onChange={(code) => setTerritory(code)} placeholder="Select district" /></div>
            <Button className="w-full" onClick={handleSave}>Update Territory</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentCommissionTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("commission_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (data) {
        const agentIds = [...new Set(data.filter(l => l.agent_id).map(l => l.agent_id))];
        const { data: agents } = await supabase.from("agents").select("id, business_name").in("id", agentIds);
        const aMap = Object.fromEntries((agents ?? []).map(a => [a.id, a.business_name]));
        setLogs(data.map(l => ({ ...l, agent_name: aMap[l.agent_id] || "—" })));
      }
      setLoading(false);
    })();
  }, []);

  const totalAgent = logs.reduce((s, l) => s + Number(l.agent_amount), 0);
  const byType: Record<string, number> = {};
  logs.forEach(l => { byType[l.txn_type] = (byType[l.txn_type] || 0) + Number(l.agent_amount); });

  return (
    <div className="space-y-3">
      <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Agent Commission</p><p className="text-lg font-bold text-emerald-600">৳{totalAgent.toLocaleString()}</p></CardContent></Card>
      {Object.keys(byType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, amt]) => (
            <Badge key={type} variant="secondary" className="text-xs">{type}: ৳{amt.toLocaleString()}</Badge>
          ))}
        </div>
      )}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Txn Amt</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Commission</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Date</th>
              </tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{l.agent_name}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{l.txn_type}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-right">৳{Number(l.txn_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-right text-emerald-600">৳{Number(l.agent_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && logs.length === 0 && <EmptyState text="No commission logs" />}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentSettlementsTab() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("settlements").select("*").eq("entity_type", "agent").order("created_at", { ascending: false }).limit(50);
      setSettlements(data ?? []);
      setLoading(false);
    })();
  }, []);

  const totalSettled = settlements.filter(s => s.status === "completed").reduce((sum, s) => sum + Number(s.net_amount), 0);

  return (
    <div className="space-y-3">
      <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Settled (Agent)</p><p className="text-lg font-bold text-foreground">৳{totalSettled.toLocaleString()}</p></CardContent></Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Gross</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Net</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Date</th>
              </tr></thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{s.entity_name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-right">৳{Number(s.gross_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs text-right font-semibold">৳{Number(s.net_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5"><Badge variant={s.status === "completed" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && settlements.length === 0 && <EmptyState text="No agent settlements" />}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentRatingsTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"highest" | "lowest" | "most">("highest");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: agentData } = await supabase.from("agents").select("id, business_name, avg_rating, total_ratings, user_id");
    const { data: ratingsData } = await supabase.from("agent_ratings").select("*").order("created_at", { ascending: false }).limit(500);
    if (agentData) {
      const uids = agentData.map(a => a.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", uids);
      const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
      setAgents(agentData.map(a => ({ ...a, profile: pMap[a.user_id] })));
    }
    if (ratingsData) {
      const userIds = [...new Set(ratingsData.map(r => r.user_id))];
      const { data: userProfiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", userIds);
      const upMap = Object.fromEntries((userProfiles ?? []).map(p => [p.user_id, p]));
      setRatings(ratingsData.map(r => ({ ...r, user_profile: upMap[r.user_id] })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sortedAgents = [...agents].sort((a, b) => {
    if (sortBy === "highest") return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0);
    if (sortBy === "lowest") return (Number(a.avg_rating) || 0) - (Number(b.avg_rating) || 0);
    return (b.total_ratings || 0) - (a.total_ratings || 0);
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from("agent_ratings").delete().eq("id", deleteId);
    toast.success("Rating deleted");
    setDeleteId(null);
    setDeleting(false);
    load();
  };

  const avgAll = agents.length > 0 ? (agents.reduce((s, a) => s + (Number(a.avg_rating) || 0), 0) / agents.filter(a => (a.total_ratings || 0) > 0).length || 0) : 0;
  const totalAll = agents.reduce((s, a) => s + (a.total_ratings || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Avg Rating</p>
            <p className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
              <Star size={16} className="fill-amber-400 text-amber-400" /> {avgAll > 0 ? avgAll.toFixed(1) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Total Reviews</p>
            <p className="text-lg font-bold text-foreground">{totalAll}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1.5">
        {(["highest", "lowest", "most"] as const).map(s => (
          <Button key={s} size="sm" variant={sortBy === s ? "default" : "outline"} className="text-xs h-7" onClick={() => setSortBy(s)}>
            {s === "highest" ? "Top Rated" : s === "lowest" ? "Lowest" : "Most Reviews"}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {sortedAgents.map(a => {
          const agentRatings = ratings.filter(r => r.agent_id === a.id);
          const isExpanded = expandedAgent === a.id;
          return (
            <Card key={a.id} className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                <button onClick={() => setExpandedAgent(isExpanded ? null : a.id)} className="w-full flex items-center gap-3 p-3 text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{a.business_name || a.profile?.name || "Agent"}</p>
                    <p className="text-xs text-muted-foreground">{a.profile?.phone || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      <span className="text-sm font-bold text-foreground">{Number(a.avg_rating) > 0 ? Number(a.avg_rating).toFixed(1) : "—"}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{a.total_ratings || 0} reviews</Badge>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 space-y-2 pt-2">
                    {agentRatings.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">No reviews yet</p>}
                    {agentRatings.map(r => (
                      <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-foreground">{r.user_profile?.name || r.user_profile?.phone || "User"}</p>
                            <div className="flex">
                              {[1,2,3,4,5].map(s => <Star key={s} size={10} className={s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"} />)}
                            </div>
                          </div>
                          {r.comment && <p className="text-[11px] text-muted-foreground mt-0.5">{r.comment}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!loading && agents.length === 0 && <EmptyState text="No agents" />}

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>Remove this review? The agent's average rating will be recalculated automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </motion.div>
  );
}
