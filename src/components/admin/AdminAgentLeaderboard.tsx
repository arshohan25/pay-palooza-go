import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, Medal } from "lucide-react";

interface AgentRank {
  agent_id: string;
  user_id: string;
  business_name: string | null;
  txn_count: number;
  txn_volume: number;
  commission_earned: number;
}

export default function AdminAgentLeaderboard() {
  const [data, setData] = useState<AgentRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"volume" | "count" | "commission">("volume");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Fetch agents
      const { data: agents } = await supabase.from("agents").select("id, user_id, business_name, commission_earned").eq("status", "active");
      if (!agents?.length) { setData([]); setLoading(false); return; }

      // Fetch transaction stats per agent user_id
      const userIds = agents.map(a => a.user_id);
      const { data: txns } = await supabase
        .from("transactions")
        .select("user_id, amount")
        .in("user_id", userIds)
        .eq("status", "completed");

      const txnMap: Record<string, { count: number; volume: number }> = {};
      for (const t of txns ?? []) {
        if (!txnMap[t.user_id]) txnMap[t.user_id] = { count: 0, volume: 0 };
        txnMap[t.user_id].count++;
        txnMap[t.user_id].volume += Number(t.amount);
      }

      const ranked: AgentRank[] = agents.map(a => ({
        agent_id: a.id,
        user_id: a.user_id,
        business_name: a.business_name,
        txn_count: txnMap[a.user_id]?.count ?? 0,
        txn_volume: txnMap[a.user_id]?.volume ?? 0,
        commission_earned: Number(a.commission_earned),
      }));

      setData(ranked);
      setLoading(false);
    };
    load();
  }, []);

  const sorted = [...data].sort((a, b) => {
    if (sortBy === "volume") return b.txn_volume - a.txn_volume;
    if (sortBy === "count") return b.txn_count - a.txn_count;
    return b.commission_earned - a.commission_earned;
  });

  const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="w-5 h-5 text-yellow-500" /> Agent Leaderboard</CardTitle>
          <div className="flex gap-1">
            {(["volume", "count", "commission"] as const).map(s => (
              <Button key={s} size="sm" variant={sortBy === s ? "default" : "outline"} onClick={() => setSortBy(s)} className="text-xs capitalize">
                {s === "volume" ? "Volume" : s === "count" ? "Txn Count" : "Commission"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No active agents found</p>
        ) : (
          <div className="space-y-2">
            {sorted.slice(0, 20).map((agent, i) => (
              <div key={agent.agent_id} className={`flex items-center gap-3 p-3 rounded-lg border border-border/50 transition-colors ${i < 3 ? "bg-primary/5" : "bg-muted/20"}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted shrink-0">
                  {i < 3 ? <Medal className={`w-5 h-5 ${medalColors[i]}`} /> : <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{agent.business_name || `Agent ${agent.agent_id.slice(0, 6)}`}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>৳{agent.txn_volume.toLocaleString()} vol</span>
                    <span>{agent.txn_count} txns</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    <TrendingUp className="w-3 h-3 mr-1" />৳{agent.commission_earned.toLocaleString()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
