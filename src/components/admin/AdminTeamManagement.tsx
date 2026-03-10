import { useState, useEffect, useCallback } from "react";
import TeamActivityDashboard from "@/components/admin/TeamActivityDashboard";
import TeamActivityLog from "@/components/admin/TeamActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { teamSignUp, generateUsername, generatePassword } from "@/lib/auth";
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
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Search, Clock, CheckCircle, XCircle, Eye, Pencil, Activity, RefreshCw, UsersRound, Copy, KeyRound, Mail, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type AppRole = "customer" | "agent" | "merchant" | "distributor" | "super_distributor" | "admin" | "compliance" | "finance";

const STAFF_ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "compliance", label: "Compliance" },
  { value: "finance", label: "Finance" },
];

const SECTIONS = [
  "overview", "users", "transactions", "chargebacks", "alerts", "charges",
  "commissions", "disputes", "support", "locks", "orders", "gateways",
  "toggles", "recharge", "kyc", "referrals", "treasury", "webhooks",
  "permissions", "reporting", "billers", "auditlog", "apihub", "banners", "limits", "team",
];

const DEPARTMENTS = ["general", "support", "compliance", "finance", "operations", "engineering"];

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
  can_edit: boolean;
  can_delete: boolean;
}

export default function AdminTeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  // Add member state
  const [showAdd, setShowAdd] = useState(false);
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

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data: tmData } = await supabase.from("team_members").select("*").order("created_at", { ascending: false });
    if (!tmData || tmData.length === 0) { setMembers([]); setLoading(false); return; }

    const userIds = tmData.map(m => m.user_id);
    const [rolesRes, profilesRes] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabase.from("profiles").select("user_id, phone, name, avatar_url").in("user_id", userIds),
    ]);

    const rolesMap: Record<string, AppRole[]> = {};
    (rolesRes.data ?? []).forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role as AppRole);
    });

    const profileMap: Record<string, any> = {};
    (profilesRes.data ?? []).forEach(p => { profileMap[p.user_id] = p; });

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
      const { data: { session } } = await supabase.auth.getSession();
      const adminSession = session; // save admin session

      // Create auth account for team member
      const signUpData = await teamSignUp(addUsername.trim(), addPassword, addName.trim());
      if (!signUpData.user) throw new Error("Failed to create account");
      const newUserId = signUpData.user.id;

      // Re-authenticate as admin (teamSignUp changes the session)
      // We need to restore admin session
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      // Create profile with synthetic phone
      const syntheticPhone = `TEAM-${addUsername.trim()}`;
      await supabase.from("profiles").insert({
        user_id: newUserId,
        phone: syntheticPhone,
        name: addName.trim(),
        status: "active",
      });

      // Insert team member row
      await supabase.from("team_members").insert({
        user_id: newUserId,
        display_name: addName.trim(),
        department: addDept,
        notes: addNotes || null,
        created_by: adminSession?.user?.id,
        username: addUsername.trim(),
        temp_password: addPassword,
      } as any);

      // Assign role
      await supabase.from("user_roles").insert({ user_id: newUserId, role: addRole });

      // Insert default permissions
      const perms = SECTIONS.map(s => ({
        user_id: newUserId,
        section: s,
        can_view: true,
        can_edit: false,
        can_delete: false,
        granted_by: adminSession?.user?.id,
      }));
      await supabase.from("team_access_permissions").upsert(perms, { onConflict: "user_id,section" });

      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: adminSession?.user?.id!,
        action: "team_member_created",
        entity_type: "team",
        entity_id: newUserId,
        details: { display_name: addName.trim(), username: addUsername.trim(), role: addRole, department: addDept },
      });

      toast.success("Team member created successfully");
      setCreatedCreds({ username: addUsername.trim(), password: addPassword });

      // Auto-send credentials email if email was provided
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
      .select("section, can_view, can_edit, can_delete")
      .eq("user_id", member.user_id);
    
    const permMap: Record<string, AccessPerm> = {};
    (data ?? []).forEach(p => { permMap[p.section] = p; });
    setEditPerms(SECTIONS.map(s => permMap[s] || { section: s, can_view: true, can_edit: false, can_delete: false }));
    setEditLoading(false);
  };

  const togglePerm = (section: string, field: "can_view" | "can_edit" | "can_delete") => {
    setEditPerms(prev => prev.map(p => {
      if (p.section !== section) return p;
      const updated = { ...p, [field]: !p[field] };
      // If removing view, also remove edit/delete
      if (field === "can_view" && !updated.can_view) { updated.can_edit = false; updated.can_delete = false; }
      // If granting edit/delete, also grant view
      if ((field === "can_edit" || field === "can_delete") && updated[field]) { updated.can_view = true; }
      return updated;
    }));
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
        details: { display_name: editMember.display_name, sections_edited: editPerms.filter(p => p.can_edit).map(p => p.section).length },
      });

      toast.success("Permissions saved");
      setEditMember(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to save permissions");
    }
    setSavingPerms(false);
  };

  // Toggle availability
  const toggleAvailability = async (member: TeamMember) => {
    const { error } = await supabase.from("team_members")
      .update({ is_available: !member.is_available, updated_at: new Date().toISOString() })
      .eq("id", member.id);
    if (error) { toast.error("Failed to update status"); return; }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_available: !m.is_available } : m));
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
      // Remove from team_members
      await supabase.from("team_members").delete().eq("id", removeMember.id);
      // Remove team permissions
      await supabase.from("team_access_permissions").delete().eq("user_id", removeMember.user_id);
      // Remove staff roles (keep customer)
      for (const role of STAFF_ROLES) {
        await supabase.from("user_roles").delete().eq("user_id", removeMember.user_id).eq("role", role.value);
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
    compliance: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    finance: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    customer: "bg-muted text-muted-foreground",
    agent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    merchant: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    distributor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    super_distributor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="members">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="members" className="text-xs sm:text-sm">Members</TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs sm:text-sm">Access</TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm">Dashboard</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
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
              {filtered.map(member => (
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
                        {member.last_active_at && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last active {formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={member.is_available} onCheckedChange={() => toggleAvailability(member)} />
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
              ))}
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

      {/* ═══ ADD MEMBER DIALOG ═══ */}
      <Dialog open={showAdd} onOpenChange={o => { if (!o) { setShowAdd(false); setCreatedCreds(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createdCreds ? "Credentials Created" : "Add Team Member"}</DialogTitle>
            <DialogDescription>
              {createdCreds
                ? "Share these credentials securely with the team member."
                : "Create a new team member account with auto-generated credentials."}
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
          ) : (
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
                <Label>Email <span className="text-muted-foreground font-normal">(optional — to send credentials)</span></Label>
                <div className="flex gap-1 mt-1">
                  <Mail className="w-4 h-4 mt-2.5 text-muted-foreground shrink-0" />
                  <Input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" placeholder="member@company.com" />
                </div>
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
          )}

          <DialogFooter>
            {createdCreds ? (
              <Button onClick={() => { setShowAdd(false); setCreatedCreds(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button onClick={addMember} disabled={adding || !addUsername.trim() || !addPassword.trim() || !addName.trim()}>
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
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Permissions — {editMember?.display_name}</DialogTitle>
            <DialogDescription>Configure which admin sections this team member can access.</DialogDescription>
          </DialogHeader>
          {editLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-center w-20"><Eye className="w-4 h-4 mx-auto" /></TableHead>
                    <TableHead className="text-center w-20"><Pencil className="w-4 h-4 mx-auto" /></TableHead>
                    <TableHead className="text-center w-20"><Trash2 className="w-4 h-4 mx-auto" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editPerms.map(p => (
                    <TableRow key={p.section}>
                      <TableCell className="font-medium capitalize">{p.section}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_view} onCheckedChange={() => togglePerm(p.section, "can_view")} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_edit} onCheckedChange={() => togglePerm(p.section, "can_edit")} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_delete} onCheckedChange={() => togglePerm(p.section, "can_delete")} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
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
        .select("user_id, section, can_view, can_edit, can_delete")
        .in("user_id", userIds);

      const map: Record<string, AccessPerm[]> = {};
      (data ?? []).forEach(p => {
        if (!map[p.user_id]) map[p.user_id] = [];
        map[p.user_id].push(p);
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
            {SECTIONS.map(section => (
              <TableRow key={section}>
                <TableCell className="sticky left-0 bg-background font-medium capitalize text-sm">{section}</TableCell>
                {members.map(m => {
                  const p = (perms[m.user_id] || []).find(pp => pp.section === section);
                  return (
                    <TableCell key={m.id} className="text-center">
                      <div className="flex justify-center gap-0.5">
                        {p?.can_view && <Eye className="w-3 h-3 text-emerald-500" />}
                        {p?.can_edit && <Pencil className="w-3 h-3 text-blue-500" />}
                        {p?.can_delete && <Trash2 className="w-3 h-3 text-destructive" />}
                        {!p?.can_view && !p?.can_edit && !p?.can_delete && <XCircle className="w-3 h-3 text-muted-foreground/30" />}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}

