import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Plus, Loader2, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import { REGISTERED_PERMISSIONS, ROLE_KEYS } from "@/lib/permissionsRegistry";
import { usePermission } from "@/hooks/use-permission";

interface Row { role: string; permission: string; allowed: boolean; }

export default function AdminRolesPermissions() {
  const canManage = usePermission("manage_roles");
  const [rows, setRows] = useState<Row[]>([]);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_role_permissions" as any).select("role, permission, allowed");
    const list = ((data ?? []) as any[]) as Row[];
    setRows(list);
    // Custom roles = any role present in DB that isn't in the built-in list.
    const extra = Array.from(new Set(list.map((r) => r.role))).filter((r) => !ROLE_KEYS.includes(r as any));
    setCustomRoles(extra);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("admin-arp-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_role_permissions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const roles = useMemo(() => [...ROLE_KEYS, ...customRoles], [customRoles]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const r of rows) {
      (m[r.role] ??= {})[r.permission] = r.allowed;
    }
    return m;
  }, [rows]);

  const groups = useMemo(() => {
    const g: Record<string, typeof REGISTERED_PERMISSIONS> = {};
    for (const p of REGISTERED_PERMISSIONS) (g[p.group] ??= []).push(p);
    return g;
  }, []);

  const toggle = async (role: string, permission: string, allowed: boolean) => {
    if (!canManage) { toast.error("You need the 'manage_roles' permission"); return; }
    if (role === "admin") { toast.error("Admin role always has all permissions"); return; }
    const key = `${role}:${permission}`;
    setSaving(key);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("admin_role_permissions" as any)
      .upsert({ role, permission, allowed, updated_at: new Date().toISOString(), updated_by: session?.user?.id ?? null } as any, { onConflict: "role,permission" });
    if (error) {
      toast.error(error.message);
    } else {
      // Optimistic local update in case realtime lags
      setRows((prev) => {
        const other = prev.filter((r) => !(r.role === role && r.permission === permission));
        return [...other, { role, permission, allowed }];
      });
      toast.success(`${allowed ? "Granted" : "Revoked"} ${permission} for ${role}`);
    }
    setSaving(null);
  };

  const addRole = async () => {
    const name = newRole.trim().toLowerCase().replace(/\s+/g, "_");
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(name)) { toast.error("Use lowercase letters, numbers, underscore"); return; }
    if (roles.includes(name)) { toast.error("Role already exists"); return; }
    // Seed with zero rows so the column appears
    const { error } = await supabase.from("admin_role_permissions" as any).insert({
      role: name, permission: REGISTERED_PERMISSIONS[0].key, allowed: false,
    } as any);
    if (error) { toast.error(error.message); return; }
    setCustomRoles((c) => [...c, name]);
    setNewRole("");
    setAddOpen(false);
    toast.success(`Role "${name}" added — toggle permissions below.`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="w-5 h-5 text-primary" /></div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Roles &amp; Permissions</p>
            <p className="text-xs text-muted-foreground">Grant or revoke capabilities per role without editing code. Admin always has everything.</p>
          </div>
          {canManage === false && (
            <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Read-only</Badge>
          )}
          <Button size="sm" variant="ghost" onClick={load} title="Reload"><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!canManage} className="gap-1"><Plus className="w-4 h-4" /> Role</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        Object.entries(groups).map(([groupName, perms]) => (
          <Card key={groupName}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{groupName}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <div className="min-w-[720px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left font-medium p-3 sticky left-0 bg-muted/40">Permission</th>
                        {roles.map((r) => (
                          <th key={r} className="p-2 text-center font-medium text-xs capitalize">{r.replace(/_/g, " ")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perms.map((p) => (
                        <tr key={p.key} className="border-t border-border">
                          <td className="p-3 sticky left-0 bg-background">
                            <p className="font-medium text-foreground">{p.label}</p>
                            <p className="text-[11px] text-muted-foreground max-w-xs">{p.description}</p>
                            <code className="text-[10px] text-muted-foreground/70">{p.key}</code>
                          </td>
                          {roles.map((r) => {
                            const key = `${r}:${p.key}`;
                            const on = r === "admin" ? true : (matrix[r]?.[p.key] ?? false);
                            return (
                              <td key={r} className="p-2 text-center">
                                {saving === key ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                ) : (
                                  <Switch
                                    checked={on}
                                    disabled={r === "admin" || !canManage}
                                    onCheckedChange={(v) => toggle(r, p.key, v)}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add role</DialogTitle>
            <DialogDescription>Add a custom role key. Use lowercase letters and underscore.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role key</Label>
            <Input placeholder="e.g. regional_lead" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              Note: assigning users to a custom role still requires it in the <code>app_role</code> enum.
              For built-in roles this works out-of-the-box.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addRole}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
