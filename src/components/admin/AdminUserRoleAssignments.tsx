import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Shield, Loader2, UserCog, Lock, Users, UserPlus, AlertTriangle,
  Sparkles, KeyRound, Save, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePermission } from "@/hooks/use-permission";

/** All roles the admin can assign. Order = privilege priority (highest first). */
const ALL_ROLES = [
  "admin", "compliance", "finance", "risk", "audit", "operations",
  "manager", "developer", "support", "marketing", "hr",
  "super_distributor", "distributor", "merchant", "agent", "customer",
] as const;
type AppRole = (typeof ALL_ROLES)[number];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin", compliance: "Compliance", finance: "Finance", risk: "Risk",
  audit: "Audit", operations: "Operations", manager: "Manager", developer: "Developer",
  support: "Support", marketing: "Marketing", hr: "HR",
  super_distributor: "Super Distributor", distributor: "Distributor",
  merchant: "Merchant", agent: "Agent", customer: "General User",
};

interface ProfileHit { user_id: string; name: string | null; phone: string; }
interface AssignedRow { user_id: string; role: AppRole; name: string | null; phone: string | null; }
interface RoleRule {
  id?: string;
  role: AppRole;
  badge_label: string | null;
  badge_color: string | null;
  daily_txn_limit: number | null;
  monthly_txn_limit: number | null;
  per_txn_limit: number | null;
  daily_cashin_limit: number | null;
  daily_cashout_limit: number | null;
  is_active: boolean;
}

const normPhone = (v: string) => v.replace(/\D/g, "");

async function logAudit(action: string, details: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  await supabase.from("audit_logs").insert({
    actor_id: session.user.id, action, entity_type: "user_role", entity_id: null, details,
  } as any);
}

