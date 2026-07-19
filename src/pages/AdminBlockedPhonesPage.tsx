import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert, Search, Unlock, History, Info, Users, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Blocked = {
  phone: string;
  deleted_user_id: string | null;
  original_user_id: string | null;
  name: string | null;
  deleted_at: string;
  deletion_reason: string | null;
  deleted_by: string | null;
  deleted_by_name: string | null;
  last_unblock_attempt: string | null;
};

type AuditRow = {
  id: string;
  phone: string;
  admin_id: string;
  reason: string;
  created_at: string;
};

export default function AdminBlockedPhonesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Blocked | null>(null);
  const [details, setDetails] = useState<Blocked | null>(null);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const { data: blocked = [], isLoading } = useQuery({
    queryKey: ["admin-blocked-phones"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_blocked_phones");
      if (error) throw error;
      return (data ?? []) as Blocked[];
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["phone-unblock-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_unblock_audit")
        .select("id, phone, admin_id, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const { data: phoneHistory = [], isLoading: phoneHistoryLoading } = useQuery({
    queryKey: ["phone-unblock-history", details?.phone],
    enabled: !!details?.phone,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_unblock_audit")
        .select("id, phone, admin_id, reason, created_at")
        .eq("phone", details!.phone)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const adminIds = useMemo(
    () => Array.from(new Set(phoneHistory.map((h) => h.admin_id))),
    [phoneHistory]
  );

  const { data: adminNames = {} } = useQuery({
    queryKey: ["phone-unblock-admin-names", adminIds],
    enabled: adminIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", adminIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.user_id] = p.name ?? "Unknown"; });
      return map;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-blocked-phones"] });
    qc.invalidateQueries({ queryKey: ["phone-unblock-audit"] });
    qc.invalidateQueries({ queryKey: ["phone-unblock-history"] });
  };

  const unblock = useMutation({
    mutationFn: async ({ phone, reason }: { phone: string; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_unblock_phone", {
        _phone: phone,
        _reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Phone unblocked", description: "The number can now be used to create a new account." });
      setTarget(null);
      setReason("");
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Unblock failed", description: e.message ?? String(e), variant: "destructive" });
    },
  });

  const bulkUnblock = useMutation({
    mutationFn: async ({ phones, reason }: { phones: string[]; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_bulk_unblock_phones" as any, {
        _phones: phones,
        _reason: reason,
      });
      if (error) throw error;
      return {
        requested: phones.length,
        unblocked: (data as any)?.unblocked ?? 0,
        failed: ((data as any)?.failed ?? []) as Array<{ phone: string; error: string }>,
      };
    },
    onMutate: ({ phones }) => {
      toast({
        title: "Bulk unblock started",
        description: `Processing ${phones.length} phone number(s)…`,
      });
    },
    onSuccess: (res) => {
      const { requested, unblocked, failed } = res;
      const failedCount = failed.length;
      const allOk = failedCount === 0 && unblocked === requested;
      const noneOk = unblocked === 0;
      const sampleFailures = failed.slice(0, 3).map((f) => `${f.phone}: ${f.error}`).join(" · ");

      toast({
        title: allOk
          ? `Unblocked ${unblocked}/${requested}`
          : noneOk
          ? `Bulk unblock failed (0/${requested})`
          : `Partial success: ${unblocked}/${requested} unblocked`,
        description: allOk
          ? "All selected numbers were unblocked and audited."
          : `${failedCount} failed${sampleFailures ? ` — ${sampleFailures}` : ""}${
              failedCount > 3 ? ` (+${failedCount - 3} more)` : ""
            }`,
        variant: allOk ? "default" : "destructive",
      });

      if (unblocked > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          const failedPhones = new Set(failed.map((f) => f.phone));
          [...next].forEach((p) => { if (!failedPhones.has(p)) next.delete(p); });
          return next;
        });
      }
      if (allOk) {
        setBulkOpen(false);
        setBulkReason("");
      }
      invalidate();
    },
    onError: (e: any) => {
      const msg = e?.message ?? String(e);
      toast({
        title: "Bulk unblock failed",
        description: msg.includes("reason_too_short")
          ? "Reason must be at least 5 characters."
          : msg.includes("not_authorized")
          ? "You don't have permission to perform this action."
          : msg.includes("no_phones_provided")
          ? "No phone numbers were provided."
          : `RPC error: ${msg}`,
        variant: "destructive",
      });
    },
  });

  const filtered = useMemo(
    () =>
      blocked.filter((b) =>
        q.trim()
          ? (b.phone ?? "").includes(q.trim()) || (b.name ?? "").toLowerCase().includes(q.trim().toLowerCase())
          : true
      ),
    [blocked, q]
  );

  const toggleOne = (phone: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((b) => b.phone)));
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-destructive/10">
          <ShieldAlert className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Blocked Phone Numbers</h1>
          <p className="text-sm text-muted-foreground">
            Numbers permanently blocked because they belonged to a deleted EasyPay account.
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by phone or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selected.size > 0 && selected.size === filtered.length}
                onCheckedChange={toggleAll}
              />
              <span>
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `Select all (${filtered.length})`}
              </span>
            </label>
            <Button
              size="sm"
              disabled={selected.size === 0 || bulkUnblock.isPending}
              onClick={() => setBulkOpen(true)}
            >
              {bulkUnblock.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5 mr-1.5" />
              )}
              {bulkUnblock.isPending ? "Unblocking…" : "Bulk unblock"}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No blocked numbers.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((b) => (
              <div key={`${b.phone}-${b.deleted_user_id}`} className="flex items-center justify-between py-3 gap-3">
                <Checkbox
                  checked={selected.has(b.phone)}
                  onCheckedChange={() => toggleOne(b.phone)}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.phone}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.name ?? "—"} · deleted {new Date(b.deleted_at).toLocaleDateString()}
                    {b.deletion_reason ? ` · ${b.deletion_reason}` : ""}
                  </div>
                  {b.last_unblock_attempt && (
                    <div className="text-[11px] text-amber-500">
                      Previous unblock: {new Date(b.last_unblock_attempt).toLocaleString()}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDetails(b)}>
                  <Info className="h-3.5 w-3.5 mr-1.5" />
                  Details
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTarget(b)}>
                  <Unlock className="h-3.5 w-3.5 mr-1.5" />
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Recent unblock audit log</h2>
        </div>
        {audit.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No entries yet.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {audit.map((a) => (
              <div key={a.id} className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <div className="min-w-0">
                  <div className="font-medium">{a.phone}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.reason}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Single unblock */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unblock {target?.phone}</DialogTitle>
            <DialogDescription>
              This lets the number be reused to create a new EasyPay account. Provide a reason — it is stored in the
              audit log against your admin ID.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for unblocking (min 5 characters)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button
              disabled={reason.trim().length < 5 || unblock.isPending}
              onClick={() => target && unblock.mutate({ phone: target.phone, reason: reason.trim() })}
            >
              {unblock.isPending ? "Unblocking…" : "Confirm unblock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk unblock */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk unblock {selected.size} number(s)</DialogTitle>
            <DialogDescription>
              A single reason will be logged against your admin ID for every number in the selection.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-auto rounded-md border border-border/60 p-2 text-xs space-y-1">
            {[...selected].map((p) => (
              <div key={p} className="font-mono">{p}</div>
            ))}
          </div>
          <Textarea
            placeholder="Reason for bulk unblock (min 5 characters)…"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            rows={4}
            disabled={bulkUnblock.isPending}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkOpen(false)}
              disabled={bulkUnblock.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={bulkReason.trim().length < 5 || selected.size === 0 || bulkUnblock.isPending}
              onClick={() => setBulkConfirm(true)}
            >
              Review & confirm ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk confirmation */}
      <Dialog
        open={bulkConfirm}
        onOpenChange={(o) => {
          if (bulkUnblock.isPending) return;
          if (!o) setBulkConfirm(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkUnblock.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Unblocking {selected.size} number(s)…
                </>
              ) : (
                <>Confirm bulk unblock</>
              )}
            </DialogTitle>
            <DialogDescription>
              {bulkUnblock.isPending
                ? "Do not close this window. Awaiting server response…"
                : `This will unblock ${selected.size} phone number(s) and log the reason below against your admin ID. This action cannot be undone from this screen.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Phones ({selected.size})
              </div>
              <div className="max-h-40 overflow-auto rounded-md border border-border/60 p-2 text-xs space-y-1">
                {[...selected].map((p) => (
                  <div key={p} className="font-mono flex items-center justify-between gap-2">
                    <span>{p}</span>
                    {bulkUnblock.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Reason</div>
              <div className="rounded-md border border-border/60 p-2 text-sm whitespace-pre-wrap">
                {bulkReason.trim()}
              </div>
            </div>
            {bulkUnblock.isError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{(bulkUnblock.error as any)?.message ?? "Something went wrong."}</span>
              </div>
            )}
            {bulkUnblock.isSuccess && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Unblocked {bulkUnblock.data?.unblocked ?? 0}/{bulkUnblock.data?.requested ?? 0}.
                  {(bulkUnblock.data?.failed?.length ?? 0) > 0
                    ? ` ${bulkUnblock.data!.failed.length} still selected — review and retry.`
                    : ""}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirm(false)} disabled={bulkUnblock.isPending}>
              {bulkUnblock.isSuccess ? "Close" : "Back"}
            </Button>
            <Button
              disabled={bulkUnblock.isPending || selected.size === 0}
              onClick={() => {
                bulkUnblock.mutate({ phones: [...selected], reason: bulkReason.trim() });
              }}
            >
              {bulkUnblock.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Unblocking…
                </>
              ) : bulkUnblock.isError ? (
                `Retry unblock (${selected.size})`
              ) : (
                `Unblock ${selected.size} now`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Details drawer */}
      <Sheet open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Block details</SheetTitle>
            <SheetDescription>Context that triggered this phone block.</SheetDescription>
          </SheetHeader>
          {details && (
            <div className="mt-6 space-y-4 text-sm">
              <Field label="Phone" value={details.phone} mono />
              <Field label="Account holder name" value={details.name ?? "—"} />
              <Field
                label="Original account ID"
                value={details.original_user_id ?? "—"}
                mono
              />
              <Field
                label="Deleted-users record ID"
                value={details.deleted_user_id ?? "—"}
                mono
              />
              <Field
                label="Deleted at"
                value={new Date(details.deleted_at).toLocaleString()}
              />
              <Field label="Deletion reason" value={details.deletion_reason ?? "—"} />
              <Field
                label="Triggered by"
                value={
                  details.deleted_by
                    ? `${details.deleted_by_name ?? "Unknown"} (${details.deleted_by})`
                    : "User self-deletion / system"
                }
                mono={!!details.deleted_by}
              />
              <Field
                label="Last unblock attempt"
                value={
                  details.last_unblock_attempt
                    ? new Date(details.last_unblock_attempt).toLocaleString()
                    : "Never"
                }
              />

              <div className="pt-2 border-t border-border/60">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Unblock history ({phoneHistory.length})
                  </div>
                </div>
                {phoneHistoryLoading ? (
                  <div className="text-xs text-muted-foreground py-2">Loading history…</div>
                ) : phoneHistory.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    This phone has never been unblocked.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {phoneHistory.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-md border border-border/60 p-2 text-xs space-y-1"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">
                            {adminNames[h.admin_id] ?? "Unknown admin"}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(h.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground break-all">
                          {h.admin_id}
                        </div>
                        <div className="whitespace-pre-wrap">{h.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <SheetFooter className="mt-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (details) {
                  setTarget(details);
                  setDetails(null);
                }
              }}
            >
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              Unblock this number
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
