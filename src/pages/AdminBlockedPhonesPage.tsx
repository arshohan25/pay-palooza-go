import { useState, useMemo, useRef, useEffect } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  ShieldAlert, Search, Unlock, History, Info, Users, Loader2, CheckCircle2,
  AlertTriangle, SlidersHorizontal, Download, X,
} from "lucide-react";

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

type BulkResult = {
  requested: number;
  unblocked: number;
  failed: Array<{ phone: string; error: string }>;
  reason: string;
  phones: string[];
  at: string;
};

type BulkJob = {
  id: string;
  at: string;
  operator_id: string | null;
  operator_name: string | null;
  payload_hash: string;
  reason: string;
  phones: string[];
  status: "success" | "partial" | "failed";
  requested: number;
  unblocked: number;
  failed: Array<{ phone: string; error: string }>;
  error?: string;
};

const JOBS_STORAGE_KEY = "admin_bulk_unblock_jobs_v1";

async function sha256Hex(input: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  } catch {
    return Math.random().toString(36).slice(2, 18);
  }
}

// Cooldown after a successful/failed bulk submit before another can fire (ms)
const BULK_COOLDOWN_MS = 15_000;
// Window during which the exact same payload is treated as a duplicate (ms)
const BULK_DEDUPE_MS = 60_000;

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

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [contextFilter, setContextFilter] = useState<"all" | "admin" | "system" | string>("all");
  const [sortBy, setSortBy] = useState<"deleted_desc" | "deleted_asc" | "phone_asc" | "phone_desc">("deleted_desc");

  // Anti-spam state
  const lastSubmitRef = useRef<{ hash: string; at: number } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [lastResult, setLastResult] = useState<BulkResult | null>(null);

  // Bulk job timeline
  const [jobs, setJobs] = useState<BulkJob[]>(() => {
    try {
      const raw = localStorage.getItem(JOBS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as BulkJob[]) : [];
    } catch { return []; }
  });
  const [openJob, setOpenJob] = useState<BulkJob | null>(null);

  useEffect(() => {
    try { localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs.slice(0, 50))); } catch {}
  }, [jobs]);

  const { data: currentUser } = useQuery({
    queryKey: ["current-admin-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return { id: auth.user.id, name: (data as any)?.name ?? null };
    },
  });

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));

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
        reason,
        phones,
        at: new Date().toISOString(),
      } as BulkResult;
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

      setLastResult(res);
      setCooldownUntil(Date.now() + BULK_COOLDOWN_MS);
      setNowTick(Date.now());

      sha256Hex(`${[...res.phones].sort().join(",")}|${res.reason}`).then((hash) => {
        const status: BulkJob["status"] = allOk ? "success" : noneOk ? "failed" : "partial";
        const job: BulkJob = {
          id: `${res.at}-${hash}`,
          at: res.at,
          operator_id: currentUser?.id ?? null,
          operator_name: currentUser?.name ?? null,
          payload_hash: hash,
          reason: res.reason,
          phones: res.phones,
          status,
          requested: res.requested,
          unblocked: res.unblocked,
          failed: res.failed,
        };
        setJobs((prev) => [job, ...prev].slice(0, 50));
      });

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
    onError: (e: any, vars) => {
      const msg = e?.message ?? String(e);
      setCooldownUntil(Date.now() + BULK_COOLDOWN_MS);
      setNowTick(Date.now());
      const at = new Date().toISOString();
      sha256Hex(`${[...vars.phones].sort().join(",")}|${vars.reason}`).then((hash) => {
        setJobs((prev) => [{
          id: `${at}-${hash}`,
          at,
          operator_id: currentUser?.id ?? null,
          operator_name: currentUser?.name ?? null,
          payload_hash: hash,
          reason: vars.reason,
          phones: vars.phones,
          status: "failed" as const,
          requested: vars.phones.length,
          unblocked: 0,
          failed: vars.phones.map((p) => ({ phone: p, error: msg })),
          error: msg,
        }, ...prev].slice(0, 50));
      });
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

  // Distinct triggering contexts for the filter dropdown
  const contextOptions = useMemo(() => {
    const map = new Map<string, string>();
    blocked.forEach((b) => {
      if (b.deleted_by) map.set(b.deleted_by, b.deleted_by_name ?? b.deleted_by.slice(0, 8));
    });
    return [...map.entries()];
  }, [blocked]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 3600 * 1000 - 1 : null;
    const list = blocked.filter((b) => {
      if (term) {
        const hit =
          (b.phone ?? "").toLowerCase().includes(term) ||
          (b.name ?? "").toLowerCase().includes(term) ||
          (b.original_user_id ?? "").toLowerCase().includes(term) ||
          (b.deleted_user_id ?? "").toLowerCase().includes(term);
        if (!hit) return false;
      }
      const ts = new Date(b.deleted_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (contextFilter !== "all") {
        if (contextFilter === "system" && b.deleted_by) return false;
        if (contextFilter === "admin" && !b.deleted_by) return false;
        if (contextFilter !== "system" && contextFilter !== "admin" && b.deleted_by !== contextFilter) return false;
      }
      return true;
    });
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case "deleted_asc":
          return new Date(a.deleted_at).getTime() - new Date(b.deleted_at).getTime();
        case "phone_asc":
          return (a.phone ?? "").localeCompare(b.phone ?? "");
        case "phone_desc":
          return (b.phone ?? "").localeCompare(a.phone ?? "");
        case "deleted_desc":
        default:
          return new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime();
      }
    });
    return sorted;
  }, [blocked, q, dateFrom, dateTo, contextFilter, sortBy]);

  const activeFilterCount =
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (contextFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setContextFilter("all");
  };

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

  // Anti-spam guarded submit
  const submitBulk = () => {
    const phones = [...selected].sort();
    const trimmedReason = bulkReason.trim();
    const hash = `${phones.join(",")}|${trimmedReason}`;
    const now = Date.now();

    if (cooldownUntil > now) {
      const left = Math.ceil((cooldownUntil - now) / 1000);
      toast({
        title: "Please wait",
        description: `Cooldown active — try again in ${left}s.`,
        variant: "destructive",
      });
      return;
    }
    const last = lastSubmitRef.current;
    if (last && last.hash === hash && now - last.at < BULK_DEDUPE_MS) {
      toast({
        title: "Duplicate submission blocked",
        description:
          "The same phones with the same reason were just submitted. Change the selection or reason to submit again.",
        variant: "destructive",
      });
      return;
    }
    lastSubmitRef.current = { hash, at: now };
    bulkUnblock.mutate({ phones, reason: trimmedReason });
  };

  const downloadReport = () => {
    if (!lastResult) return;
    const failedMap = new Map(lastResult.failed.map((f) => [f.phone, f.error]));
    const rows = [
      ["phone", "status", "error", "reason", "submitted_at"],
      ...lastResult.phones.map((p) => {
        const err = failedMap.get(p);
        return [
          p,
          err ? "failed" : "unblocked",
          err ?? "",
          lastResult.reason,
          lastResult.at,
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-unblock-${lastResult.at.replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by phone, name, or deleted account ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deleted_desc">Newest deleted</SelectItem>
              <SelectItem value="deleted_asc">Oldest deleted</SelectItem>
              <SelectItem value="phone_asc">Phone A→Z</SelectItem>
              <SelectItem value="phone_desc">Phone Z→A</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            className="relative"
            onClick={() => setShowFilters((v) => !v)}
            title="Advanced filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>


        {showFilters && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Advanced filters
              </div>
              {activeFilterCount > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Deleted from</div>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Deleted to</div>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Triggered by</div>
                <Select value={contextFilter} onValueChange={setContextFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any context</SelectItem>
                    <SelectItem value="admin">Any admin</SelectItem>
                    <SelectItem value="system">System / self-deletion</SelectItem>
                    {contextOptions.map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

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
              disabled={selected.size === 0 || bulkUnblock.isPending || cooldownRemaining > 0}
              onClick={() => setBulkOpen(true)}
            >
              {bulkUnblock.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5 mr-1.5" />
              )}
              {bulkUnblock.isPending
                ? "Unblocking…"
                : cooldownRemaining > 0
                ? `Cooldown ${cooldownRemaining}s`
                : "Bulk unblock"}
            </Button>
          </div>
        )}

        {lastResult && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="font-medium">
                Last bulk run · {lastResult.unblocked}/{lastResult.requested} unblocked
              </div>
              <div className="text-muted-foreground truncate">
                {new Date(lastResult.at).toLocaleString()} · {lastResult.failed.length} failed
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={downloadReport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Report
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

      {/* Bulk job timeline */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Bulk unblock jobs</h2>
          </div>
          {jobs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setJobs([])}
            >
              Clear history
            </Button>
          )}
        </div>
        {jobs.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No bulk unblock jobs recorded on this device yet.
          </div>
        ) : (
          <ol className="relative border-l border-border/60 ml-2 space-y-3">
            {jobs.map((j) => {
              const dot =
                j.status === "success"
                  ? "bg-emerald-500"
                  : j.status === "partial"
                  ? "bg-amber-500"
                  : "bg-destructive";
              const label =
                j.status === "success" ? "Success" : j.status === "partial" ? "Partial" : "Failed";
              return (
                <li key={j.id} className="pl-4 relative">
                  <span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-2 ring-background ${dot}`} />
                  <button
                    onClick={() => setOpenJob(j)}
                    className="w-full text-left rounded-md border border-border/60 hover:bg-muted/30 p-2 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {label} · {j.unblocked}/{j.requested} unblocked
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(j.at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Operator: {j.operator_name ?? j.operator_id?.slice(0, 8) ?? "unknown"}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      hash: {j.payload_hash}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* Bulk job detail drawer */}
      <Sheet open={!!openJob} onOpenChange={(o) => !o && setOpenJob(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bulk job details</SheetTitle>
            <SheetDescription>Per-phone outcomes for this run.</SheetDescription>
          </SheetHeader>
          {openJob && (
            <div className="mt-6 space-y-4 text-sm">
              <Field label="Job time" value={new Date(openJob.at).toLocaleString()} />
              <Field
                label="Status"
                value={`${openJob.status.toUpperCase()} · ${openJob.unblocked}/${openJob.requested} unblocked`}
              />
              <Field
                label="Operator"
                value={
                  openJob.operator_id
                    ? `${openJob.operator_name ?? "Unknown"} (${openJob.operator_id})`
                    : "Unknown"
                }
                mono={!!openJob.operator_id}
              />
              <Field label="Payload hash" value={openJob.payload_hash} mono />
              <Field label="Reason" value={openJob.reason} />
              {openJob.error && <Field label="Error" value={openJob.error} />}

              <div className="pt-2 border-t border-border/60">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  Per-phone outcomes ({openJob.phones.length})
                </div>
                <div className="space-y-1">
                  {openJob.phones.map((p) => {
                    const err = openJob.failed.find((f) => f.phone === p)?.error;
                    return (
                      <div
                        key={p}
                        className="flex items-start justify-between gap-2 rounded-md border border-border/60 p-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-mono">{p}</div>
                          {err && <div className="text-destructive truncate">{err}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {err ? (
                            <span className="text-destructive font-medium">Failed</span>
                          ) : (
                            <span className="text-emerald-500 font-medium">Unblocked</span>
                          )}
                          <button
                            className="ml-2 text-muted-foreground hover:text-foreground underline"
                            onClick={() => {
                              setQ(p);
                              setOpenJob(null);
                            }}
                          >
                            Find
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>


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
          {cooldownRemaining > 0 && (
            <div className="text-xs text-amber-500 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Cooldown active — {cooldownRemaining}s remaining.
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkOpen(false)}
              disabled={bulkUnblock.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={bulkReason.trim().length < 5 || selected.size === 0 || bulkUnblock.isPending || cooldownRemaining > 0}
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
            {lastResult && (bulkUnblock.isSuccess || bulkUnblock.isError) && (
              <Button variant="outline" size="sm" className="w-full" onClick={downloadReport}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download results report (.csv)
              </Button>
            )}
            {cooldownRemaining > 0 && !bulkUnblock.isPending && (
              <div className="text-xs text-amber-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Cooldown active — {cooldownRemaining}s remaining.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirm(false)} disabled={bulkUnblock.isPending}>
              {bulkUnblock.isSuccess ? "Close" : "Back"}
            </Button>
            <Button
              disabled={bulkUnblock.isPending || selected.size === 0 || cooldownRemaining > 0}
              onClick={submitBulk}
            >
              {bulkUnblock.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Unblocking…
                </>
              ) : cooldownRemaining > 0 ? (
                `Cooldown ${cooldownRemaining}s`
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
              <Field label="Original account ID" value={details.original_user_id ?? "—"} mono />
              <Field label="Deleted-users record ID" value={details.deleted_user_id ?? "—"} mono />
              <Field label="Deleted at" value={new Date(details.deleted_at).toLocaleString()} />
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
                      <div key={h.id} className="rounded-md border border-border/60 p-2 text-xs space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{adminNames[h.admin_id] ?? "Unknown admin"}</span>
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
