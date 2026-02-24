import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Wifi, HardDrive, RefreshCw, Coins } from "lucide-react";

interface RechargeTxn {
  id: string;
  short_id: string;
  amount: number;
  fee: number;
  commission: number;
  recipient_phone: string | null;
  recipient_name: string | null;
  description: string | null;
  status: string;
  created_at: string;
  balance_after: number | null;
}

type ModeFilter = "all" | "api" | "local";

const OPERATORS = ["All", "Grameenphone", "Robi", "Banglalink", "Teletalk", "Airtel"];

export default function AdminRechargeLog() {
  const [txns, setTxns] = useState<RechargeTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [operatorFilter, setOperatorFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("transactions")
      .select("id, short_id, amount, fee, commission, recipient_phone, recipient_name, description, status, created_at, balance_after")
      .eq("type", "recharge")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (operatorFilter !== "All") {
      query = query.eq("recipient_name", operatorFilter);
    }

    const { data } = await query;
    setTxns((data as RechargeTxn[]) ?? []);
    setLoading(false);
  }, [limit, operatorFilter]);

  useEffect(() => { load(); }, [load]);

  // Real-time
  useEffect(() => {
    const ch = supabase
      .channel("admin-recharge-log")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        const t = payload.new as any;
        if (t.type === "recharge") load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const getMode = (desc: string | null): "api" | "local" | "unknown" => {
    if (!desc) return "unknown";
    if (desc.endsWith(" [API]")) return "api";
    if (desc.endsWith(" [LOCAL]")) return "local";
    return "unknown";
  };

  const cleanDesc = (desc: string | null) =>
    (desc || "Custom Amount").replace(/ \[(API|LOCAL)\]$/, "");

  const filtered = txns.filter((t) => {
    const mode = getMode(t.description);
    if (modeFilter === "api" && mode !== "api") return false;
    if (modeFilter === "local" && mode !== "local") return false;
    if (search) {
      const q = search.toLowerCase();
      const matches =
        t.short_id?.toLowerCase().includes(q) ||
        t.recipient_phone?.includes(q) ||
        t.recipient_name?.toLowerCase().includes(q) ||
        cleanDesc(t.description).toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const apiCount = txns.filter(t => getMode(t.description) === "api").length;
  const localCount = txns.filter(t => getMode(t.description) === "local").length;
  const cashbackTotal = txns.reduce((s, t) => s + (t.commission || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{filtered.length}</p>
            <p className="text-[10px] text-muted-foreground">Showing</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{apiCount}</p>
            <p className="text-[10px] text-muted-foreground">Via Live API</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{localCount}</p>
            <p className="text-[10px] text-muted-foreground">Local Record</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-primary">৳{cashbackTotal.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Cashback Given</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search ID, phone, pack…"
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={modeFilter} onValueChange={(v) => setModeFilter(v as ModeFilter)}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="api">Live API</SelectItem>
            <SelectItem value="local">Local</SelectItem>
          </SelectContent>
        </Select>
        <Select value={operatorFilter} onValueChange={setOperatorFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op} value={op}>{op}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Transaction list */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">No recharge transactions found</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((t) => {
                const mode = getMode(t.description);
                const desc = cleanDesc(t.description);
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Mode icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      mode === "api"
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      {mode === "api" ? (
                        <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{desc}</p>
                        <Badge
                          className={`text-[9px] px-1.5 py-0 ${
                            mode === "api"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {mode === "api" ? "API" : "LOCAL"}
                        </Badge>
                        {t.commission > 0 && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            <Coins className="w-2.5 h-2.5 mr-0.5" />৳{t.commission}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{t.recipient_name}</span>
                        <span>·</span>
                        <span>{t.recipient_phone}</span>
                        <span>·</span>
                        <span className="font-mono">{t.short_id}</span>
                      </div>
                    </div>

                    {/* Amount + time */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">৳{t.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("en-BD", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more */}
      {filtered.length >= limit && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 100)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
