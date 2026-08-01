import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ShieldCheck, UserCog, History } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";

export const KYC_STATUSES = ["not_submitted", "pending", "verified", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

const STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not submitted",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

const statusClass = (s?: string | null) =>
  s === "verified"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : s === "rejected"
      ? "bg-red-500/10 text-red-600 border-red-500/30"
      : s === "pending"
        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
        : "bg-muted text-muted-foreground";

interface Target {
  user_id: string;
  name: string | null;
  phone: string;
  easypay_uid: string | null;
  roles: string[];
  kyc_status: string;
}

interface AuditRow {
  id: string;
  previous_status: string | null;
  new_status: string;
  reviewer_notes: string | null;
  changed_by_role: string | null;
  created_at: string;
}

interface Props {
  /** When provided the search box is hidden and this account is managed directly. */
  userId?: string;
  compact?: boolean;
  onChanged?: (status: KycStatus) => void;
}

/**
 * Admin control to assign or change the KYC status of ANY account — customer,
 * agent, merchant, distributor, super distributor or staff. Backed by the
 * admin-only `admin_set_kyc_status` RPC which writes a full audit trail.
 */
export default function AdminKycStatusManager({ userId, compact, onChanged }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Target[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [status, setStatus] = useState<KycStatus>("verified");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const hydrate = useCallback(async (profiles: any[]): Promise<Target[]> => {
    const ids = profiles.map((p) => p.user_id);
    if (!ids.length) return [];
    const [{ data: roles }, { data: kyc }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      supabase
        .from("kyc_verifications")
        .select("user_id, status, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false }),
    ]);
    const roleMap: Record<string, string[]> = {};
    for (const r of (roles ?? []) as any[]) (roleMap[r.user_id] ||= []).push(r.role);
    const kycMap: Record<string, string> = {};
    for (const k of (kyc ?? []) as any[]) if (!kycMap[k.user_id]) kycMap[k.user_id] = k.status;
    return profiles.map((p) => ({
      user_id: p.user_id,
      name: p.name,
      phone: p.phone,
      easypay_uid: p.easypay_uid,
      roles: roleMap[p.user_id] ?? ["customer"],
      kyc_status: kycMap[p.user_id] ?? "not_submitted",
    }));
  }, []);

  const loadAudit = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("kyc_status_audit")
      .select("id, previous_status, new_status, reviewer_notes, changed_by_role, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(15);
    setAudit(((data ?? []) as any[]) as AuditRow[]);
  }, []);

  const selectTarget = useCallback(
    async (t: Target) => {
      setTarget(t);
      setResults([]);
      setNotes("");
      setStatus((KYC_STATUSES as readonly string[]).includes(t.kyc_status) ? (t.kyc_status as KycStatus) : "pending");
      await loadAudit(t.user_id);
    },
    [loadAudit],
  );

  // Direct mode — a specific account was passed in.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, phone, easypay_uid")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        const [t] = await hydrate([data]);
        if (t) await selectTarget(t);
      }
      setSearching(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      toast.error("Enter at least 3 characters (phone, name or EP UID)");
      return;
    }
    setSearching(true);
    setTarget(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, phone, easypay_uid")
      .or(`phone.ilike.%${q}%,name.ilike.%${q}%,easypay_uid.ilike.%${q}%`)
      .limit(25);
    if (error) toast.error(error.message);
    const list = await hydrate((data ?? []) as any[]);
    setResults(list);
    if (list.length === 0) toast.info("No matching account");
    setSearching(false);
  };

  const apply = async () => {
    if (!target) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_kyc_status" as any, {
      _user_id: target.user_id,
      _status: status,
      _notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`KYC set to ${STATUS_LABEL[status]}`);
    setTarget({ ...target, kyc_status: status });
    setNotes("");
    onChanged?.(status);
    await loadAudit(target.user_id);
  };

  const dirty = useMemo(() => !!target && (status !== target.kyc_status || notes.trim().length > 0), [target, status, notes]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="w-4 h-4 text-primary" /> KYC status override
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Assign or change the KYC status of any account — customer, agent, merchant, distributor or SD. Every change is audited.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!userId && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search by phone, name or EP UID"
                className="pl-9"
              />
            </div>
            <Button onClick={runSearch} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className="divide-y divide-border rounded-2xl border border-border/60">
            {results.map((r) => (
              <button
                key={r.user_id}
                onClick={() => selectTarget(r)}
                className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name || "Unnamed"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.phone} {r.easypay_uid ? `· ${r.easypay_uid}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {r.roles.map((role) => (
                    <Badge key={role} variant="secondary" className="text-[9px] capitalize">
                      {role.replace(/_/g, " ")}
                    </Badge>
                  ))}
                  <Badge variant="outline" className={`text-[9px] ${statusClass(r.kyc_status)}`}>
                    {STATUS_LABEL[r.kyc_status] ?? r.kyc_status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {target && (
          <div className="space-y-3 rounded-2xl border border-border/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">{target.name || "Unnamed"}</p>
              <span className="text-[11px] text-muted-foreground">{target.phone}</span>
              {target.roles.map((role) => (
                <Badge key={role} variant="secondary" className="text-[9px] capitalize">
                  {role.replace(/_/g, " ")}
                </Badge>
              ))}
              <Badge variant="outline" className={`text-[10px] ${statusClass(target.kyc_status)}`}>
                Current: {STATUS_LABEL[target.kyc_status] ?? target.kyc_status}
              </Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
              <Select value={status} onValueChange={(v) => setStatus(v as KycStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KYC_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                rows={compact ? 2 : 3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason / reviewer note (recommended)"
              />
            </div>

            <div className="flex justify-end gap-2">
              {!userId && (
                <Button variant="ghost" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
              )}
              <Button onClick={apply} disabled={saving || !dirty}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply KYC status"}
              </Button>
            </div>

            {audit.length > 0 && (
              <div className="space-y-1 border-t border-border/60 pt-2">
                <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <History className="h-3 w-3" /> Change history
                </p>
                {audit.map((a) => (
                  <p key={a.id} className="text-[11px] text-muted-foreground">
                    {STATUS_LABEL[a.previous_status ?? "not_submitted"] ?? a.previous_status ?? "—"} →{" "}
                    <span className="text-foreground">{STATUS_LABEL[a.new_status] ?? a.new_status}</span>{" "}
                    · {a.changed_by_role || "system"} ·{" "}
                    {formatDistanceToNowStrict(new Date(a.created_at), { addSuffix: true })}
                    {a.reviewer_notes ? ` · "${a.reviewer_notes}"` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {!target && results.length === 0 && !searching && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {userId ? "No profile found for this account." : "Search for an account to manage its KYC status."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
