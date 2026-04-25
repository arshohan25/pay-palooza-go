import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, XCircle, MinusCircle, RefreshCw, Filter, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  endpoint: string | null;
  title: string;
  body: string | null;
  url: string | null;
  category: string | null;
  status: "sent" | "failed" | "skipped" | string;
  status_code: number | null;
  error_message: string | null;
}

const STATUSES = ["all", "sent", "failed", "skipped"] as const;

export default function AdminPushDeliveryLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("push_delivery_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (status !== "all") q = q.eq("status", status);
    if (category !== "all") q = q.eq("category", category);
    const { data } = await q;
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  }, [status, category]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-push-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "push_delivery_logs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.body?.toLowerCase().includes(q) ||
        r.error_message?.toLowerCase().includes(q) ||
        r.user_id?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const sent = rows.filter((r) => r.status === "sent").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const skipped = rows.filter((r) => r.status === "skipped").length;
    const failByCat: Record<string, number> = {};
    rows
      .filter((r) => r.status === "failed")
      .forEach((r) => {
        const k = r.category ?? "uncategorized";
        failByCat[k] = (failByCat[k] ?? 0) + 1;
      });
    const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    return { total, sent, failed, skipped, failByCat, successRate };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Push Delivery Logs</h2>
            <p className="text-sm text-muted-foreground">
              Real-time send status, opt-out skips, and failure reasons.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="rounded-lg gap-1.5 h-8 text-xs">
          <RefreshCw size={12} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="w-7 h-7 text-primary" />
            <div>
              <p className="text-xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Last 300</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            <div>
              <p className="text-xl font-bold text-foreground">{stats.successRate}%</p>
              <p className="text-xs text-muted-foreground">{stats.sent} sent</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-7 h-7 text-destructive" />
            <div>
              <p className="text-xl font-bold text-foreground">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MinusCircle className="w-7 h-7 text-amber-500" />
            <div>
              <p className="text-xl font-bold text-foreground">{stats.skipped}</p>
              <p className="text-xs text-muted-foreground">Opted out</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Failures per category */}
      {Object.keys(stats.failByCat).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Failures per trigger
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.failByCat)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <Badge key={k} variant="destructive" className="text-xs">
                    {k}: {v}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter size={12} />
          Filter:
        </div>
        <Select value={status} onValueChange={(v: any) => setStatus(v)}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title / body / error / user…"
          className="h-8 text-xs flex-1 min-w-[180px]"
        />
      </div>

      {/* Logs */}
      <Card>
        <ScrollArea className="h-[520px]">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No logs match.</div>
            ) : (
              filtered.map((r, i) => {
                const isFail = r.status === "failed";
                const isSkip = r.status === "skipped";
                const Icon = isFail ? XCircle : isSkip ? MinusCircle : CheckCircle2;
                const tone = isFail
                  ? "text-destructive"
                  : isSkip
                  ? "text-amber-500"
                  : "text-emerald-500";
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.01, 0.2) }}
                    className="px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                          {r.category && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              {r.category}
                            </Badge>
                          )}
                          {r.status_code != null && (
                            <Badge
                              variant={isFail ? "destructive" : "secondary"}
                              className="text-[10px] h-4"
                            >
                              {r.status_code}
                            </Badge>
                          )}
                        </div>
                        {r.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.body}</p>
                        )}
                        {r.error_message && (
                          <p className="text-xs text-destructive mt-1 break-words">
                            ⚠ {r.error_message}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-muted-foreground">
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                          {r.user_id && (
                            <span className="font-mono truncate">user: {r.user_id.slice(0, 8)}…</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
