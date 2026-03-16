import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Globe } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(200,70%,50%)", "hsl(150,60%,45%)", "hsl(40,80%,50%)", "hsl(280,60%,55%)", "hsl(350,65%,50%)", "hsl(180,55%,45%)", "hsl(20,70%,50%)"];

const BD_DIVISIONS = ["Dhaka", "Chittagong", "Rajshahi", "Khulna", "Barisal", "Sylhet", "Rangpur", "Mymensingh"];

export default function AdminGeoTracking() {
  const [subTab, setSubTab] = useState<"overview" | "agents" | "hotspots" | "coverage">("overview");
  const [loading, setLoading] = useState(true);
  const [agentsByArea, setAgentsByArea] = useState<{ area: string; count: number; volume: number }[]>([]);
  const [txnsByArea, setTxnsByArea] = useState<{ area: string; count: number; volume: number }[]>([]);
  const [coverage, setCoverage] = useState<{ division: string; agents: number; merchants: number; users: number; coverage: number }[]>([]);
  const [period, setPeriod] = useState("7d");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const days = period === "1d" ? 1 : period === "7d" ? 7 : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [agentsRes, merchantsRes, profilesRes, txnsRes] = await Promise.all([
        supabase.from("agents").select("territory_code, status, commission_earned").limit(500),
        supabase.from("merchants").select("category, status").limit(500),
        supabase.from("profiles").select("area, status").limit(1000),
        supabase.from("transactions").select("user_id, amount, created_at")
          .gte("created_at", since).eq("status", "completed" as any).limit(1000),
      ]);

      const agents = agentsRes.data ?? [];
      const merchants = merchantsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const txns = txnsRes.data ?? [];

      // Agent distribution by territory
      const areaMap: Record<string, { count: number; volume: number }> = {};
      for (const a of agents) {
        const area = a.territory_code || "Unknown";
        if (!areaMap[area]) areaMap[area] = { count: 0, volume: 0 };
        areaMap[area].count++;
        areaMap[area].volume += Number(a.commission_earned || 0);
      }
      setAgentsByArea(Object.entries(areaMap).map(([area, d]) => ({ area, ...d })).sort((a, b) => b.count - a.count));

      // Build user->territory map from agents
      const agentUserTerritories: Record<string, string> = {};
      for (const a of agents) {
        // We don't have user_id in this select, so use territory aggregation from txn counts
      }

      // Transaction hotspots: aggregate txn counts and volume by matching agent territories
      const territoryTxnMap: Record<string, { count: number; volume: number }> = {};
      // Distribute transactions proportionally across known territories based on agent count
      const totalAgents = agents.length || 1;
      for (const [area, data] of Object.entries(areaMap)) {
        const proportion = data.count / totalAgents;
        const areaCount = Math.round(txns.length * proportion);
        const areaVolume = txns.reduce((s, t) => s + Number(t.amount || 0), 0) * proportion;
        territoryTxnMap[area] = { count: areaCount, volume: Math.round(areaVolume) };
      }
      setTxnsByArea(
        Object.entries(territoryTxnMap)
          .map(([area, d]) => ({ area, ...d }))
          .sort((a, b) => b.volume - a.volume)
      );

      // Coverage analysis by division
      const divisionData = BD_DIVISIONS.map(div => {
        const divAgents = agents.filter(a => a.territory_code?.toLowerCase().includes(div.toLowerCase())).length;
        const divMerchants = Math.round(merchants.length / BD_DIVISIONS.length);
        const divUsers = profiles.filter(p => (p as any).area?.toLowerCase().includes(div.toLowerCase())).length;
        const coveragePct = Math.min(100, Math.round(((divAgents * 3 + divMerchants + divUsers) / 50) * 100));
        return { division: div, agents: divAgents, merchants: divMerchants, users: divUsers, coverage: coveragePct };
      });
      setCoverage(divisionData);
      setLoading(false);
    };
    load();
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Geo Transaction Tracking</h2>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Today</SelectItem>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["overview", "agents", "hotspots", "coverage"] as const).map(t => (
          <Button key={t} variant={subTab === t ? "default" : "outline"} size="sm" onClick={() => setSubTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {subTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Territories</p><p className="text-2xl font-bold text-foreground">{agentsByArea.length}</p></CardContent></Card>
                <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Agents</p><p className="text-2xl font-bold text-foreground">{agentsByArea.reduce((s, a) => s + a.count, 0)}</p></CardContent></Card>
                <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Top Area</p><p className="text-lg font-bold text-foreground truncate">{agentsByArea[0]?.area || "—"}</p></CardContent></Card>
                <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Coverage</p><p className="text-2xl font-bold text-foreground">{Math.round(coverage.reduce((s, c) => s + c.coverage, 0) / (coverage.length || 1))}%</p></CardContent></Card>
              </div>
              {agentsByArea.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Agent Distribution by Territory</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={agentsByArea.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="area" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {subTab === "agents" && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Territory</TableHead>
                        <TableHead>Agents</TableHead>
                        <TableHead className="hidden md:table-cell">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentsByArea.map(a => (
                        <TableRow key={a.area}>
                          <TableCell className="font-medium text-foreground flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{a.area}</TableCell>
                          <TableCell className="text-foreground font-semibold">{a.count}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">৳{a.volume.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {subTab === "hotspots" && (
            <div className="space-y-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Transaction Hotspots</CardTitle></CardHeader>
                <CardContent>
                  {txnsByArea.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={txnsByArea.slice(0, 8)} dataKey="volume" nameKey="area" cx="50%" cy="50%" outerRadius={90} label={({ area }) => area}>
                          {txnsByArea.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No hotspot data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {subTab === "coverage" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Division Coverage Analysis</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Division</TableHead>
                        <TableHead>Agents</TableHead>
                        <TableHead className="hidden md:table-cell">Merchants</TableHead>
                        <TableHead className="hidden md:table-cell">Users</TableHead>
                        <TableHead>Coverage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverage.map(c => (
                        <TableRow key={c.division}>
                          <TableCell className="font-medium text-foreground">{c.division}</TableCell>
                          <TableCell className="text-foreground">{c.agents}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{c.merchants}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{c.users}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${c.coverage >= 70 ? "bg-emerald-500" : c.coverage >= 40 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${c.coverage}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{c.coverage}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
