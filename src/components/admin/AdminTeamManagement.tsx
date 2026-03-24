import { useState, useEffect, useCallback, useMemo } from "react";
import TeamActivityDashboard from "@/components/admin/TeamActivityDashboard";
import TeamActivityLog from "@/components/admin/TeamActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { generateUsername, generatePassword } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Search, Clock, CheckCircle, XCircle, Eye, Pencil, Activity, RefreshCw, UsersRound, Copy, KeyRound, Mail, Send, Plus, ChevronDown, ChevronRight, Zap, ShieldCheck, EyeOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type AppRole = "customer" | "agent" | "merchant" | "distributor" | "super_distributor" | "admin" | "compliance" | "finance" | "support" | "operations" | "marketing" | "hr" | "audit" | "risk" | "developer" | "manager";

const STAFF_ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "compliance", label: "Compliance" },
  { value: "finance", label: "Finance" },
  { value: "support", label: "Support" },
  { value: "operations", label: "Operations" },
  { value: "marketing", label: "Marketing" },
  { value: "hr", label: "HR" },
  { value: "audit", label: "Auditor" },
  { value: "risk", label: "Risk Officer" },
  { value: "developer", label: "Developer" },
];

// ═══ EXPANDED SECTIONS WITH CATEGORIES ═══
const SECTION_CATEGORIES: { label: string; sections: string[] }[] = [
  { label: "Operations", sections: ["overview", "users", "transactions", "orders", "ecommerce", "inventory"] },
  { label: "Financial", sections: ["treasury", "settlements", "commissions", "charges", "float", "savings", "loans", "donations"] },
  { label: "Network", sections: ["merchants", "agents", "distributors", "referrals"] },
  { label: "Services", sections: ["recharge", "billers", "insurance", "gift_cards"] },
  { label: "Support", sections: ["support", "live_chat", "tickets", "disputes"] },
  { label: "Security", sections: ["security", "kyc", "locks", "blacklist", "sessions", "devices", "fraud"] },
  { label: "System", sections: ["toggles", "gateways", "webhooks", "apihub", "system_health", "data_export"] },
  { label: "Admin", sections: ["team", "permissions", "auditlog", "banners", "limits", "reporting", "marketing", "careers"] },
];

const ALL_SECTIONS = SECTION_CATEGORIES.flatMap(c => c.sections);

// ═══ PERMISSION PRESETS ═══
interface PermPreset {
  label: string;
  description: string;
  fullAccess: string[];
  viewOnly: string[];
}

const PERMISSION_PRESETS: Record<string, PermPreset> = {
  support_agent: {
    label: "Support Agent",
    description: "Support, live chat, tickets + view users/transactions/orders",
    fullAccess: ["support", "live_chat", "tickets"],
    viewOnly: ["users", "transactions", "orders", "overview"],
  },
  compliance_officer: {
    label: "Compliance Officer",
    description: "KYC, audit, security, blacklist, fraud + view users/transactions",
    fullAccess: ["kyc", "auditlog", "security", "blacklist", "fraud"],
    viewOnly: ["users", "transactions", "overview"],
  },
  finance_manager: {
    label: "Finance Manager",
    description: "Treasury, settlements, commissions, charges, float + view transactions/reporting",
    fullAccess: ["treasury", "settlements", "commissions", "charges", "float"],
    viewOnly: ["transactions", "reporting", "overview"],
  },
  operations: {
    label: "Operations",
    description: "Orders, ecommerce, inventory, merchants, agents + view overview/reporting",
    fullAccess: ["orders", "ecommerce", "inventory", "merchants", "agents"],
    viewOnly: ["overview", "reporting"],
  },
  marketing_team: {
    label: "Marketing",
    description: "Marketing, banners + view reporting/ecommerce",
    fullAccess: ["marketing", "banners"],
    viewOnly: ["reporting", "ecommerce", "overview"],
  },
  hr_manager: {
    label: "HR / Manager",
    description: "Team, users full access + view audit/sessions",
    fullAccess: ["team", "users"],
    viewOnly: ["auditlog", "sessions", "overview"],
  },
  risk_officer: {
    label: "Risk Officer",
    description: "Fraud, blacklist, security + view transactions/KYC",
    fullAccess: ["fraud", "blacklist", "security"],
    viewOnly: ["transactions", "kyc", "overview"],
  },
  auditor: {
    label: "Auditor",
    description: "View-only across audit, transactions, reporting",
    fullAccess: [],
    viewOnly: ["auditlog", "transactions", "reporting", "overview", "treasury", "settlements", "commissions"],
  },
  developer: {
    label: "Developer",
    description: "API hub, gateways, webhooks, system health",
    fullAccess: ["apihub", "gateways", "webhooks", "system_health"],
    viewOnly: ["overview", "toggles"],
  },
  full_access: {
    label: "Full Access",
    description: "All sections with full permissions",
    fullAccess: ALL_SECTIONS,
    viewOnly: [],
  },
  view_only: {
    label: "View Only",
    description: "Read-only access to all sections",
    fullAccess: [],
    viewOnly: ALL_SECTIONS,
  },
};

