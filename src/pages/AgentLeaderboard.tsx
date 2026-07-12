import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import FlowHeader from "@/components/FlowHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Row {
  rank: number;
  agent_user_id: string;
  display_name: string;
  masked_uid: string;
  txn_count: number;
  txn_volume: number;
  is_me: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const rankBadge = (rank: number) => {
  if (rank === 1) return { Icon: Trophy, cls: "text-yellow-500 bg-yellow-500/12" };
  if (rank === 2) return { Icon: Medal, cls: "text-slate-400 bg-slate-400/12" };
  if (rank === 3) return { Icon: Award, cls: "text-amber-600 bg-amber-600/12" };
  return null;
};

const AgentLeaderboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [territory, setTerritory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const me = rows.find(r => r.is_me);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      const { data: agent } = await (supabase as any).from("agents")
        .select("territory_code").eq("user_id", user.id).maybeSingle();
      const code = agent?.territory_code ?? "";
      setTerritory(code);
      if (!code) { setRows([]); setLoading(false); return; }
      const { data, error } = await (supabase as any).rpc("agent_leaderboard", { _territory_code: code });
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <FlowHeader
        title="District Leaderboard"
        tagline={territory ? `Top agents · ${territory} · last 30 days` : "Last 30 days"}
        icon={Trophy}
        onBack={() => navigate("/agent")}
      />

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            No leaderboard data yet.
          </div>
        ) : (
          rows.slice(0, 20).map((r, i) => {
            const badge = rankBadge(Number(r.rank));
            return (
              <motion.div
                key={r.agent_user_id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`flex items-center gap-3 rounded-2xl p-3 border ${r.is_me ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card"} shadow-card`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${badge ? badge.cls : "bg-muted text-muted-foreground"}`}>
                  {badge ? <badge.Icon size={18} /> : `#${r.rank}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {r.display_name} <span className="text-[10px] font-mono text-muted-foreground">{r.masked_uid}</span>
                    {r.is_me && <span className="ml-2 text-[10px] font-semibold text-primary">YOU</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{fmt(Number(r.txn_count))} txns</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">৳{fmt(Number(r.txn_volume))}</p>
                  <p className="text-[10px] text-muted-foreground">volume</p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {me && me.rank > 20 && (
        <div className="fixed bottom-4 left-0 right-0 z-30 px-4">
          <div className="max-w-xl mx-auto rounded-2xl border border-primary/60 bg-primary/10 backdrop-blur-xl p-3 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              #{me.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">You are #{me.rank} of {rows.length}</p>
              <p className="text-[11px] text-muted-foreground">{fmt(Number(me.txn_count))} txns · ৳{fmt(Number(me.txn_volume))}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentLeaderboard;
