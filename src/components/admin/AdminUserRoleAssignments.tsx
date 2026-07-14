import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Shield, Plus, X, Loader2, UserCog, Lock } from "lucide-react";
import { toast } from "sonner";
import { usePermission } from "@/hooks/use-permission";
import { ROLE_KEYS } from "@/lib/permissionsRegistry";

const APP_ROLE_OPTIONS = [
  "admin", "manager", "operations", "compliance", "finance", "support",
  "marketing", "hr", "audit", "risk", "developer",
] as const;

interface ProfileRow { user_id: string; name: string | null; phone: string | null; }
interface RoleRow { user_id: string; role: string; }

async function logAudit(action: string, details: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  supabase.from("audit_logs").insert({
    actor_id: session.user.id,
    action,
    entity_type: "user_role",
    entity_id: null,
    details,
  } as any).then();
}

/** Assign / revoke platform roles for admin users. */
export default function AdminUserRoleAssignments() {
  const canManage = usePermission("manage_roles");
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
    const list = ((roleRows ?? []) as any[]) as RoleRow[];
    setRoles(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", ids);
      setProfiles((profs as any[] ?? []) as ProfileRow[]);
    } else {
      setProfiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("admin-user-roles-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const rolesByUser = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of roles) (m[r.user_id] ??= []).push(r.role);
    return m;
  }, [roles]);

  const nonCustomerProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      const userRoles = rolesByUser[p.user_id] ?? [];
      const hasAdminRole = userRoles.some((r) => (ROLE_KEYS as readonly string[]).includes(r));
      if (!hasAdminRole && !q) return false;
      if (!q) return hasAdminRole;
      return (p.name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q);
    });
  }, [profiles, rolesByUser, search]);

  const [findQuery, setFindQuery] = useState("");
  const [findResults, setFindResults] = useState<ProfileRow[]>([]);
  const [finding, setFinding] = useState(false);
  const findUser = async () => {
    const q = findQuery.trim();
    if (q.length < 2) { toast.error("Enter at least 2 chars"); return; }
    setFinding(true);
    const digits = q.replace(/\D/g, "");
    let query = supabase.from("profiles").select("user_id, name, phone").limit(20);
    query = digits.length >= 4
      ? query.ilike("phone", `%${digits}%`)
      : query.ilike("name", `%${q}%`);
    const { data } = await query;
    setFindResults((data ?? []) as any[]);
    setFinding(false);
  };

  const grantRole = async (userId: string, role: string) => {
    if (!canManage) { toast.error("Missing 'manage_roles' permission"); return; }
    setSaving(`${userId}:${role}:grant`);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error && !/duplicate/i.test(error.message)) { toast.error(error.message); }
    else {
      await logAudit("role_assigned", { user_id: userId, role });
      toast.success(`Granted ${role}`);
    }
    setSaving(null);
    load();
  };

  const revokeRole = async (userId: string, role: string) => {
    if (!canManage) { toast.error("Missing 'manage_roles' permission"); return; }
    setSaving(`${userId}:${role}:revoke`);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    if (error) { toast.error(error.message); }
    else {
      await logAudit("role_revoked", { user_id: userId, role });
      toast.success(`Revoked ${role}`);
    }
    setSaving(null);
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><UserCog className="w-5 h-5 text-primary" /></div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Admin User Role Assignments</p>
            <p className="text-xs text-muted-foreground">Add or remove platform roles for staff users. Permissions per role are set in Roles &amp; Permissions.</p>
          </div>
          {canManage === false && <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Read-only</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Find user to grant role</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Name or phone…" value={findQuery} onChange={(e) => setFindQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findUser()} className="pl-9" />
            </div>
            <Button onClick={findUser} disabled={finding || !canManage}>{finding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}</Button>
          </div>
          {findResults.length > 0 && (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {findResults.map((p) => (
                <button key={p.user_id} type="button" className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/60 text-left" onClick={() => { setSelected(p); setFindResults([]); setFindQuery(""); }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name || "Unnamed"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.phone || p.user_id.slice(0, 8)}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-primary"><Plus className="w-3 h-3" /> Manage</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Users with admin roles</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter…" className="pl-8 h-8 w-48 text-xs" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <ScrollArea className="max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonCustomerProfiles.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No admin users yet — search above to grant a role.</TableCell></TableRow>
                  ) : nonCustomerProfiles.map((p) => (
                    <TableRow key={p.user_id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{p.name || "Unnamed"}</p>
                        <p className="text-[11px] text-muted-foreground">{p.phone || p.user_id.slice(0, 8)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(rolesByUser[p.user_id] ?? []).map((r) => (
                            <Badge key={r} variant="secondary" className="capitalize gap-1">
                              {r.replace(/_/g, " ")}
                              {canManage && (
                                <button type="button" title={`Revoke ${r}`} onClick={() => revokeRole(p.user_id, r)} className="hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(p)} disabled={!canManage}>Manage</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Manage roles dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Manage roles</DialogTitle>
            <DialogDescription>{selected?.name || "User"} · {selected?.phone}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {APP_ROLE_OPTIONS.map((r) => {
              const has = selected ? (rolesByUser[selected.user_id] ?? []).includes(r) : false;
              const key = selected ? `${selected.user_id}:${r}:${has ? "revoke" : "grant"}` : "";
              return (
                <div key={r} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40">
                  <span className="text-sm font-medium capitalize">{r.replace(/_/g, " ")}</span>
                  {saving === key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : has ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => selected && revokeRole(selected.user_id, r)} disabled={!canManage}>
                      <X className="w-3 h-3 mr-1" /> Revoke
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => selected && grantRole(selected.user_id, r)} disabled={!canManage}>
                      <Plus className="w-3 h-3 mr-1" /> Grant
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