const DEPARTMENTS = ["general", "support", "compliance", "finance", "operations", "engineering", "marketing", "hr", "risk", "audit", "management", "product", "logistics", "legal"];

interface TeamMember {
  id: string;
  user_id: string;
  display_name: string;
  department: string;
  is_available: boolean;
  last_active_at: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  username?: string | null;
  roles?: AppRole[];
  profile?: { phone: string; name: string | null; avatar_url: string | null };
}

interface AccessPerm {
  section: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

function applyPreset(presetKey: string): AccessPerm[] {
  const preset = PERMISSION_PRESETS[presetKey];
  if (!preset) return ALL_SECTIONS.map(s => ({ section: s, can_view: false, can_add: false, can_edit: false, can_delete: false }));
  return ALL_SECTIONS.map(s => {
    if (preset.fullAccess.includes(s)) return { section: s, can_view: true, can_add: true, can_edit: true, can_delete: true };
    if (preset.viewOnly.includes(s)) return { section: s, can_view: true, can_add: false, can_edit: false, can_delete: false };
    return { section: s, can_view: false, can_add: false, can_edit: false, can_delete: false };
  });
}

function getPermSummary(perms: AccessPerm[]) {
  return {
    view: perms.filter(p => p.can_view).length,
    add: perms.filter(p => p.can_add).length,
    edit: perms.filter(p => p.can_edit).length,
    del: perms.filter(p => p.can_delete).length,
  };
}

// ═══ Permission Editor Component (reused in Add + Edit dialogs) ═══
function PermissionEditor({ perms, onChange, members }: { perms: AccessPerm[]; onChange: (p: AccessPerm[]) => void; members?: TeamMember[] }) {
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTION_CATEGORIES.map(c => [c.label, true]))
  );
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [cloneFrom, setCloneFrom] = useState<string>("");
  const [cloning, setCloning] = useState(false);

  const toggleCat = (label: string) => setOpenCats(prev => ({ ...prev, [label]: !prev[label] }));

  const handlePreset = (key: string) => {
    setSelectedPreset(key);
    setCloneFrom("");
    onChange(applyPreset(key));
  };

  const handleClone = async (memberId: string) => {
    const member = members?.find(m => m.id === memberId);
    if (!member) return;
    setCloneFrom(memberId);
    setSelectedPreset("");
    setCloning(true);
    try {
      const { data } = await supabase.from("team_access_permissions")
        .select("section, can_view, can_add, can_edit, can_delete")
        .eq("user_id", member.user_id);
      const fetched = data ?? [];
      const clonedPerms = ALL_SECTIONS.map(s => {
        const found = fetched.find((f: any) => f.section === s);
        return found
          ? { section: s, can_view: !!found.can_view, can_add: !!found.can_add, can_edit: !!found.can_edit, can_delete: !!found.can_delete }
          : { section: s, can_view: false, can_add: false, can_edit: false, can_delete: false };
      });
      onChange(clonedPerms);
      toast.success(`Cloned permissions from ${member.display_name}`);
    } catch {
      toast.error("Failed to clone permissions");
    }
    setCloning(false);
  };

  const togglePerm = (section: string, field: "can_view" | "can_add" | "can_edit" | "can_delete") => {
    setSelectedPreset("");
    setCloneFrom("");
    onChange(perms.map(p => {
      if (p.section !== section) return p;
      const updated = { ...p, [field]: !p[field] };
      if (field === "can_view" && !updated.can_view) { updated.can_add = false; updated.can_edit = false; updated.can_delete = false; }
      if (field !== "can_view" && updated[field]) { updated.can_view = true; }
      return updated;
    }));
  };

  const bulkAction = (action: "grant_view" | "revoke_all" | "full_access") => {
    setCloneFrom("");
    setSelectedPreset("");
    onChange(perms.map(p => {
      if (action === "grant_view") return { ...p, can_view: true };
      if (action === "revoke_all") return { ...p, can_view: false, can_add: false, can_edit: false, can_delete: false };
      return { ...p, can_view: true, can_add: true, can_edit: true, can_delete: true };
    }));
  };

  const summary = getPermSummary(perms);

  return (
    <div className="space-y-3">
      {/* Preset selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground shrink-0">Preset:</Label>
        <Select value={selectedPreset} onValueChange={handlePreset}>
          <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Choose a preset..." /></SelectTrigger>
          <SelectContent>
            {Object.entries(PERMISSION_PRESETS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                <div>
                  <span className="font-medium">{v.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {members && members.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">or</span>
            <Label className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><Copy className="w-3 h-3" />Clone from:</Label>
            <Select value={cloneFrom} onValueChange={handleClone} disabled={cloning}>
              <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder={cloning ? "Cloning..." : "Select member..."} /></SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkAction("grant_view")}>
          <Eye className="w-3 h-3 mr-1" />Grant All View
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkAction("full_access")}>
          <Zap className="w-3 h-3 mr-1" />Full Access
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => bulkAction("revoke_all")}>
          <EyeOff className="w-3 h-3 mr-1" />Revoke All
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {summary.view}/{ALL_SECTIONS.length} accessible
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs"><Eye className="w-3 h-3 mr-1" />View: {summary.view}</Badge>
        <Badge variant="outline" className="text-xs"><Plus className="w-3 h-3 mr-1" />Add: {summary.add}</Badge>
        <Badge variant="outline" className="text-xs"><Pencil className="w-3 h-3 mr-1" />Edit: {summary.edit}</Badge>
        <Badge variant="outline" className="text-xs"><Trash2 className="w-3 h-3 mr-1" />Delete: {summary.del}</Badge>
      </div>

      {/* Grouped sections */}
      <ScrollArea className="max-h-[40vh]">
        <div className="space-y-1">
          {SECTION_CATEGORIES.map(cat => {
            const isOpen = openCats[cat.label] !== false;
            const catPerms = perms.filter(p => cat.sections.includes(p.section));
            return (
              <Collapsible key={cat.label} open={isOpen} onOpenChange={() => toggleCat(cat.label)}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 px-2 rounded-md hover:bg-muted/50 text-sm font-semibold text-foreground">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {cat.label}
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    {catPerms.filter(p => p.can_view).length}/{cat.sections.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1">Section</TableHead>
                        <TableHead className="text-center w-14 py-1"><Eye className="w-3 h-3 mx-auto" /></TableHead>
                        <TableHead className="text-center w-14 py-1"><Plus className="w-3 h-3 mx-auto" /></TableHead>
                        <TableHead className="text-center w-14 py-1"><Pencil className="w-3 h-3 mx-auto" /></TableHead>
                        <TableHead className="text-center w-14 py-1"><Trash2 className="w-3 h-3 mx-auto" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catPerms.map(p => (
                        <TableRow key={p.section}>
                          <TableCell className="capitalize text-xs py-1.5">{p.section.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-center py-1.5">
                            <Checkbox checked={p.can_view} onCheckedChange={() => togglePerm(p.section, "can_view")} />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Checkbox checked={p.can_add} onCheckedChange={() => togglePerm(p.section, "can_add")} />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Checkbox checked={p.can_edit} onCheckedChange={() => togglePerm(p.section, "can_edit")} />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Checkbox checked={p.can_delete} onCheckedChange={() => togglePerm(p.section, "can_delete")} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function AdminTeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  // Add member state
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<AppRole>("compliance");
  const [addDept, setAddDept] = useState("general");
  const [addName, setAddName] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [addPerms, setAddPerms] = useState<AccessPerm[]>(() => applyPreset("view_only"));

  // Edit / permissions state
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editPerms, setEditPerms] = useState<AccessPerm[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  // Activity state
  const [activityMember, setActivityMember] = useState<TeamMember | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Remove state
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  // Reset password state
  const [resetPwMember, setResetPwMember] = useState<TeamMember | null>(null);
  const [newTempPassword, setNewTempPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [pwResetDone, setPwResetDone] = useState(false);

  // Change email state
  const [editEmailMember, setEditEmailMember] = useState<TeamMember | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Permission summary cache for member cards
  const [memberPermSummaries, setMemberPermSummaries] = useState<Record<string, { view: number; add: number; edit: number; del: number }>>({});

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data: tmData } = await supabase.from("team_members").select("*").order("created_at", { ascending: false });
    if (!tmData || tmData.length === 0) { setMembers([]); setLoading(false); return; }

    const userIds = tmData.map(m => m.user_id);
    const [rolesRes, profilesRes, permsRes] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabase.from("profiles").select("user_id, phone, name, avatar_url").in("user_id", userIds),
      supabase.from("team_access_permissions").select("user_id, can_view, can_add, can_edit, can_delete").in("user_id", userIds),
    ]);

    const rolesMap: Record<string, AppRole[]> = {};
    (rolesRes.data ?? []).forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role as AppRole);
    });

    const profileMap: Record<string, any> = {};
    (profilesRes.data ?? []).forEach(p => { profileMap[p.user_id] = p; });

    // Build perm summaries
    const summaries: Record<string, { view: number; add: number; edit: number; del: number }> = {};
    (permsRes.data ?? []).forEach((p: any) => {
      if (!summaries[p.user_id]) summaries[p.user_id] = { view: 0, add: 0, edit: 0, del: 0 };
      if (p.can_view) summaries[p.user_id].view++;
      if (p.can_add) summaries[p.user_id].add++;
      if (p.can_edit) summaries[p.user_id].edit++;
      if (p.can_delete) summaries[p.user_id].del++;
    });
    setMemberPermSummaries(summaries);

    setMembers(tmData.map(m => ({
      ...m,
      roles: rolesMap[m.user_id] || [],
      profile: profileMap[m.user_id] || null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("team-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => loadMembers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadMembers]);

  const resetAddForm = () => {
    setAddUsername(generateUsername());
    setAddPassword(generatePassword());
    setAddName("");
    setAddNotes("");
    setAddEmail("");
    setAddRole("compliance");
    setAddDept("general");
    setCreatedCreds(null);
    setEmailSent(false);
    setAddStep(1);
    setAddPerms(applyPreset("view_only"));
  };

  const sendCredentialsEmail = async (email: string, username: string, password: string) => {
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-team-credentials", {
        body: {
          email,
          displayName: addName.trim(),
          username,
          password,
          loginUrl: `${window.location.origin}/team-login`,
          role: addRole,
          department: addDept,
        },
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success(`Credentials sent to ${email}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send email");
    }
    setSendingEmail(false);
  };

  const addMember = async () => {
    if (!addUsername.trim() || !addPassword.trim() || !addName.trim()) {
      toast.error("Username, password and display name are required");
      return;
    }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-team-member", {
        body: {
          username: addUsername.trim(),
          password: addPassword,
          displayName: addName.trim(),
          email: addEmail.trim() || null,
          role: addRole,
          department: addDept,
          notes: addNotes || null,
          permissions: addPerms,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Team member created successfully");
      setCreatedCreds({ username: addUsername.trim(), password: addPassword });

      if (addEmail.trim()) {
        await sendCredentialsEmail(addEmail.trim(), addUsername.trim(), addPassword);
      }

      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to create team member");
    }
    setAdding(false);
  };

  // Load permissions for editing
  const openEdit = async (member: TeamMember) => {
    setEditMember(member);
    setEditLoading(true);
    const { data } = await supabase.from("team_access_permissions")
      .select("section, can_view, can_add, can_edit, can_delete")
      .eq("user_id", member.user_id);
    
    const permMap: Record<string, AccessPerm> = {};
    (data ?? []).forEach((p: any) => { permMap[p.section] = { ...p, can_add: p.can_add ?? false }; });
    setEditPerms(ALL_SECTIONS.map(s => permMap[s] || { section: s, can_view: true, can_add: false, can_edit: false, can_delete: false }));
    setEditLoading(false);
  };

  const savePermissions = async () => {
    if (!editMember) return;
    setSavingPerms(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const rows = editPerms.map(p => ({
        user_id: editMember.user_id,
        section: p.section,
        can_view: p.can_view,
        can_add: p.can_add,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        granted_by: session?.user?.id,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("team_access_permissions").upsert(rows, { onConflict: "user_id,section" });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: session?.user?.id!,
        action: "team_permissions_updated",
        entity_type: "team",
        entity_id: editMember.user_id,
        details: { display_name: editMember.display_name, sections_edited: editPerms.filter(p => p.can_edit).length },
      });

      toast.success("Permissions saved");
      setEditMember(null);
      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to save permissions");
    }
    setSavingPerms(false);
  };

  // Toggle availability
  const toggleAvailability = async (member: TeamMember) => {
    const newAvail = !member.is_available;
    const { error } = await supabase.from("team_members")
      .update({ is_available: newAvail, updated_at: new Date().toISOString() })
      .eq("id", member.id);
    if (error) { toast.error("Failed to update status"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({
        actor_id: session.user.id, action: newAvail ? "team_member_available" : "team_member_unavailable",
        entity_type: "team", entity_id: member.user_id,
        details: { display_name: member.display_name },
      }).then();
    }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_available: newAvail } : m));
  };

  // Load activity
  const openActivity = async (member: TeamMember) => {
    setActivityMember(member);
    setActivityLoading(true);
    const { data } = await supabase.from("audit_logs")
      .select("*")
      .eq("actor_id", member.user_id)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLogs(data ?? []);
    setActivityLoading(false);
  };

  // Remove member
  const confirmRemove = async () => {
    if (!removeMember) return;
    setRemoving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("team_members").delete().eq("id", removeMember.id);
      await supabase.from("team_access_permissions").delete().eq("user_id", removeMember.user_id);
      for (const role of STAFF_ROLES) {
        await supabase.from("user_roles").delete().eq("user_id", removeMember.user_id).eq("role", role.value as any);
      }

      await supabase.from("audit_logs").insert({
        actor_id: session?.user?.id!,
        action: "team_member_removed",
        entity_type: "team",
        entity_id: removeMember.user_id,
        details: { display_name: removeMember.display_name },
      });

      toast.success("Team member removed");
      setRemoveMember(null);
      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    }
    setRemoving(false);
  };

  const filtered = members.filter(m => {
    const matchSearch = !search || m.display_name.toLowerCase().includes(search.toLowerCase()) || m.profile?.phone?.includes(search) || m.username?.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || m.department === deptFilter;
    return matchSearch && matchDept;
  });

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    manager: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    compliance: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    finance: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    support: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    operations: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    hr: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
    audit: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
    risk: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    developer: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    customer: "bg-muted text-muted-foreground",
    agent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    merchant: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    distributor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    super_distributor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="members">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="matrix">Access Matrix</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* ═══ MEMBERS TAB ═══ */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-1 w-full sm:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => loadMembers()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
              <Button size="sm" onClick={() => { setShowAdd(true); resetAddForm(); }}>
                <UserPlus className="w-4 h-4 mr-1" />Add Member
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <UsersRound className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No team members found</p>
              <Button size="sm" className="mt-3" onClick={() => setShowAdd(true)}>Add First Member</Button>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map(member => {
                const ps = memberPermSummaries[member.user_id];
                return (
                  <Card key={member.id} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate">{member.display_name}</h3>
                            <div className={`w-2 h-2 rounded-full ${member.is_available ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                            <span className="text-xs text-muted-foreground">{member.is_available ? "Online" : "Offline"}</span>
                          </div>
                          <p className="text-sm text-muted-foreground font-mono">{member.username || member.profile?.phone || "—"}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs">{member.department}</Badge>
                            {(member.roles || []).map(r => (
                              <Badge key={r} className={`text-xs ${ROLE_COLORS[r] || "bg-muted text-muted-foreground"}`}>{r}</Badge>
                            ))}
                            {(() => {
                              const done = [
                                (member as any).has_logged_in,
                                (member as any).has_changed_password,
                                (member as any).has_completed_profile,
                              ].filter(Boolean).length;
                              if (done >= 3) return null;
                              return (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700">
                                  Onboarding: {done}/3
                                </Badge>
                              );
                            })()}
                          </div>
                          {/* Permission summary badges */}
                          {ps && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Eye className="w-2.5 h-2.5 mr-0.5" />{ps.view}</Badge>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Plus className="w-2.5 h-2.5 mr-0.5" />{ps.add}</Badge>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Pencil className="w-2.5 h-2.5 mr-0.5" />{ps.edit}</Badge>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Trash2 className="w-2.5 h-2.5 mr-0.5" />{ps.del}</Badge>
                            </div>
                          )}
                          {member.last_active_at && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last active {formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch checked={member.is_available} onCheckedChange={() => toggleAvailability(member)} />
                          <Button size="icon" variant="ghost" onClick={() => { setResetPwMember(member); setNewTempPassword(generatePassword()); setPwResetDone(false); }} title="Reset Password">
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEditEmailMember(member); setNewEmail((member as any).email || ""); }} title="Change Email">
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(member)} title="Permissions">
                            <Shield className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openActivity(member)} title="Activity">
                            <Activity className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setRemoveMember(member)} title="Remove" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ ACCESS MATRIX TAB ═══ */}
        <TabsContent value="matrix" className="space-y-4">
          <AccessMatrixView members={members} />
        </TabsContent>

        {/* ═══ DASHBOARD TAB ═══ */}
        <TabsContent value="dashboard" className="space-y-4">
          <TeamActivityDashboard />
        </TabsContent>

        {/* ═══ ACTIVITY LOG TAB ═══ */}
        <TabsContent value="activity" className="space-y-4">
          <TeamActivityLog />
        </TabsContent>
      </Tabs>

      {/* ═══ ADD MEMBER DIALOG (2-STEP) ═══ */}
      <Dialog open={showAdd} onOpenChange={o => { if (!o) { setShowAdd(false); setCreatedCreds(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {createdCreds ? "Credentials Created" : addStep === 1 ? "Add Team Member — Step 1: Info" : "Add Team Member — Step 2: Permissions"}
            </DialogTitle>
            <DialogDescription>
              {createdCreds
                ? "Share these credentials securely with the team member."
                : addStep === 1
                ? "Create a new team member account with auto-generated credentials."
                : "Configure what this team member can access. You can also change this later."}
            </DialogDescription>
          </DialogHeader>

          {createdCreds ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="font-mono font-semibold text-foreground">{createdCreds.username}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(createdCreds.username); toast.success("Username copied"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Password</p>
                    <p className="font-mono font-semibold text-foreground">{createdCreds.password}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(createdCreds.password); toast.success("Password copied"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Login URL</p>
                  <p className="text-sm font-mono text-foreground break-all">{window.location.origin}/team-login</p>
                  <Button size="sm" variant="ghost" className="mt-1 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/team-login`); toast.success("URL copied"); }}>
                    <Copy className="w-3 h-3 mr-1" />Copy URL
                  </Button>
                </div>
              </div>
              {emailSent && addEmail.trim() ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Credentials emailed to <strong>{addEmail.trim()}</strong></span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Email to send credentials (optional)"
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                    type="email"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!addEmail.trim() || sendingEmail}
                    onClick={() => sendCredentialsEmail(addEmail.trim(), createdCreds.username, createdCreds.password)}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {sendingEmail ? "Sending..." : "Send"}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center">⚠️ Save these credentials now. The password won't be shown again.</p>
            </div>
          ) : addStep === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Username</Label>
                  <div className="flex gap-1 mt-1">
                    <Input value={addUsername} onChange={e => setAddUsername(e.target.value)} className="font-mono" />
                    <Button size="icon" variant="outline" onClick={() => setAddUsername(generateUsername())} title="Regenerate">
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="flex gap-1 mt-1">
                    <Input value={addPassword} onChange={e => setAddPassword(e.target.value)} className="font-mono" />
                    <Button size="icon" variant="outline" onClick={() => setAddPassword(generatePassword())} title="Regenerate">
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={addName} onChange={e => setAddName(e.target.value)} className="mt-1" placeholder="John Doe" />
              </div>
              <div>
                <Label>Email <span className="text-muted-foreground font-normal">(for credentials &amp; 2FA)</span></Label>
                <div className="flex gap-1 mt-1">
                  <Mail className="w-4 h-4 mt-2.5 text-muted-foreground shrink-0" />
                  <Input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" placeholder="member@company.com" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Used for sending credentials and two-factor authentication at login.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Select value={addRole} onValueChange={v => setAddRole(v as AppRole)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={addDept} onValueChange={setAddDept}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} className="mt-1" rows={2} />
              </div>
            </div>
          ) : (
            /* Step 2: Permissions */
            <PermissionEditor perms={addPerms} onChange={setAddPerms} members={members} />
          )}

          <DialogFooter>
            {createdCreds ? (
              <Button onClick={() => { setShowAdd(false); setCreatedCreds(null); }}>Done</Button>
            ) : addStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!addUsername.trim() || !addPassword.trim() || !addName.trim()) {
                      toast.error("Username, password and display name are required");
                      return;
                    }
                    setAddStep(2);
                  }}
                >
                  Next: Permissions →
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAddStep(1)}>← Back</Button>
                <Button variant="secondary" onClick={() => { setAddPerms(applyPreset("view_only")); addMember(); }}>
                  Skip (View-Only Default)
                </Button>
                <Button onClick={addMember} disabled={adding}>
                  <KeyRound className="w-4 h-4 mr-1" />
                  {adding ? "Creating..." : "Create Account"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT PERMISSIONS DIALOG ═══ */}
      <Dialog open={!!editMember} onOpenChange={o => { if (!o) setEditMember(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Permissions — {editMember?.display_name}</DialogTitle>
            <DialogDescription>Configure which admin sections this team member can access.</DialogDescription>
          </DialogHeader>
          {editLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <PermissionEditor perms={editPerms} onChange={setEditPerms} members={members} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button onClick={savePermissions} disabled={savingPerms}>{savingPerms ? "Saving..." : "Save Permissions"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ ACTIVITY DIALOG ═══ */}
      <Dialog open={!!activityMember} onOpenChange={o => { if (!o) setActivityMember(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Activity — {activityMember?.display_name}</DialogTitle>
            <DialogDescription>Recent actions performed by this team member.</DialogDescription>
          </DialogHeader>
          {activityLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : activityLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activity recorded</p>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2">
                {activityLogs.map(log => (
                  <div key={log.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {log.entity_type && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.entity_type}{log.entity_id ? ` → ${String(log.entity_id).slice(0, 8)}…` : ""}
                      </p>
                    )}
                    {log.details && (
                      <pre className="text-xs bg-muted/50 p-1.5 rounded mt-1 overflow-x-auto max-w-full">
                        {JSON.stringify(log.details, null, 1).slice(0, 200)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ REMOVE CONFIRM ═══ */}
      <Dialog open={!!removeMember} onOpenChange={o => { if (!o) setRemoveMember(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeMember?.display_name}</strong> from the team? This will revoke all staff roles and permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMember(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ RESET PASSWORD DIALOG ═══ */}
      <Dialog open={!!resetPwMember} onOpenChange={o => { if (!o) setResetPwMember(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Generate a new temporary password for <strong>{resetPwMember?.display_name}</strong>. They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">New Password</Label>
              <div className="flex gap-1 mt-1">
                <Input value={newTempPassword} readOnly className="font-mono" />
                <Button size="icon" variant="outline" onClick={() => setNewTempPassword(generatePassword())} title="Regenerate">
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(newTempPassword); toast.success("Password copied"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {pwResetDone && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Password reset successfully. Share the new password securely.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwMember(null)}>{pwResetDone ? "Close" : "Cancel"}</Button>
            {!pwResetDone && (
              <Button
                onClick={async () => {
                  if (!resetPwMember) return;
                  setResettingPw(true);
                  try {
                    const { error } = await supabase.functions.invoke("admin-reset-team-password", {
                      body: { targetUserId: resetPwMember.user_id, newPassword: newTempPassword },
                    });
                    if (error) throw error;
                    setPwResetDone(true);
                    toast.success("Password reset successfully");

                    // Optionally email the new password if member has email
                    const memberEmail = (resetPwMember as any).email;
                    if (memberEmail) {
                      await supabase.functions.invoke("send-team-credentials", {
                        body: {
                          email: memberEmail,
                          displayName: resetPwMember.display_name,
                          username: resetPwMember.username || "—",
                          password: newTempPassword,
                          loginUrl: `${window.location.origin}/team-login`,
                          role: resetPwMember.roles?.[0] || "—",
                          department: resetPwMember.department,
                        },
                      });
                      toast.success(`New credentials emailed to ${memberEmail}`);
                    }
                  } catch (e: any) {
                    toast.error(e.message || "Failed to reset password");
                  }
                  setResettingPw(false);
                }}
                disabled={resettingPw}
              >
                <KeyRound className="w-4 h-4 mr-1" />
                {resettingPw ? "Resetting..." : "Reset Password"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ CHANGE EMAIL DIALOG ═══ */}
      <Dialog open={!!editEmailMember} onOpenChange={o => { if (!o) setEditEmailMember(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>
              Update the email address for <strong>{editEmailMember?.display_name}</strong>. Used for 2FA and credential delivery.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Email</Label>
            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="member@company.com" className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmailMember(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!editEmailMember) return;
                setSavingEmail(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const oldEmail = (editEmailMember as any).email || null;
                  const trimmed = newEmail.trim() || null;

                  const { error } = await supabase.from("team_members")
                    .update({ email: trimmed, updated_at: new Date().toISOString() } as any)
                    .eq("user_id", editEmailMember.user_id);
                  if (error) throw error;

                  await supabase.from("audit_logs").insert({
                    actor_id: session?.user?.id!,
                    action: "team_email_changed",
                    entity_type: "team",
                    entity_id: editEmailMember.user_id,
                    details: {
                      display_name: editEmailMember.display_name,
                      old_email: oldEmail,
                      new_email: trimmed,
                    },
                  });

                  toast.success("Email updated");
                  setEditEmailMember(null);
                  loadMembers();
                } catch (e: any) {
                  toast.error(e.message || "Failed to update email");
                }
                setSavingEmail(false);
              }}
              disabled={savingEmail}
            >
              <Mail className="w-4 h-4 mr-1" />
              {savingEmail ? "Saving..." : "Save Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══ Access Matrix Sub-Component ═══
function AccessMatrixView({ members }: { members: TeamMember[] }) {
  const [perms, setPerms] = useState<Record<string, AccessPerm[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (members.length === 0) { setLoading(false); return; }
      const userIds = members.map(m => m.user_id);
      const { data } = await supabase.from("team_access_permissions")
        .select("user_id, section, can_view, can_add, can_edit, can_delete")
        .in("user_id", userIds);

      const map: Record<string, AccessPerm[]> = {};
      (data ?? []).forEach((p: any) => {
        if (!map[p.user_id]) map[p.user_id] = [];
        map[p.user_id].push({ ...p, can_add: p.can_add ?? false });
      });
      setPerms(map);
      setLoading(false);
    };
    load();
  }, [members]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (members.length === 0) return <p className="text-center text-muted-foreground py-8">No team members to display</p>;

  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">Section</TableHead>
              {members.map(m => (
                <TableHead key={m.id} className="text-center min-w-[100px]">
                  <div className="text-xs font-medium truncate">{m.display_name}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SECTION_CATEGORIES.map(cat => (
              <>
                <TableRow key={`cat-${cat.label}`}>
                  <TableCell colSpan={members.length + 1} className="sticky left-0 bg-muted/50 font-semibold text-xs text-muted-foreground uppercase tracking-wider py-1.5">
                    {cat.label}
                  </TableCell>
                </TableRow>
                {cat.sections.map(section => (
                  <TableRow key={section}>
                    <TableCell className="sticky left-0 bg-background font-medium capitalize text-sm">{section.replace(/_/g, " ")}</TableCell>
                    {members.map(m => {
                      const p = (perms[m.user_id] || []).find(pp => pp.section === section);
                      return (
                        <TableCell key={m.id} className="text-center">
                          <div className="flex justify-center gap-0.5">
                            {p?.can_view && <Eye className="w-3 h-3 text-emerald-500" />}
                            {p?.can_add && <Plus className="w-3 h-3 text-cyan-500" />}
                            {p?.can_edit && <Pencil className="w-3 h-3 text-blue-500" />}
                            {p?.can_delete && <Trash2 className="w-3 h-3 text-destructive" />}
                            {!p?.can_view && !p?.can_add && !p?.can_edit && !p?.can_delete && <XCircle className="w-3 h-3 text-muted-foreground/30" />}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}
