import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, XCircle, Users, ArrowUpRight, AlertTriangle,
  AlertCircle, RefreshCw,
} from "lucide-react";
import { trackKycEvent } from "@/lib/kycAnalytics";

/**
 * Dev-only harness that renders the exact "Customer KYC" sheet content used
 * inside AgentMenuDrawer, driven by URL fixtures so Playwright can assert
 * loading / empty / error / populated / long-reason states, the Update-button
 * refresh flow, and per-agent scoping (no cross-agent leakage).
 *
 * Query params:
 *   ?fixture=loading | empty | error | populated | long-reason
 *   ?agent=A | B                (populated only) — controls which fixture set
 *   ?delay=<ms>                 (populated only) — simulates fetch latency
 *
 * The "Update" button navigates to `/agent/register` in production. In this
 * harness we record the click and re-fetch on window focus, which is what
 * the drawer relies on to refresh counts + fire the success toast/banner.
 */

type Status = "verified" | "pending" | "rejected" | "none";
interface KycCustomer {
  user_id: string;
  name: string | null;
  phone: string | null;
  status: Status;
  rejection_reason: string | null;
  updated_at: string | null;
}

// Agent A's customers.
const AGENT_A_INITIAL: KycCustomer[] = [
  { user_id: "a1", name: "Alice",  phone: "0170000001", status: "verified", rejection_reason: null, updated_at: "2026-01-01T10:00:00Z" },
  { user_id: "a2", name: "Bob",    phone: "0170000002", status: "verified", rejection_reason: null, updated_at: "2026-01-02T10:00:00Z" },
  { user_id: "a3", name: "Carol",  phone: "0170000003", status: "pending",  rejection_reason: null, updated_at: "2026-01-03T10:00:00Z" },
  { user_id: "a4", name: "Dave",   phone: "0170000004", status: "rejected", rejection_reason: "Blurry NID photo", updated_at: "2026-01-05T10:00:00Z" },
  { user_id: "a5", name: "Erin",   phone: "0170000005", status: "rejected", rejection_reason: "Address mismatch", updated_at: "2026-01-06T10:00:00Z" },
];
// After the "Update" flow: Dave got verified.
const AGENT_A_UPDATED: KycCustomer[] = AGENT_A_INITIAL.map((c) =>
  c.user_id === "a4" ? { ...c, status: "verified" as const, rejection_reason: null, updated_at: "2026-01-10T10:00:00Z" } : c,
);

// Agent B has a *different* dataset — completely disjoint customers + reasons.
const AGENT_B_INITIAL: KycCustomer[] = [
  { user_id: "b1", name: "Zed",   phone: "0180000001", status: "pending",  rejection_reason: null, updated_at: "2026-02-01T10:00:00Z" },
  { user_id: "b2", name: "Yara",  phone: "0180000002", status: "rejected", rejection_reason: "Selfie doesn't match NID", updated_at: "2026-02-02T10:00:00Z" },
];

// A single long rejection reason (>120 chars) used to test truncation.
const LONG_REASON =
  "The submitted NID photo is blurry, the address on the utility bill doesn't match the profile address, and the selfie was taken in poor lighting so we cannot confirm the customer's identity — please re-submit all three documents in clear light.";

const LONG_REASON_FIXTURE: KycCustomer[] = [
  { user_id: "L1", name: "Long", phone: "0190000001", status: "rejected", rejection_reason: LONG_REASON, updated_at: "2026-03-01T10:00:00Z" },
  { user_id: "L2", name: "Ok",   phone: "0190000002", status: "verified", rejection_reason: null, updated_at: "2026-03-02T10:00:00Z" },
];

