import { useState, useEffect, useCallback } from "react";
import TeamActivityDashboard from "@/components/admin/TeamActivityDashboard";
import { supabase } from "@/integrations/supabase/client";
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
import { UserPlus, Shield, Trash2, Search, Clock, CheckCircle, XCircle, Eye, Pencil, Activity, RefreshCw, UsersRound } from "lucide-react";
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
  const [addPhone, setAddPhone] = useState("");
  const [addLooking, setAddLooking] = useState(false);
  const [foundUser, setFoundUser] = useState<{ user_id: string; name: string; phone: string } | null>(null);
  const [addRole, setAddRole] = useState<AppRole>("compliance");
  const [addDept, setAddDept] = useState("general");
  const [addName, setAddName] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [adding, setAdding] = useState(false);

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

  // Search user by phone
  const searchUser = async () => {
    if (!addPhone || addPhone.length < 5) return;
    setAddLooking(true);
    setFoundUser(null);
    const norm = addPhone.replace(/\D/g, "").replace(/^88/, "");
    const { data } = await supabase.from("profiles").select("user_id, name, phone").eq("phone", norm).maybeSingle();
    if (data) {
      setFoundUser(data);
      setAddName(data.name || norm);
    } else {
      toast.error("No user found with this phone number");
    }
    setAddLooking(false);
  };

  const addMember = async () => {
    if (!foundUser) return;
    setAdding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Check if already a team member
      const { data: existing } = await supabase.from("team_members").select("id").eq("user_id", foundUser.user_id).maybeSingle();
      if (existing) { toast.error("User is already a team member"); setAdding(false); return; }

      // Insert team member
      const { error: tmErr } = await supabase.from("team_members").insert({
        user_id: foundUser.user_id,
        display_name: addName || foundUser.name || foundUser.phone,
        department: addDept,
        notes: addNotes || null,
        created_by: session?.user?.id,
      });
      if (tmErr) throw tmErr;

      // Assign role if not already assigned
      const { data: existingRole } = await supabase.from("user_roles")
        .select("id").eq("user_id", foundUser.user_id).eq("role", addRole).maybeSingle();
      if (!existingRole) {
        await supabase.from("user_roles").insert({ user_id: foundUser.user_id, role: addRole });
      }

      // Insert default permissions (all view, no edit/delete)
      const perms = SECTIONS.map(s => ({
        user_id: foundUser.user_id,
        section: s,
        can_view: true,
        can_edit: false,
        can_delete: false,
        granted_by: session?.user?.id,
      }));
      await supabase.from("team_access_permissions").upsert(perms, { onConflict: "user_id,section" });

      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: session?.user?.id!,
        action: "team_member_added",
        entity_type: "team",
        entity_id: foundUser.user_id,
        details: { display_name: addName, role: addRole, department: addDept },
      });

      toast.success("Team member added successfully");
      setShowAdd(false);
      setAddPhone(""); setFoundUser(null); setAddName(""); setAddNotes("");
      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to add team member");
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
    const matchSearch = !search || m.display_name.toLowerCase().includes(search.toLowerCase()) || m.profile?.phone?.includes(search);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="matrix">Access Matrix</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
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
              <Button size="sm" onClick={() => { setShowAdd(true); setAddPhone(""); setFoundUser(null); setAddName(""); setAddNotes(""); }}>
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
                        <p className="text-sm text-muted-foreground">{member.profile?.phone || "—"}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{member.department}</Badge>
                          {(member.roles || []).map(r => (
                            <Badge key={r} className={`text-xs ${ROLE_COLORS[r] || "bg-muted text-muted-foreground"}`}>{r}</Badge>
                          ))}
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
      </Tabs>

      {/* ═══ ADD MEMBER DIALOG ═══ */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Search for an existing user by phone number to add them to your team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Phone Number</Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="01XXXXXXXXX" value={addPhone} onChange={e => setAddPhone(e.target.value)} />
                <Button onClick={searchUser} disabled={addLooking || !addPhone} size="sm">
                  {addLooking ? "..." : "Find"}
                </Button>
              </div>
            </div>
            {foundUser && (
              <>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground">{foundUser.name || "No name"}</p>
                  <p className="text-xs text-muted-foreground">{foundUser.phone}</p>
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input value={addName} onChange={e => setAddName(e.target.value)} className="mt-1" />
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
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addMember} disabled={!foundUser || adding}>{adding ? "Adding..." : "Add Member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT PERMISSIONS DIALOG ═══ */}
      <Dialog open={!!editMember} onOpenChange={o => { if (!o) setEditMember(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
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

