import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, XCircle, Users, ArrowUpRight, AlertTriangle } from "lucide-react";

/**
 * Dev-only harness that renders the exact "Customer KYC" sheet content used
 * inside AgentMenuDrawer, driven by URL fixtures so Playwright can assert
 * loading / empty / populated states + the Update button refresh flow.
 *
 * Query params:
 *   ?fixture=loading | empty | populated
 *   ?delay=<ms>        (populated only) — simulates fetch latency
 *
 * The "Update" button navigates to `/agent/register` in production. In this
 * harness we just record the click and re-fetch on window focus, which is
 * what the drawer relies on to refresh counts after a KYC edit.
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

const FIXTURE_A: KycCustomer[] = [
  { user_id: "u1", name: "Alice",  phone: "0170000001", status: "verified", rejection_reason: null, updated_at: "2026-01-01T10:00:00Z" },
  { user_id: "u2", name: "Bob",    phone: "0170000002", status: "verified", rejection_reason: null, updated_at: "2026-01-02T10:00:00Z" },
  { user_id: "u3", name: "Carol",  phone: "0170000003", status: "pending",  rejection_reason: null, updated_at: "2026-01-03T10:00:00Z" },
  { user_id: "u4", name: "Dave",   phone: "0170000004", status: "rejected", rejection_reason: "Blurry NID photo", updated_at: "2026-01-05T10:00:00Z" },
  { user_id: "u5", name: "Erin",   phone: "0170000005", status: "rejected", rejection_reason: "Address mismatch", updated_at: "2026-01-06T10:00:00Z" },
];

// After the "Update" flow: one previously-rejected customer got verified.
const FIXTURE_B: KycCustomer[] = FIXTURE_A.map((c) =>
  c.user_id === "u4" ? { ...c, status: "verified" as const, rejection_reason: null, updated_at: "2026-01-10T10:00:00Z" } : c,
);

export default function AgentKycHarness() {
  const params = new URLSearchParams(window.location.search);
  const fixture = params.get("fixture") ?? "populated";
  const delay = Number(params.get("delay") ?? "0");

  const [loading, setLoading] = useState(fixture !== "empty");
  const [customers, setCustomers] = useState<KycCustomer[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [updateClicks, setUpdateClicks] = useState(0);

  const load = (source: KycCustomer[]) => {
    setLoading(true);
    const done = () => { setCustomers(source); setLoading(false); };
    if (delay > 0) setTimeout(done, delay); else done();
  };

  useEffect(() => {
    if (fixture === "loading") { setLoading(true); return; }
    if (fixture === "empty") { setCustomers([]); setLoading(false); return; }
    load(FIXTURE_A);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture]);

  useEffect(() => {
    const onFocus = () => {
      // Simulates the drawer's "refresh after Update flow returns" behavior.
      setRefreshCount((n) => n + 1);
      if (fixture === "populated") load(FIXTURE_B);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture]);

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

  return (
    <div className="min-h-screen bg-background p-6 space-y-4">
      <h1 className="text-lg font-extrabold" data-testid="harness-title">Agent Customer KYC — Harness</h1>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>fixture: <b data-testid="harness-fixture">{fixture}</b></span>
        <span>refresh: <b data-testid="harness-refresh-count">{refreshCount}</b></span>
        <span>update-clicks: <b data-testid="harness-update-clicks">{updateClicks}</b></span>
      </div>

      <Button data-testid="open-drawer" onClick={() => setOpen(true)}>Open drawer</Button>
      <Button data-testid="open-kyc" onClick={() => setOpen(true)}>Customer KYC</Button>

      {/* Simulate the return-from-update flow. */}
      <Button
        data-testid="simulate-return"
        variant="secondary"
        onClick={() => window.dispatchEvent(new Event("focus"))}
      >
        Simulate return from Update
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8" data-testid="customer-kyc-sheet">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">Customer KYC Status</SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="space-y-4" data-testid="customer-kyc-loading" aria-busy="true">
              <Card className="p-5 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-muted animate-pulse mb-3" />
                <div className="h-7 w-16 mx-auto bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 mx-auto bg-muted animate-pulse rounded" />
              </Card>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-16 rounded-xl bg-muted animate-pulse" />
                  <div className="h-16 rounded-xl bg-muted animate-pulse" />
                  <div className="h-16 rounded-xl bg-muted animate-pulse" />
                </div>
              </div>
            </div>
          ) : counts.total === 0 ? (
            <div className="space-y-4" data-testid="customer-kyc-empty">
              <Card className="p-6 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Users size={24} className="text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">No customers yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Register your first customer and their KYC status will appear here.
                </p>
              </Card>
            </div>
          ) : (
            <div className="space-y-4" data-testid="customer-kyc-content">
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
                      // In production this navigates to /agent/register; the drawer's
                      // focus listener re-fetches when the agent returns. We mirror
                      // that here so the e2e can verify the refresh.
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

                {latestRejection && counts.rejected > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-500/8 border border-rose-500/20 px-2 py-1.5" data-testid="kyc-latest-rejection">
                    <AlertTriangle size={11} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-600 leading-snug">
                      <span className="font-bold">Latest reason: </span>
                      <span className="text-muted-foreground" data-testid="kyc-latest-rejection-reason">
                        {latestRejection.rejection_reason || "No reason provided"}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
