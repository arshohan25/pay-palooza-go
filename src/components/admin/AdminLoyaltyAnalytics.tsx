import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { BarChart3, Coins, Users, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveChartFrame } from "@/components/admin/ResponsiveChartFrame";
import {
  useLoyaltyLedgerWindow,
  useTierDistribution,
  useCampaignPerformance,
  buildDailySeries,
} from "@/hooks/use-loyalty-analytics";

const WINDOW_DAYS = 30;
const shortDay = (d: string) => d.slice(5);

export default function AdminLoyaltyAnalytics() {
  const { data: rows, isLoading } = useLoyaltyLedgerWindow(WINDOW_DAYS);
  const { data: tierDist } = useTierDistribution();
  const { data: campaigns } = useCampaignPerformance(rows);

  const series = useMemo(() => buildDailySeries(rows ?? [], WINDOW_DAYS), [rows]);

  const totals = useMemo(() => {
    const earned = series.reduce((s, d) => s + d.earned, 0);
    const redeemed = series.reduce((s, d) => s + d.redeemed, 0);
    const expired = series.reduce((s, d) => s + d.expired, 0);
    const users = new Set((rows ?? []).map((r) => r.user_id)).size;
    return { earned, redeemed, expired, users, net: earned - redeemed - expired };
  }, [series, rows]);

  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Points earned (30d)", value: totals.earned, icon: Coins },
          { label: "Points redeemed (30d)", value: totals.redeemed, icon: Coins },
          { label: "Points expired (30d)", value: totals.expired, icon: BarChart3 },
          { label: "Active earners (30d)", value: totals.users, icon: Users },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <k.icon size={12} /> {k.label}
              </p>
              <p className="text-2xl font-extrabold tabular-nums">{fmt(k.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Accrual vs redemption by day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveChartFrame className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={shortDay} fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="earned" name="Earned" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                <Area type="monotone" dataKey="redeemed" name="Redeemed" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
                <Area type="monotone" dataKey="expired" name="Expired" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </ResponsiveChartFrame>
          {isLoading && <p className="text-[11px] text-muted-foreground mt-2">Loading…</p>}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tier distribution</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 items-center">
            <ResponsiveChartFrame className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(tierDist ?? []).filter((t) => t.users > 0)}
                    dataKey="users"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                  >
                    {(tierDist ?? []).filter((t) => t.users > 0).map((t) => (
                      <Cell key={t.code} fill={t.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ResponsiveChartFrame>
            <div className="space-y-1.5">
              {(tierDist ?? []).map((t) => (
                <div key={t.code} className="flex items-center gap-2 text-[11.5px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="flex-1 truncate">{t.name}</span>
                  <b className="tabular-nums">{fmt(t.users)}</b>
                </div>
              ))}
              {!tierDist?.length && <p className="text-[11px] text-muted-foreground">No data</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Megaphone size={14} /> Campaign performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!campaigns?.length ? (
              <p className="text-[11px] text-muted-foreground">No campaigns yet.</p>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold flex-1 truncate">{c.name}</p>
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.multiplier}×</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
                    <span>{c.txn_type}</span>
                    <span>
                      Points: <b className="text-foreground">{fmt(c.points_earned)}</b>
                    </span>
                    <span>
                      Users: <b className="text-foreground">{fmt(c.participants)}</b>
                    </span>
                  </div>
                  {c.daily.length > 0 && (
                    <ResponsiveChartFrame className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={c.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <XAxis dataKey="day" tickFormatter={shortDay} fontSize={9} tickLine={false} />
                          <YAxis fontSize={9} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 12,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="points" name="Points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ResponsiveChartFrame>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
