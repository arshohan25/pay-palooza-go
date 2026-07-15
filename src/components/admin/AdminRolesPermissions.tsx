import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus, Loader2, RefreshCw, Lock, Sparkles, ShieldAlert, Wand2, Pencil, Trash2, ArrowRight, History } from "lucide-react";
import { toast } from "sonner";
import { REGISTERED_PERMISSIONS, ROLE_KEYS, HIGH_RISK_PERMISSIONS } from "@/lib/permissionsRegistry";
import { usePermission } from "@/hooks/use-permission";
import PresetVersionHistoryDialog from "@/components/admin/PresetVersionHistoryDialog";

interface Row { role: string; permission: string; allowed: boolean; }
interface Preset { id: string; name: string; description: string | null; permissions: string[]; is_builtin: boolean; }
interface PendingReq { role: string; permission: string; allowed: boolean; reason: string; }

export default function AdminRolesPermissions() {
  const canManage = usePermission("manage_roles");
  const [rows, setRows] = useState<Row[]>([]);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetTarget, setPresetTarget] = useState<{ role: string; presetId: string }>({ role: "", presetId: "" });
  const [showDiff, setShowDiff] = useState(false);
  const [pendingReq, setPendingReq] = useState<PendingReq | null>(null);
  const [presetEditor, setPresetEditor] = useState<Preset | null>(null);
  const [editorDraft, setEditorDraft] = useState<{ name: string; description: string; permissions: Set<string> }>({ name: "", description: "", permissions: new Set() });
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [historyFor, setHistoryFor] = useState<Preset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: pdata }] = await Promise.all([
      supabase.from("admin_role_permissions" as any).select("role, permission, allowed"),
      supabase.from("admin_role_permission_presets" as any).select("id, name, description, permissions, is_builtin").order("is_builtin", { ascending: false }).order("name"),
    ]);
    const list = ((data ?? []) as any[]) as Row[];
    setRows(list);
    setPresets(((pdata ?? []) as any[]) as Preset[]);
    const extra = Array.from(new Set(list.map((r) => r.role))).filter((r) => !ROLE_KEYS.includes(r as any));
    setCustomRoles(extra);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("admin-arp-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_role_permissions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_role_permission_presets" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const roles = useMemo(() => [...ROLE_KEYS, ...customRoles], [customRoles]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const r of rows) (m[r.role] ??= {})[r.permission] = r.allowed;
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
    if (HIGH_RISK_PERMISSIONS.has(permission)) {
      setPendingReq({ role, permission, allowed, reason: "" });
      return;
    }
    const key = `${role}:${permission}`;
    setSaving(key);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("admin_role_permissions" as any)
      .upsert({ role, permission, allowed, updated_at: new Date().toISOString(), updated_by: session?.user?.id ?? null } as any, { onConflict: "role,permission" });
    if (error) {
      toast.error(error.message);
    } else {
      setRows((prev) => {
        const other = prev.filter((r) => !(r.role === role && r.permission === permission));
        return [...other, { role, permission, allowed }];
      });
      supabase.from("audit_logs").insert({
        actor_id: session?.user?.id ?? null,
        action: allowed ? "permission_granted" : "permission_revoked",
        entity_type: "permission", entity_id: null,
        details: { role, permission, allowed },
      } as any).then();
      toast.success(`${allowed ? "Granted" : "Revoked"} ${permission} for ${role}`);
    }
    setSaving(null);
  };

  const submitPendingRequest = async () => {
    if (!pendingReq) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error("Sign in required"); return; }
    const { error } = await supabase.from("permission_change_requests" as any).insert({
      role: pendingReq.role, permission: pendingReq.permission, allowed: pendingReq.allowed,
      reason: pendingReq.reason || null, requested_by: session.user.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    supabase.from("audit_logs").insert({
      actor_id: session.user.id, action: "permission_change_requested",
      entity_type: "permission", entity_id: null,
      details: { role: pendingReq.role, permission: pendingReq.permission, allowed: pendingReq.allowed },
    } as any).then();
    toast.success("Change requested — a second admin must approve it.");
    setPendingReq(null);
  };

  // Compute a preview diff for the currently selected preset+role.
  const diff = useMemo(() => {
    const preset = presets.find((p) => p.id === presetTarget.presetId);
    if (!preset || !presetTarget.role) return null;
    const want = new Set(preset.permissions || []);
    const grants: string[] = [];
    const revokes: string[] = [];
    const queued: string[] = [];
    const unchanged: string[] = [];
    for (const p of REGISTERED_PERMISSIONS) {
      const cur = matrix[presetTarget.role]?.[p.key] ?? false;
      const desired = want.has(p.key);
      if (cur === desired) { unchanged.push(p.key); continue; }
      if (HIGH_RISK_PERMISSIONS.has(p.key)) queued.push(`${desired ? "+" : "−"} ${p.key}`);
      else if (desired) grants.push(p.key);
      else revokes.push(p.key);
    }
    return { grants, revokes, queued, unchanged, preset };
  }, [presets, presetTarget, matrix]);

  const applyPreset = async () => {
    if (!canManage) { toast.error("Missing 'manage_roles' permission"); return; }
    if (!presetTarget.role || !presetTarget.presetId) { toast.error("Choose a role and preset"); return; }
    const preset = presets.find((p) => p.id === presetTarget.presetId);
    if (!preset) return;
    if (presetTarget.role === "admin") { toast.error("Admin already has everything"); return; }

    const { data: { session } } = await supabase.auth.getSession();
    const perms = (preset.permissions as string[]) || [];
    const immediate = REGISTERED_PERMISSIONS.filter((p) => !HIGH_RISK_PERMISSIONS.has(p.key));
    const risky = REGISTERED_PERMISSIONS.filter((p) => HIGH_RISK_PERMISSIONS.has(p.key));

    const upserts = immediate.map((p) => ({
      role: presetTarget.role, permission: p.key, allowed: perms.includes(p.key),
      updated_at: new Date().toISOString(), updated_by: session?.user?.id ?? null,
    }));
    const { error } = await supabase.from("admin_role_permissions" as any)
      .upsert(upserts as any, { onConflict: "role,permission" });
    if (error) { toast.error(error.message); return; }

    let queued = 0;
    for (const p of risky) {
      const current = matrix[presetTarget.role]?.[p.key] ?? false;
      const desired = perms.includes(p.key);
      if (current === desired) continue;
      await supabase.from("permission_change_requests" as any).insert({
        role: presetTarget.role, permission: p.key, allowed: desired,
        reason: `From preset "${preset.name}"`, requested_by: session?.user?.id,
      } as any);
      queued++;
    }
    supabase.from("audit_logs").insert({
      actor_id: session?.user?.id ?? null, action: "preset_applied",
      entity_type: "role", entity_id: null,
      details: { role: presetTarget.role, preset: preset.name, queued_for_approval: queued },
    } as any).then();
    toast.success(queued > 0
      ? `Preset applied — ${queued} high-risk change(s) queued for approval.`
      : `Preset "${preset.name}" applied to ${presetTarget.role}.`);
    setShowDiff(false);
    setPresetOpen(false);
    load();
  };

  const addRole = async () => {
    const name = newRole.trim().toLowerCase().replace(/\s+/g, "_");
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(name)) { toast.error("Use lowercase letters, numbers, underscore"); return; }
    if (roles.includes(name)) { toast.error("Role already exists"); return; }
    const { error } = await supabase.from("admin_role_permissions" as any).insert({
      role: name, permission: REGISTERED_PERMISSIONS[0].key, allowed: false,
    } as any);
    if (error) { toast.error(error.message); return; }
    const { data: { session } } = await supabase.auth.getSession();
    supabase.from("audit_logs").insert({
      actor_id: session?.user?.id ?? null, action: "role_added",
      entity_type: "role", entity_id: null, details: { role: name },
    } as any).then();
    setCustomRoles((c) => [...c, name]);
    setNewRole("");
    setAddOpen(false);
    toast.success(`Role "${name}" added — toggle permissions below.`);
  };

  // ---- Preset CRUD ---------------------------------------------------------
  const openCreatePreset = () => {
    setPresetEditor({ id: "", name: "", description: "", permissions: [], is_builtin: false });
    setEditorDraft({ name: "", description: "", permissions: new Set() });
  };
  const openEditPreset = (p: Preset) => {
    setPresetEditor(p);
    setEditorDraft({ name: p.name, description: p.description || "", permissions: new Set(p.permissions || []) });
  };
  const savePreset = async () => {
    const name = editorDraft.name.trim();
    if (!name) { toast.error("Name is required"); return; }
    const perms = Array.from(editorDraft.permissions);
    const { data: { session } } = await supabase.auth.getSession();
    if (presetEditor?.id) {
      const { error } = await supabase.from("admin_role_permission_presets" as any).update({
        name, description: editorDraft.description || null, permissions: perms,
      } as any).eq("id", presetEditor.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Preset updated");
    } else {
      const { error } = await supabase.from("admin_role_permission_presets" as any).insert({
        name, description: editorDraft.description || null, permissions: perms,
        is_builtin: false, created_by: session?.user?.id ?? null,
      } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Preset created");
    }
    setPresetEditor(null);
    load();
  };
  const confirmDeletePreset = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("admin_role_permission_presets" as any)
      .delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Preset deleted");
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="w-5 h-5 text-primary" /></div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-medium text-foreground">Roles &amp; Permissions</p>
            <p className="text-xs text-muted-foreground">Grant or revoke capabilities per role without editing code. Admin always has everything.</p>
          </div>
          {canManage === false && (<Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Read-only</Badge>)}
          <Button size="sm" variant="ghost" onClick={load} title="Reload"><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setPresetOpen(true)} disabled={!canManage} className="gap-1"><Wand2 className="w-4 h-4" /> Apply preset</Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!canManage} className="gap-1"><Plus className="w-4 h-4" /> Role</Button>
        </CardContent>
      </Card>

      {/* Presets list with CRUD */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Role presets</CardTitle>
          <Button size="sm" variant="outline" onClick={openCreatePreset} disabled={!canManage} className="gap-1"><Plus className="w-3 h-3" /> New preset</Button>
        </CardHeader>
        <CardContent className="p-0">
          {presets.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">No presets yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {presets.map((p) => (
                <div key={p.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {p.name}
                      {p.is_builtin && <Badge variant="outline" className="ml-2 text-[9px]">built-in</Badge>}
                    </p>
                    {p.description && <p className="text-[11px] text-muted-foreground">{p.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(p.permissions || []).map((k) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => setHistoryFor(p)} title="Version history">
                      <History className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEditPreset(p)} disabled={!canManage || p.is_builtin} title={p.is_builtin ? "Built-in presets cannot be edited" : "Edit"}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(p)} disabled={!canManage || p.is_builtin} title={p.is_builtin ? "Built-in presets cannot be deleted" : "Delete"}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{p.label}</p>
                              {p.highRisk && (<Badge variant="outline" className="gap-1 text-[10px] text-amber-600 border-amber-300"><ShieldAlert className="w-3 h-3" /> High-risk</Badge>)}
                            </div>
                            <p className="text-[11px] text-muted-foreground max-w-xs">{p.description}</p>
                            <code className="text-[10px] text-muted-foreground/70">{p.key}</code>
                          </td>
                          {roles.map((r) => {
                            const key = `${r}:${p.key}`;
                            const on = r === "admin" ? true : (matrix[r]?.[p.key] ?? false);
                            return (
                              <td key={r} className="p-2 text-center">
                                {saving === key ? (<Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                ) : (<Switch checked={on} disabled={r === "admin" || !canManage} onCheckedChange={(v) => toggle(r, p.key, v)} />)}
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

      {/* Add role */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add role</DialogTitle>
            <DialogDescription>Add a custom role key. Use lowercase letters and underscore.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role key</Label>
            <Input placeholder="e.g. regional_lead" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Note: assigning users to a custom role still requires it in the <code>app_role</code> enum.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addRole}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply preset dialog with diff preview */}
      <Dialog open={presetOpen} onOpenChange={(o) => { setPresetOpen(o); if (!o) setShowDiff(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Apply role template preset</DialogTitle>
            <DialogDescription>Pick a target role and preset. You'll see exactly what changes before applying.</DialogDescription>
          </DialogHeader>
          {!showDiff ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Target role</Label>
                <Select value={presetTarget.role} onValueChange={(v) => setPresetTarget((s) => ({ ...s, role: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose role…" /></SelectTrigger>
                  <SelectContent>
                    {roles.filter((r) => r !== "admin").map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Preset</Label>
                <Select value={presetTarget.presetId} onValueChange={(v) => setPresetTarget((s) => ({ ...s, presetId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose preset…" /></SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex flex-col">
                          <span>{p.name} {p.is_builtin && <Badge variant="outline" className="ml-1 text-[9px]">built-in</Badge>}</span>
                          {p.description && <span className="text-[10px] text-muted-foreground">{p.description}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Applying <strong>{diff?.preset.name}</strong> to <span className="capitalize">{presetTarget.role.replace(/_/g," ")}</span>:
              </p>
              <DiffSection title="Will grant" items={diff?.grants ?? []} tone="emerald" />
              <DiffSection title="Will revoke" items={diff?.revokes ?? []} tone="red" />
              <DiffSection title="Queued for second-admin approval" items={diff?.queued ?? []} tone="amber" />
              {diff && diff.grants.length === 0 && diff.revokes.length === 0 && diff.queued.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No changes — role already matches this preset.</p>
              )}
              <p className="text-[10px] text-muted-foreground">{diff?.unchanged.length ?? 0} permission(s) unchanged.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPresetOpen(false); setShowDiff(false); }}>Cancel</Button>
            {!showDiff ? (
              <Button onClick={() => {
                if (!presetTarget.role || !presetTarget.presetId) { toast.error("Choose role and preset"); return; }
                setShowDiff(true);
              }} className="gap-1">Preview changes <ArrowRight className="w-3 h-3" /></Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowDiff(false)}>Back</Button>
                <Button onClick={applyPreset} disabled={!diff || (diff.grants.length + diff.revokes.length + diff.queued.length === 0)}>Confirm &amp; apply</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preset create/edit */}
      <Dialog open={!!presetEditor} onOpenChange={(o) => !o && setPresetEditor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{presetEditor?.id ? "Edit preset" : "New preset"}</DialogTitle>
            <DialogDescription>Custom presets can be applied to any non-admin role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={editorDraft.name} onChange={(e) => setEditorDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Regional Lead" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={editorDraft.description} onChange={(e) => setEditorDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Short description" />
            </div>
            <div>
              <Label className="text-xs">Permissions</Label>
              <div className="mt-1 border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                {REGISTERED_PERMISSIONS.map((p) => {
                  const checked = editorDraft.permissions.has(p.key);
                  return (
                    <label key={p.key} className="flex items-start gap-2 p-2 hover:bg-muted/40 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={(v) => {
                        setEditorDraft((d) => {
                          const s = new Set(d.permissions);
                          if (v) s.add(p.key); else s.delete(p.key);
                          return { ...d, permissions: s };
                        });
                      }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{p.label} {p.highRisk && <Badge variant="outline" className="ml-1 text-[9px] text-amber-600 border-amber-300">high-risk</Badge>}</p>
                        <p className="text-[10px] text-muted-foreground">{p.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPresetEditor(null)}>Cancel</Button>
            <Button onClick={savePreset}>{presetEditor?.id ? "Save changes" : "Create preset"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete preset confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the preset for everyone. Role permissions already applied from it are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePreset} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* High-risk change request dialog */}
      <Dialog open={!!pendingReq} onOpenChange={(o) => !o && setPendingReq(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><ShieldAlert className="w-4 h-4" /> Requires second-admin approval</DialogTitle>
            <DialogDescription>
              <code className="text-xs">{pendingReq?.permission}</code> for <span className="font-medium capitalize">{pendingReq?.role?.replace(/_/g, " ")}</span> is a high-risk permission. Submit this change for review by another admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea rows={3} placeholder="Why is this change needed?" value={pendingReq?.reason ?? ""}
              onChange={(e) => setPendingReq((p) => p ? { ...p, reason: e.target.value } : p)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingReq(null)}>Cancel</Button>
            <Button onClick={submitPendingRequest}>Submit for approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiffSection({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "red" | "amber" }) {
  if (items.length === 0) return null;
  const cls = tone === "emerald" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
    : tone === "red" ? "bg-red-500/10 text-red-700 border-red-500/30"
    : "bg-amber-500/10 text-amber-700 border-amber-500/30";
  return (
    <div>
      <p className="text-xs font-medium mb-1">{title} ({items.length})</p>
      <div className="flex flex-wrap gap-1">
        {items.map((k) => <Badge key={k} variant="outline" className={`text-[10px] ${cls}`}>{k}</Badge>)}
      </div>
    </div>
  );
}