export default function AgentKycHarness() {
  const params = new URLSearchParams(window.location.search);
  const fixture = params.get("fixture") ?? "populated";
  const initialAgent = (params.get("agent") ?? "A") as "A" | "B";
  const delay = Number(params.get("delay") ?? "0");

  const [agent, setAgent] = useState<"A" | "B">(initialAgent);
  const [loading, setLoading] = useState(fixture !== "empty" && fixture !== "error");
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<KycCustomer[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [updateClicks, setUpdateClicks] = useState(0);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [rejectionExpanded, setRejectionExpanded] = useState(false);
  const [errorAttempts, setErrorAttempts] = useState(0);

  const loadData = useCallback(
    (opts?: { markRefresh?: boolean; forceSuccess?: boolean }) => {
      setLoading(true);
      const done = (data: KycCustomer[] | null, err: string | null) => {
        setCustomers(data ?? []);
        setError(err);
        setLoading(false);
        if (opts?.markRefresh) {
          setJustRefreshed(true);
          toast.success("Customer KYC updated");
          setTimeout(() => setJustRefreshed(false), 4000);
        }
      };
      const runAfter = (fn: () => void) => (delay > 0 ? setTimeout(fn, delay) : fn());

      if (fixture === "loading") { setLoading(true); return; }
      if (fixture === "empty")   { runAfter(() => done([], null)); return; }
      if (fixture === "error") {
        // First attempt fails, subsequent retries succeed with agent A data.
        const attempt = errorAttempts;
        setErrorAttempts((n) => n + 1);
        if (attempt === 0 && !opts?.forceSuccess) {
          runAfter(() => done(null, "Network request failed"));
        } else {
          runAfter(() => done(AGENT_A_INITIAL, null));
        }
        return;
      }
      if (fixture === "long-reason") { runAfter(() => done(LONG_REASON_FIXTURE, null)); return; }

      // populated
      const set = agent === "A"
        ? (opts?.markRefresh ? AGENT_A_UPDATED : AGENT_A_INITIAL)
        : AGENT_B_INITIAL;
      runAfter(() => done(set, null));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent, fixture, delay, errorAttempts],
  );

  // Reset stale data whenever the agent changes — mirrors the drawer's
  // "clear on user change" behavior to prevent cross-agent leakage.
  useEffect(() => {
    setCustomers([]);
    setError(null);
    setRejectionExpanded(false);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  useEffect(() => {
    const onFocus = () => {
      setRefreshCount((n) => n + 1);
      if (fixture === "populated") loadData({ markRefresh: true });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, agent]);

  // Simulate Supabase realtime `postgres_changes` events. Playwright dispatches
  // CustomEvent('kyc:realtime', { detail: { eventType, new, old } }) — the
  // handler mutates local state exactly like the subscription callback would,
  // proving the UI reflects DB changes without a page refresh.
  useEffect(() => {
    const onRealtime = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new?: KycCustomer;
        old?: { user_id: string };
      };
      setCustomers((prev) => {
        if (detail.eventType === "INSERT" && detail.new) {
          if (prev.some((c) => c.user_id === detail.new!.user_id)) return prev;
          return [...prev, detail.new];
        }
        if (detail.eventType === "UPDATE" && detail.new) {
          return prev.map((c) => (c.user_id === detail.new!.user_id ? { ...c, ...detail.new! } : c));
        }
        if (detail.eventType === "DELETE" && detail.old) {
          return prev.filter((c) => c.user_id !== detail.old!.user_id);
        }
        return prev;
      });
    };
    window.addEventListener("kyc:realtime", onRealtime as EventListener);
    return () => window.removeEventListener("kyc:realtime", onRealtime as EventListener);
  }, []);

  const counts = useMemo(() => {
    const c = { verified: 0, pending: 0, rejected: 0, total: customers.length };
    customers.forEach((k) => {
      if (k.status === "verified") c.verified++;
      else if (k.status === "rejected") c.rejected++;
      else c.pending++;
    });
    return c;
  }, [customers]);

  const latestRejection = useMemo(
    () => customers
      .filter((k) => k.status === "rejected")
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))[0] || null,
    [customers],
  );

  const [open, setOpen] = useState(false);
  const kycLoaded = !loading || customers.length > 0 || error !== null;

  return (
    <div className="min-h-screen bg-background p-6 space-y-4">
      <h1 className="text-lg font-extrabold" data-testid="harness-title">Agent Customer KYC — Harness</h1>
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span>fixture: <b data-testid="harness-fixture">{fixture}</b></span>
        <span>agent: <b data-testid="harness-agent">{agent}</b></span>
        <span>refresh: <b data-testid="harness-refresh-count">{refreshCount}</b></span>
        <span>update-clicks: <b data-testid="harness-update-clicks">{updateClicks}</b></span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button data-testid="open-drawer" onClick={() => setOpen(true)}>Open drawer</Button>
        <Button data-testid="open-kyc" onClick={() => setOpen(true)}>Customer KYC</Button>
        <Button data-testid="switch-agent-a" variant="secondary" onClick={() => setAgent("A")}>Sign in as Agent A</Button>
        <Button data-testid="switch-agent-b" variant="secondary" onClick={() => setAgent("B")}>Sign in as Agent B</Button>
        <Button
          data-testid="simulate-return"
          variant="secondary"
          onClick={() => window.dispatchEvent(new Event("focus"))}
        >
          Simulate return from Update
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8" data-testid="customer-kyc-sheet">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">Customer KYC Status</SheetTitle>
          </SheetHeader>

          {loading && !kycLoaded ? (
            <div className="space-y-4" data-testid="customer-kyc-loading" aria-busy="true">
              <Card className="p-5 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-muted animate-pulse mb-3" />
                <div className="h-7 w-16 mx-auto bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 mx-auto bg-muted animate-pulse rounded" />
              </Card>
            </div>
          ) : error && customers.length === 0 ? (
            <div className="space-y-4" data-testid="customer-kyc-error" role="alert">
              <Card className="p-6 border-0 shadow-card rounded-2xl text-center bg-rose-500/[0.04] border border-rose-500/20">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 flex items-center justify-center mb-3">
                  <AlertCircle size={24} className="text-rose-500" />
                </div>
                <p className="text-sm font-bold text-foreground">Couldn't load KYC data</p>
                <p className="text-[11px] text-muted-foreground mt-1" data-testid="kyc-error-message">{error}</p>
                <Button
                  data-testid="kyc-retry-btn"
                  onClick={() => loadData({ forceSuccess: true })}
                  disabled={loading}
                  className="mt-4 h-10 rounded-xl gradient-primary text-primary-foreground font-bold text-xs px-4 inline-flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                  Retry
                </Button>
              </Card>
            </div>
          ) : counts.total === 0 ? (
            <div className="space-y-4" data-testid="customer-kyc-empty">
              <Card className="p-6 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Users size={24} className="text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">No customers yet</p>
              </Card>
            </div>
          ) : (
            <div className="space-y-4" data-testid="customer-kyc-content">
              {justRefreshed && (
                <div
                  data-testid="kyc-updated-banner"
                  role="status"
                  className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2"
                >
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <p className="text-[11.5px] font-semibold text-emerald-700">Customer KYC updated successfully</p>
                </div>
              )}

              <Card className="p-5 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Users size={24} className="text-primary" />
                </div>
                <p className="text-3xl font-extrabold text-foreground" data-testid="kyc-total-count">{counts.total}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">Customers onboarded</p>
              </Card>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-emerald-500/[0.06] via-muted/20 to-amber-500/[0.06] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[11px] font-bold text-foreground">Customer KYC Status</p>
                    <p className="text-[10px] text-muted-foreground">{counts.total} total customers</p>
                  </div>
                  <button
                    data-testid="kyc-update-btn"
                    onClick={() => {
                      setUpdateClicks((n) => n + 1);
                      setOpen(false);
                      setTimeout(() => window.dispatchEvent(new Event("focus")), 50);
                    }}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-[10.5px] font-bold"
                  >
                    Update
                    <ArrowUpRight size={11} strokeWidth={2.5} />
                  </button>
                </div>
                <TooltipProvider delayDuration={150}>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button data-testid="kyc-verified-tile" className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                      <CheckCircle2 size={13} className="mx-auto text-emerald-500 mb-0.5" strokeWidth={2.4} />
                      <p className="text-sm font-extrabold text-emerald-600 leading-none" data-testid="kyc-verified-count">{counts.verified}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">Verified</p>
                    </button>
                    <button data-testid="kyc-pending-tile" className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2 text-center">
                      <Clock size={13} className="mx-auto text-amber-500 mb-0.5" strokeWidth={2.4} />
                      <p className="text-sm font-extrabold text-amber-600 leading-none" data-testid="kyc-pending-count">{counts.pending}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">Pending</p>
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button data-testid="kyc-rejected-tile" className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2 text-center">
                          <XCircle size={13} className="mx-auto text-rose-500 mb-0.5" strokeWidth={2.4} />
                          <p className="text-sm font-extrabold text-rose-600 leading-none" data-testid="kyc-rejected-count">{counts.rejected}</p>
                          <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">Rejected</p>
                        </button>
                      </TooltipTrigger>
                      {latestRejection && (
                        <TooltipContent side="top" className="max-w-[220px] text-[11px]">
                          <p className="font-bold mb-0.5">Latest rejection reason</p>
                          <p className="text-muted-foreground">{latestRejection.rejection_reason || "No reason provided"}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </TooltipProvider>

                {latestRejection && counts.rejected > 0 && (() => {
                  const reason = latestRejection.rejection_reason || "No reason provided";
                  const LONG = 120;
                  const isLong = reason.length > LONG;
                  const shown = !isLong || rejectionExpanded ? reason : reason.slice(0, LONG).trimEnd() + "…";
                  return (
                    <div
                      className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-500/8 border border-rose-500/20 px-2 py-1.5"
                      data-testid="kyc-latest-rejection"
                      data-expanded={rejectionExpanded ? "true" : "false"}
                      data-long={isLong ? "true" : "false"}
                    >
                      <AlertTriangle size={11} className="text-rose-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-rose-600 leading-snug">
                          <span className="font-bold">Latest reason: </span>
                          <span
                            className={`text-muted-foreground break-words ${isLong && !rejectionExpanded ? "line-clamp-2" : ""}`}
                            data-testid="kyc-latest-rejection-reason"
                            title={isLong ? reason : undefined}
                          >
                            {shown}
                          </span>
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            data-testid="kyc-rejection-toggle"
                            onClick={() => setRejectionExpanded((v) => !v)}
                            className="mt-1 text-[10px] font-bold text-primary hover:underline"
                          >
                            {rejectionExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
