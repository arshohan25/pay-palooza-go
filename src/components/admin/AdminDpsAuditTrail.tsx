import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollText, RefreshCw, Search, Copy, Download } from "lucide-react";
import { toast } from "sonner";

type RunLog = {
  id: string;
  schedule_id: string;
  user_id: string;
  outcome: string;
  reason: string | null;
  amount: number;
  triggered_by: string;
  created_at: string;
  goal_id: string | null;
  goal_name: string | null;
  tx_reference: string | null;
  transaction_id: string | null;
};

const OUTCOME_COLOR: Record<string, string> = {
  collected:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  missed: "bg-destructive/10 text-destructive",
  settled: "bg-primary/10 text-primary",
  dedup_skipped: "bg-muted text-muted-foreground",
  no_goal:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  schedule_inactive: "bg-muted text-muted-foreground",
  plan_expired: "bg-muted text-muted-foreground",
  schedule_not_found: "bg-destructive/10 text-destructive",
};

const OUTCOMES = [
  "all",
  "collected",
  "missed",
  "settled",
  "dedup_skipped",
  "no_goal",
  "schedule_inactive",
  "plan_expired",
];

const TRIGGERS = ["all", "cron", "admin", "user"];

const short = (s: string | null | undefined, len = 8) =>
  s ? `${s.substring(0, len)}…` : "—";

const copy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
};

export default function AdminDpsAuditTrail() {
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState("all");
  const [trigger, setTrigger] = useState("all");
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from as any)("dps_run_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data as RunLog[]) ?? [];
    setLogs(rows);
    const uids = [...new Set(rows.map((r) => r.user_id))];
    if (uids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", uids);
      const map: Record<string, any> = {};
      (profs ?? []).forEach((p) => {
        map[p.user_id] = p;
      });
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("admin-dps-audit")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dps_run_log" } as any,
        (payload: any) => {
          setLogs((prev) => [payload.new as RunLog, ...prev].slice(0, 500));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (outcome !== "all" && l.outcome !== outcome) return false;
      if (trigger !== "all" && l.triggered_by !== trigger) return false;
      if (q) {
        const p = profiles[l.user_id];
        const hay = [
          p?.name,
          p?.phone,
          l.goal_name,
          l.tx_reference,
          l.schedule_id,
          l.transaction_id,
          l.reason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, profiles, outcome, trigger, search]);

  const totals = useMemo(() => {
    const by: Record<string, number> = {};
    let amount = 0;
    for (const l of filtered) {
      by[l.outcome] = (by[l.outcome] ?? 0) + 1;
      if (l.outcome === "collected") amount += Number(l.amount);
    }
    return { by, amount, count: filtered.length };
  }, [filtered]);

  const exportCsv = () => {
    const header = [
      "created_at",
      "user_name",
      "user_phone",
      "outcome",
      "reason",
      "amount",
      "goal_id",
      "goal_name",
      "schedule_id",
      "transaction_id",
      "tx_reference",
      "triggered_by",
    ];
    const rows = filtered.map((l) => {
      const p = profiles[l.user_id] ?? {};
      return [
        l.created_at,
        p.name ?? "",
        p.phone ?? "",
        l.outcome,
        l.reason ?? "",
        l.amount,
        l.goal_id ?? "",
        l.goal_name ?? "",
        l.schedule_id,
        l.transaction_id ?? "",
        l.tx_reference ?? "",
        l.triggered_by,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dps-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            DPS Audit Trail
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Every installment schedule run with credited goal, transaction ID,
            and reason
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw size={14} className="mr-1" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            <Download size={14} className="mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totals.count}</p>
            <p className="text-xs text-muted-foreground">Entries</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {totals.by.collected ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Collected</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">
              {totals.by.missed ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Missed</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {(totals.by.no_goal ?? 0) + (totals.by.dedup_skipped ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">
              ৳{totals.amount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Credited</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, goal, tx ref, schedule ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTCOMES.map((o) => (
              <SelectItem key={o} value={o}>
                {o === "all" ? "All outcomes" : o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={trigger} onValueChange={setTrigger}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGERS.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All triggers" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries match</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Trigger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const p = profiles[l.user_id];
                const color =
                  OUTCOME_COLOR[l.outcome] ?? "bg-muted text-muted-foreground";
                const isSkip =
                  l.outcome === "no_goal" ||
                  l.outcome === "dedup_skipped" ||
                  l.outcome === "schedule_inactive" ||
                  l.outcome === "plan_expired";
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">
                        {p?.name ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {p?.phone ?? ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${color} text-[10px] capitalize`}
                      >
                        {l.outcome.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.goal_name ? (
                        <>
                          <p className="font-medium text-foreground">
                            {l.goal_name}
                          </p>
                          {l.goal_id && (
                            <button
                              onClick={() => copy(l.goal_id!)}
                              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                              title={l.goal_id}
                            >
                              {short(l.goal_id)} <Copy size={10} />
                            </button>
                          )}
                        </>
                      ) : (
                        <span
                          className={
                            isSkip
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                          }
                        >
                          {l.outcome === "no_goal"
                            ? "No goal linked"
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground whitespace-nowrap">
                      {Number(l.amount) > 0
                        ? `৳${Number(l.amount).toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.tx_reference || l.transaction_id ? (
                        <div className="space-y-0.5">
                          {l.tx_reference && (
                            <button
                              onClick={() => copy(l.tx_reference!)}
                              className="font-mono text-[11px] text-foreground hover:underline inline-flex items-center gap-1"
                              title={l.tx_reference}
                            >
                              {l.tx_reference} <Copy size={10} />
                            </button>
                          )}
                          {l.transaction_id && (
                            <button
                              onClick={() => copy(l.transaction_id!)}
                              className="block text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                              title={l.transaction_id}
                            >
                              id: {short(l.transaction_id)} <Copy size={10} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <button
                        onClick={() => copy(l.schedule_id)}
                        className="font-mono text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        title={l.schedule_id}
                      >
                        {short(l.schedule_id)} <Copy size={10} />
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                      {l.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[10px] capitalize"
                      >
                        {l.triggered_by}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
