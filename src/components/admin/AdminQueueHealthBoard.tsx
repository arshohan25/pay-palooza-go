import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock, CreditCard,
  Droplets, KeyRound, RefreshCw, RotateCcw, ScanFace, Scale, Store, XCircle,
} from "lucide-react";

interface Props {
  /** Jump to the tab that owns this queue. */
  onNavigate?: (tabId: string) => void;
}

type Level = "healthy" | "warning" | "critical";

interface QueueDef {
  key: string;
  label: string;
  icon: any;
  tab: string;
  /** Hours before a waiting item is a warning / breach. */
  slaWarnHours: number;
  slaBreachHours: number;
  load: () => Promise<{ count: number; oldest: string | null }>;
}

interface QueueState extends Omit<QueueDef, "load"> {
  count: number;
  oldest: string | null;
  loading: boolean;
}

const pendingQuery = async (
  table: string,
  statusCol: string,
  statuses: string[],
  timeCol = "created_at",
) => {
  const { data, count } = await supabase
    .from(table as any)
    .select(`id, ${timeCol}`, { count: "exact" })
    .in(statusCol, statuses)
    .order(timeCol, { ascending: true })
    .limit(1);
  const first: any = (data ?? [])[0];
  return { count: count ?? 0, oldest: first ? first[timeCol] : null };
};

const QUEUES: QueueDef[] = [
  {
    key: "kyc", label: "KYC pending", icon: ScanFace, tab: "kyc",
    slaWarnHours: 12, slaBreachHours: 24,
    load: () => pendingQuery("kyc_verifications", "status", ["pending", "submitted", "under_review"], "submitted_at"),
  },
  {
    key: "disputes", label: "Open disputes", icon: Scale, tab: "disputes",
    slaWarnHours: 24, slaBreachHours: 48,
    load: () => pendingQuery("disputes", "status", ["open", "under_review"]),
  },
  {
    key: "refunds", label: "Refunds awaiting review", icon: RotateCcw, tab: "refund_console",
    slaWarnHours: 12, slaBreachHours: 48,
    load: () => pendingQuery("merchant_refunds", "status", ["pending", "requested"]),
  },
  {
    key: "float", label: "Agent float requests", icon: Droplets, tab: "float_mgmt",
    slaWarnHours: 4, slaBreachHours: 12,
    load: () => pendingQuery("agent_float_requests", "status", ["pending"]),
  },
  {
    key: "fund", label: "Fund requests", icon: CreditCard, tab: "fund_requests",
    slaWarnHours: 6, slaBreachHours: 24,
    load: () => pendingQuery("fund_requests", "status", ["pending"]),
  },
  {
    key: "pin_reset", label: "Merchant PIN resets", icon: KeyRound, tab: "merchant_pin_resets",
    slaWarnHours: 2, slaBreachHours: 8,
    load: () => pendingQuery("merchant_pin_reset_requests", "status", ["open", "pending"]),
  },
  {
    key: "merchant_apps", label: "Merchant applications", icon: Store, tab: "merchant_applications",
    slaWarnHours: 24, slaBreachHours: 72,
    load: () => pendingQuery("merchant_applications", "status", ["pending", "submitted", "under_review"]),
  },
  {
    key: "failed_txn", label: "Failed transactions (24h)", icon: XCircle, tab: "transactions",
    slaWarnHours: 1, slaBreachHours: 6,
    load: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, count } = await supabase
        .from("transactions")
        .select("id, created_at", { count: "exact" })
        .eq("status", "failed")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(1);
      return { count: count ?? 0, oldest: data?.[0]?.created_at ?? null };
    },
  },
];

const hoursSince = (iso: string | null) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : 0;

const levelFor = (q: QueueState): Level => {
  if (q.count === 0) return "healthy";
  const age = hoursSince(q.oldest);
  if (age >= q.slaBreachHours) return "critical";
  if (age >= q.slaWarnHours) return "warning";
  return "healthy";
};

const ageLabel = (iso: string | null) => {
  if (!iso) return "—";
  const h = hoursSince(iso);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
};

const TONE: Record<Level, string> = {
  healthy: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/10",
  critical: "border-destructive/50 bg-destructive/10",
};

const BADGE: Record<Level, string> = {
  healthy: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * Live ops health board — realtime queue counters with SLA aging and
 * one-click jump into the tab that owns each queue.
 */
const AdminQueueHealthBoard = ({ onNavigate }: Props) => {
  const [queues, setQueues] = useState<QueueState[]>(
    QUEUES.map(({ load, ...rest }) => ({ ...rest, count: 0, oldest: null, loading: true })),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.all(
      QUEUES.map(async (q) => {
        try {
          return await q.load();
        } catch {
          return { count: 0, oldest: null };
        }
      }),
    );
    setQueues(
      QUEUES.map(({ load, ...rest }, i) => ({
        ...rest,
        count: results[i].count,
        oldest: results[i].oldest,
        loading: false,
      })),
    );
    setLastSync(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 60_000);
    return () => clearInterval(timer);
  }, [loadAll]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-queue-health")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_verifications" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_float_requests" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const summary = useMemo(() => {
    const levels = queues.map(levelFor);
    return {
      total: queues.reduce((s, q) => s + q.count, 0),
      breached: levels.filter((l) => l === "critical").length,
      warning: levels.filter((l) => l === "warning").length,
    };
  }, [queues]);

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-primary" /> Live Ops Health Board
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.total} items waiting · {summary.breached} SLA breached · {summary.warning} nearing SLA
              {lastSync && <> · synced {lastSync.toLocaleTimeString()}</>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing} className="shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {queues.map((q) => {
            const level = levelFor(q);
            const Icon = q.icon;
            return (
              <button
                key={q.key}
                type="button"
                onClick={() => onNavigate?.(q.tab)}
                className={`group text-left rounded-2xl border p-4 transition-all hover:scale-[1.01] hover:shadow-md ${TONE[level]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className={`text-[10px] capitalize ${BADGE[level]}`}>
                    {level === "healthy" ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : level === "warning" ? (
                      <Clock className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 mr-1" />
                    )}
                    {level === "critical" ? "SLA breach" : level}
                  </Badge>
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums">
                  {q.loading ? "—" : q.count}
                </p>
                <p className="text-xs font-medium text-muted-foreground">{q.label}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Oldest: {q.count === 0 ? "—" : ageLabel(q.oldest)}</span>
                  <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  SLA {q.slaWarnHours}h warn · {q.slaBreachHours}h breach
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminQueueHealthBoard;
