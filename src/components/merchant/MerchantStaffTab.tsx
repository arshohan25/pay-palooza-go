import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Shield, Trash2, LinkIcon, AlertTriangle, Send, SlidersHorizontal, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import {
  STAFF_PERMISSION_GROUPS,
  STAFF_PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_DEFAULTS,
  defaultPermissionsFor,
  expandImplies,
  countActive,
  type StaffRole,
} from "@/lib/staffPermissions";

const roleColors: Record<string, string> = {
  Manager: "bg-primary/10 text-primary border-primary/20",
  Cashier: "bg-blue-500/10 text-blue-700 border-blue-200",
  Viewer: "bg-muted text-muted-foreground border-border",
};

const roles: StaffRole[] = ["Manager", "Cashier", "Viewer"];

interface Props { merchantId: string; }

function PermissionPicker({
  value,
  onChange,
  role,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  role: StaffRole;
}) {
  const active = countActive(value);
  const total = PERMISSION_KEYS.length;

  const toggle = (key: string, checked: boolean) => {
    const set = new Set(Object.entries(value).filter(([, v]) => v).map(([k]) => k));
    if (checked) set.add(key);
    else set.delete(key);
    const expanded = checked ? expandImplies(set) : set;
    const next: Record<string, boolean> = {};
    for (const k of PERMISSION_KEYS) next[k] = expanded.has(k);
    onChange(next);
  };

  const applyPreset = () => {
    onChange(defaultPermissionsFor(role));
    toast.success(`Applied ${role} preset`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{active}</span> of {total} features granted
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={applyPreset}>
          <RefreshCw size={12} className="mr-1" /> Reset to {role} preset
        </Button>
      </div>

      <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {STAFF_PERMISSION_GROUPS.map(([group, perms]) => (
          <div key={group} className="rounded-xl border border-border/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{group}</p>
            <div className="space-y-2">
              {perms.map(p => {
                const checked = !!value[p.key];
                return (
                  <label key={p.key} className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => toggle(p.key, c === true)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-foreground">{p.label}</p>
                        {p.implies && p.implies.length > 0 && checked && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">+ view</Badge>
                        )}
                      </div>
                      {p.hint && <p className="text-[10px] text-muted-foreground leading-tight">{p.hint}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MerchantStaffTab({ merchantId }: Props) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("Cashier");
  const [perms, setPerms] = useState<Record<string, boolean>>(() => defaultPermissionsFor("Cashier"));
  const [saving, setSaving] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState<{ status: "idle" | "checking" | "found" | "missing"; name: string | null }>({ status: "idle", name: null });
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // When role changes inside Add sheet, refresh defaults.
  useEffect(() => {
    if (showAdd) setPerms(defaultPermissionsFor(role));
  }, [role, showAdd]);

  const sendInvite = async (staff_id: string, opts?: { silent?: boolean }) => {
    setResendingId(staff_id);
    const { data, error } = await supabase.functions.invoke("notify-staff-invite", { body: { staff_id } });
    setResendingId(null);
    if (error) {
      const ctx: any = (error as any).context;
      try {
        const body = ctx ? await ctx.json() : null;
        if (body?.cooldown) { toast.error(body.message || "Please wait before resending."); return; }
      } catch (_) { /* ignore */ }
      if (!opts?.silent) toast.error(error.message || "Failed to send invite");
      return;
    }
    if (!opts?.silent) {
      const r = (data as any)?.results || {};
      const channels: string[] = [];
      if (r.push?.sent > 0) channels.push("push");
      if (r.sms?.status === "sent") channels.push("SMS");
      if (r.email?.status === "sent") channels.push("email");
      toast.success(channels.length ? `Invite sent via ${channels.join(", ")}` : "Invite logged (no channels available)");
    }
  };

  useEffect(() => {
    if (!showAdd) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 11) { setPhoneLookup({ status: "idle", name: null }); return; }
    setPhoneLookup({ status: "checking", name: null });
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("lookup_easypay_user_by_phone", { p_phone: digits });
      const row = Array.isArray(data) ? data[0] : null;
      if (row?.found) {
        setPhoneLookup({ status: "found", name: row.full_name });
        setName(prev => prev.trim() ? prev : (row.full_name || ""));
      } else {
        setPhoneLookup({ status: "missing", name: null });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, showAdd]);

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("merchant_staff")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
    const channel = supabase
      .channel("merchant_staff_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_staff", filter: `merchant_id=eq.${merchantId}` }, () => fetchStaff())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId]);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("merchant_staff")
      .insert({ merchant_id: merchantId, name: name.trim(), phone: phone.trim(), role, permissions: perms as any })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (data?.user_id) {
      toast.success("Staff added & linked to EasyPay account");
    } else {
      toast.success("Staff added (not yet on EasyPay)");
    }
    if (data?.id) sendInvite(data.id, { silent: true });
    setShowAdd(false); setName(""); setPhone(""); setRole("Cashier"); setPerms(defaultPermissionsFor("Cashier")); setPhoneLookup({ status: "idle", name: null });
  };

  const openEdit = (s: any) => {
    setEditing(s);
    const p = (s.permissions ?? {}) as Record<string, boolean>;
    // Ensure all keys present
    const init: Record<string, boolean> = {};
    for (const k of PERMISSION_KEYS) init[k] = !!p[k];
    setEditPerms(init);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("merchant_staff")
      .update({ permissions: editPerms as any })
      .eq("id", editing.id);
    setSavingEdit(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Permissions updated");
    setEditing(null);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("merchant_staff").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteStaff = async (id: string) => {
    const { error } = await supabase.from("merchant_staff").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Staff removed");
  };

  const activeCount = staff.filter(s => s.is_active).length;
  const linkedCount = staff.filter(s => s.user_id).length;

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" /> Staff Accounts
        </h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowAdd(true)}>
          <Plus size={13} className="mr-1" /> Add Staff
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{staff.length}</p><p className="text-[10px] text-muted-foreground">Total Staff</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">{activeCount}</p><p className="text-[10px] text-muted-foreground">Active</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-blue-600">{linkedCount}</p><p className="text-[10px] text-muted-foreground">Linked</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-elevated">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center gap-2"><Shield size={14} className="text-primary" /><p className="text-xs font-semibold text-foreground">Role Presets</p></div>
          <p className="text-[10px] text-muted-foreground">Pick a role to pre-fill defaults, then fine-tune feature access for each person.</p>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground pt-1">
            <div><p className="font-semibold text-foreground">Manager</p><p>{ROLE_DEFAULTS.Manager.length} features</p></div>
            <div><p className="font-semibold text-foreground">Cashier</p><p>{ROLE_DEFAULTS.Cashier.length} features</p></div>
            <div><p className="font-semibold text-foreground">Viewer</p><p>{ROLE_DEFAULTS.Viewer.length} features</p></div>
          </div>
        </CardContent>
      </Card>

      {staff.length === 0 ? (
        <Card className="border-0 shadow-elevated"><CardContent className="p-8 text-center text-muted-foreground text-xs">No staff added yet. Tap "Add Staff" to get started.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {staff.map(s => {
            const granted = countActive(s.permissions);
            return (
              <Card key={s.id} className="border-0 shadow-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold text-foreground shrink-0">{s.name.charAt(0)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                          {s.user_id ? (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                              <LinkIcon size={8} className="mr-0.5" />Linked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-200">
                              <AlertTriangle size={8} className="mr-0.5" />Not on EasyPay
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{s.phone}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className={`text-[9px] ${roleColors[s.role] || ""}`}>{s.role}</Badge>
                          <span className="text-[10px] text-muted-foreground">· {granted} feature{granted === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground" title="Edit permissions" onClick={() => openEdit(s)}>
                        <SlidersHorizontal size={13} />
                      </Button>
                      <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Resend invite" disabled={resendingId === s.id} onClick={() => sendInvite(s.id)}><Send size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteStaff(s.id)}><Trash2 size={13} /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Staff sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent side="bottom" className="rounded-t-2xl z-[80] max-h-[92vh] overflow-y-auto" overlayClassName="z-[80]">
          <SheetHeader><SheetTitle>Add Staff Member</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Staff name" /></div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="numeric" />
              {phoneLookup.status === "checking" && <p className="text-[10px] text-muted-foreground mt-1">Checking EasyPay…</p>}
              {phoneLookup.status === "found" && (
                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                  <LinkIcon size={10} /> On EasyPay{phoneLookup.name ? ` — ${phoneLookup.name}` : ""}. They'll get instant access.
                </p>
              )}
              {phoneLookup.status === "missing" && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> Not on EasyPay yet. They'll be linked automatically when they sign up.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Role preset</Label>
              <div className="flex gap-2 mt-1">
                {roles.map(r => (
                  <Button key={r} size="sm" variant={role === r ? "default" : "outline"} className="text-xs flex-1" onClick={() => setRole(r)}>{r}</Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1.5">
                <SlidersHorizontal size={12} /> Feature access
              </Label>
              <div className="mt-2">
                <PermissionPicker value={perms} onChange={setPerms} role={role} />
              </div>
            </div>

            <Button className="w-full" disabled={saving} onClick={handleAdd}>
              {saving ? "Adding..." : `Add Staff · ${countActive(perms)} feature${countActive(perms) === 1 ? "" : "s"}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Permissions sheet */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl z-[80] max-h-[92vh] overflow-y-auto" overlayClassName="z-[80]">
          <SheetHeader>
            <SheetTitle>Permissions · {editing?.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2">
              <div className="text-[11px]">
                <p className="font-semibold text-foreground">{editing?.role} role</p>
                <p className="text-muted-foreground">Changes apply instantly — no logout needed.</p>
              </div>
              <Badge variant="outline" className={`text-[9px] ${roleColors[editing?.role] || ""}`}>{editing?.role}</Badge>
            </div>
            {editing && (
              <PermissionPicker value={editPerms} onChange={setEditPerms} role={editing.role as StaffRole} />
            )}
            <Button className="w-full" disabled={savingEdit} onClick={saveEdit}>
              {savingEdit ? "Saving..." : `Save · ${countActive(editPerms)} feature${countActive(editPerms) === 1 ? "" : "s"}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