export default function AdminUserRoleAssignments() {
  const canManage = usePermission("manage_roles");
  const readOnly = canManage === false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden border-primary/10">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Role Control Center</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                One role per user. Everyone is a General User by default — assigning a role grants an identity badge and higher limits configured below.
              </p>
            </div>
            {readOnly && (
              <Badge variant="outline" className="gap-1 shrink-0"><Lock className="w-3 h-3" /> Read-only</Badge>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="assign" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="assign"><UserCog className="w-3.5 h-3.5 mr-1.5" />Assign</TabsTrigger>
          <TabsTrigger value="directory"><Users className="w-3.5 h-3.5 mr-1.5" />Directory</TabsTrigger>
          <TabsTrigger value="rules"><Shield className="w-3.5 h-3.5 mr-1.5" />Role Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="assign" className="mt-4"><AssignPanel readOnly={readOnly} /></TabsContent>
        <TabsContent value="directory" className="mt-4"><DirectoryPanel readOnly={readOnly} /></TabsContent>
        <TabsContent value="rules" className="mt-4"><RulesPanel readOnly={readOnly} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ═════════════════════════════════════ ASSIGN ═════════════════════════════════════ */

function AssignPanel({ readOnly }: { readOnly: boolean }) {
  const [phoneInput, setPhoneInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [lookup, setLookup] = useState<
    | null
    | { kind: "found"; profile: ProfileHit; currentRole: AppRole | null }
    | { kind: "not_found"; phone: string }
  >(null);
  const [role, setRole] = useState<AppRole | "">("");
  const [name, setName] = useState("");
  const [tempPin, setTempPin] = useState("1122");
  const [busy, setBusy] = useState(false);
  const [provisionOpen, setProvisionOpen] = useState(false);

  const runLookup = useCallback(async () => {
    const p = normPhone(phoneInput);
    if (p.length < 10) { toast.error("Enter a valid phone number"); return; }
    setChecking(true);
    setLookup(null);
    const { data: profile } = await supabase
      .from("profiles").select("user_id, name, phone").eq("phone", p).maybeSingle();
    if (!profile) {
      setLookup({ kind: "not_found", phone: p });
    } else {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", profile.user_id).maybeSingle();
      setLookup({
        kind: "found",
        profile: profile as ProfileHit,
        currentRole: (roleRow?.role ?? null) as AppRole | null,
      });
    }
    setChecking(false);
  }, [phoneInput]);

  const assignExisting = async () => {
    if (!lookup || lookup.kind !== "found" || !role) return;
    setBusy(true);
    const { error } = await supabase.rpc("assign_single_role" as any, {
      _user_id: lookup.profile.user_id,
      _role: role as any,
    });
    setBusy(false);
    if (error) { toast.error(error.message || "Role assignment rejected"); return; }
    toast.success(`Assigned ${ROLE_LABEL[role as AppRole]}.`);
    await logAudit("role_assigned_single_ui", { user_id: lookup.profile.user_id, role });
    runLookup();
  };

  const provisionAndAssign = async () => {
    if (!lookup || lookup.kind !== "not_found" || !role) return;
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-provision-role-account`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ phone: lookup.phone, role, name: name || null, temp_pin: tempPin }),
      },
    );
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(out.error ?? "Provisioning failed"); return; }
    toast.success(out.message ?? "Account created and role assigned.");
    setProvisionOpen(false);
    setPhoneInput(""); setLookup(null); setRole(""); setName("");
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
      {/* Left: phone lookup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> Look up by phone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="01XXXXXXXXX"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runLookup()}
              inputMode="tel"
            />
            <Button onClick={runLookup} disabled={checking || readOnly}>
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
            </Button>
          </div>

          {lookup?.kind === "found" && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-sm font-medium">Account found</p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p><span className="text-foreground font-medium">{lookup.profile.name || "Unnamed"}</span> · {lookup.profile.phone}</p>
                <p className="mt-1">
                  Current role:{" "}
                  {lookup.currentRole
                    ? <Badge variant="secondary" className="capitalize">{ROLE_LABEL[lookup.currentRole]}</Badge>
                    : <Badge variant="outline">General User</Badge>}
                </p>
              </div>
            </div>
          )}

          {lookup?.kind === "not_found" && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-medium">No account for this number</p>
              </div>
              <p className="text-xs text-muted-foreground">
                You can't assign a role to an unregistered phone. Provision an account with a temporary PIN — the user must reset it on first login.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setProvisionOpen(true)}
                disabled={readOnly}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Provision account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: role picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Choose a role
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {ALL_ROLES.map((r) => {
              const selected = role === r;
              const isCurrent = lookup?.kind === "found" && lookup.currentRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setRole(r)}
                  className={[
                    "text-left rounded-xl border p-2.5 transition text-xs",
                    selected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border hover:bg-muted/50",
                    isCurrent && "ring-1 ring-emerald-500/50",
                  ].filter(Boolean).join(" ")}
                >
                  <div className="font-medium text-foreground">{ROLE_LABEL[r]}</div>
                  {isCurrent && <div className="text-[10px] text-emerald-500 mt-0.5">Current</div>}
                </button>
              );
            })}
          </div>

          <div className="pt-1">
            {lookup?.kind === "found" ? (
              <Button
                className="w-full"
                onClick={assignExisting}
                disabled={!role || busy || readOnly || role === lookup.currentRole}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" />
                  : role === lookup.currentRole ? "User already has this role"
                  : `Assign ${role ? ROLE_LABEL[role as AppRole] : "role"} (replaces current)`}
              </Button>
            ) : lookup?.kind === "not_found" ? (
              <Button className="w-full" disabled variant="secondary">
                Provision account first
              </Button>
            ) : (
              <Button className="w-full" disabled variant="secondary">
                Look up a phone number to continue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Provision dialog */}
      <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Provision new account
            </DialogTitle>
            <DialogDescription>
              Creates an account for {lookup?.kind === "not_found" ? lookup.phone : ""} with a temporary PIN.
              The user must reset the PIN on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Full name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahim Uddin" />
            </div>
            <div>
              <Label className="text-xs">Temporary PIN (4–6 digits)</Label>
              <Input value={tempPin} onChange={(e) => setTempPin(e.target.value)} inputMode="numeric" maxLength={6} />
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> Share this with the user securely.
              </p>
            </div>
            <div>
              <Label className="text-xs">Role to assign</Label>
              <div className="mt-1 rounded-lg border p-2 text-xs bg-muted/30">
                {role ? ROLE_LABEL[role as AppRole] : <span className="text-muted-foreground">Pick a role in the right panel first.</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProvisionOpen(false)}>Cancel</Button>
            <Button onClick={provisionAndAssign} disabled={!role || busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create & assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═════════════════════════════════════ DIRECTORY ═════════════════════════════════════ */

function DirectoryPanel({ readOnly }: { readOnly: boolean }) {
  const [rows, setRows] = useState<AssignedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
    const list = (roleRows ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    let profs: any[] = [];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", ids);
      profs = data ?? [];
    }
    const byId: Record<string, any> = Object.fromEntries(profs.map((p) => [p.user_id, p]));
    setRows(list.map((r) => ({
      user_id: r.user_id, role: r.role,
      name: byId[r.user_id]?.name ?? null, phone: byId[r.user_id]?.phone ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("admin-role-directory-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.name ?? "").toLowerCase().includes(s) ||
      (r.phone ?? "").includes(s) ||
      r.role.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const revoke = async (userId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    await logAudit("role_revoked_single_ui", { user_id: userId });
    toast.success("Role revoked — user is now a General User.");
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Users with an assigned role ({rows.length})</CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="pl-8 h-8 w-48 text-xs" />
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
                  <TableHead>Role</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No matches.
                  </TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{r.name || "Unnamed"}</p>
                      <p className="text-[11px] text-muted-foreground">{r.phone || r.user_id.slice(0, 8)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{ROLE_LABEL[r.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                        onClick={() => revoke(r.user_id)} disabled={readOnly}>
                        <XCircle className="w-3 h-3 mr-1" /> Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/* ═════════════════════════════════════ RULES ═════════════════════════════════════ */

function RulesPanel({ readOnly }: { readOnly: boolean }) {
  const [rules, setRules] = useState<Record<AppRole, RoleRule>>(() =>
    Object.fromEntries(ALL_ROLES.map((r) => [r, blankRule(r)])) as any,
  );
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<AppRole | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("role_limit_overrides").select("*");
    const map: Record<AppRole, RoleRule> = Object.fromEntries(
      ALL_ROLES.map((r) => [r, blankRule(r)]),
    ) as any;
    (data ?? []).forEach((row: any) => {
      if (ALL_ROLES.includes(row.role)) map[row.role as AppRole] = { ...blankRule(row.role), ...row };
    });
    setRules(map);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = (role: AppRole, changes: Partial<RoleRule>) =>
    setRules((prev) => ({ ...prev, [role]: { ...prev[role], ...changes } }));

  const save = async (role: AppRole) => {
    setSavingRole(role);
    const r = rules[role];
    const payload = {
      role, badge_label: r.badge_label, badge_color: r.badge_color,
      daily_txn_limit: r.daily_txn_limit, monthly_txn_limit: r.monthly_txn_limit,
      per_txn_limit: r.per_txn_limit, daily_cashin_limit: r.daily_cashin_limit,
      daily_cashout_limit: r.daily_cashout_limit, is_active: r.is_active,
    };
    const { error } = await supabase.from("role_limit_overrides").upsert(payload as any, { onConflict: "role" });
    setSavingRole(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ROLE_LABEL[role]} rules saved.`);
    await logAudit("role_rule_saved", { role, payload });
    load();
  };

  if (loading) {
    return <Card><CardContent className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ALL_ROLES.map((role) => {
        const r = rules[role];
        return (
          <Card key={role} className="overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: r.badge_color || "hsl(var(--muted))" }}
                >
                  <Shield className="w-4 h-4 text-primary-foreground opacity-90" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm truncate">{ROLE_LABEL[role]}</CardTitle>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Badge: {r.badge_label || ROLE_LABEL[role]}
                  </p>
                </div>
              </div>
              <Switch
                checked={r.is_active}
                onCheckedChange={(v) => patch(role, { is_active: v })}
                disabled={readOnly}
                aria-label="Active"
              />
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Badge label" v={r.badge_label ?? ""} onChange={(v) => patch(role, { badge_label: v || null })} readOnly={readOnly} />
                <Field label="Badge color (hex/hsl)" v={r.badge_color ?? ""} onChange={(v) => patch(role, { badge_color: v || null })} readOnly={readOnly} placeholder="#22c55e" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="Per txn" v={r.per_txn_limit} onChange={(v) => patch(role, { per_txn_limit: v })} readOnly={readOnly} />
                <NumField label="Daily" v={r.daily_txn_limit} onChange={(v) => patch(role, { daily_txn_limit: v })} readOnly={readOnly} />
                <NumField label="Monthly" v={r.monthly_txn_limit} onChange={(v) => patch(role, { monthly_txn_limit: v })} readOnly={readOnly} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="Daily cash-in" v={r.daily_cashin_limit} onChange={(v) => patch(role, { daily_cashin_limit: v })} readOnly={readOnly} />
                <NumField label="Daily cash-out" v={r.daily_cashout_limit} onChange={(v) => patch(role, { daily_cashout_limit: v })} readOnly={readOnly} />
              </div>
              <Button size="sm" className="w-full h-8 text-xs" onClick={() => save(role)}
                disabled={savingRole === role || readOnly}>
                {savingRole === role ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save {ROLE_LABEL[role]} rules</>}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function blankRule(role: AppRole): RoleRule {
  return {
    role,
    badge_label: ROLE_LABEL[role],
    badge_color: null,
    daily_txn_limit: null,
    monthly_txn_limit: null,
    per_txn_limit: null,
    daily_cashin_limit: null,
    daily_cashout_limit: null,
    is_active: true,
  };
}

function Field({ label, v, onChange, readOnly, placeholder }:
  { label: string; v: string; onChange: (v: string) => void; readOnly?: boolean; placeholder?: string }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input value={v} onChange={(e) => onChange(e.target.value)} readOnly={readOnly}
        placeholder={placeholder} className="h-8 text-xs" />
    </div>
  );
}
function NumField({ label, v, onChange, readOnly }:
  { label: string; v: number | null; onChange: (v: number | null) => void; readOnly?: boolean }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        value={v ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Number(raw));
        }}
        inputMode="decimal"
        readOnly={readOnly}
        className="h-8 text-xs"
        placeholder="—"
      />
    </div>
  );
}
