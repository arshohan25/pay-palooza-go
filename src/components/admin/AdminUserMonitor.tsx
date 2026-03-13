import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Search, Plus, X, Eye, TrendingUp, ArrowUpRight, ArrowDownLeft, Wallet, RefreshCw, UserPlus } from "lucide-react";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface MonitoredUser {
  user_id: string;
  name: string | null;
  phone: string;
  balance: number;
  avatar_url: string | null;
  addMoneyTotal: number;
  sendTotal: number;
  txnCount: number;
}

interface DailyData {
  date: string;
  addmoney: number;
  send: number;
}

interface UserTxn {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  recipient_phone: string | null;
  recipient_name: string | null;
  status: string;
  short_id: string;
}

const chartConfig = {
  addmoney: { label: "Add Money", color: "hsl(var(--primary))" },
  send: { label: "Send/Transfer", color: "hsl(var(--destructive))" },
};

export default function AdminUserMonitor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<MonitoredUser[]>([]);
  const [autoUsers, setAutoUsers] = useState<MonitoredUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<MonitoredUser | null>(null);
  const [chartData, setChartData] = useState<DailyData[]>([]);
  const [recentTxns, setRecentTxns] = useState<UserTxn[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(true);

  // Auto-fetch active users (those with addmoney or send transactions in last 7 days)
  const fetchAutoUsers = useCallback(async () => {
    setLoadingAuto(true);
    try {
      const since = subDays(new Date(), 7).toISOString();
      const { data: txns } = await supabase
        .from("transactions")
        .select("user_id, type, amount")
        .in("type", ["addmoney", "send"])
        .gte("created_at", since)
        .eq("status", "completed")
        .limit(1000);

      if (!txns?.length) { setAutoUsers([]); setLoadingAuto(false); return; }

      const userMap = new Map<string, { addMoney: number; send: number; count: number }>();
      for (const t of txns) {
        const entry = userMap.get(t.user_id) || { addMoney: 0, send: 0, count: 0 };
        if (t.type === "addmoney") entry.addMoney += Number(t.amount);
        else entry.send += Number(t.amount);
        entry.count++;
        userMap.set(t.user_id, entry);
      }

      const userIds = Array.from(userMap.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone, balance, avatar_url")
        .in("user_id", userIds);

      const monitored: MonitoredUser[] = (profiles ?? []).map(p => {
        const stats = userMap.get(p.user_id)!;
        return {
          user_id: p.user_id,
          name: p.name,
          phone: p.phone,
          balance: Number(p.balance),
          avatar_url: p.avatar_url,
          addMoneyTotal: stats.addMoney,
          sendTotal: stats.send,
          txnCount: stats.count,
        };
      }).sort((a, b) => (b.addMoneyTotal + b.sendTotal) - (a.addMoneyTotal + a.sendTotal));

      setAutoUsers(monitored);
    } catch {
      setAutoUsers([]);
    } finally {
      setLoadingAuto(false);
    }
  }, []);

  useEffect(() => { fetchAutoUsers(); }, [fetchAutoUsers]);

  // Search users
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const q = searchQuery.trim();
    const { data } = await supabase
      .from("profiles")
      .select("user_id, name, phone, balance, avatar_url")
      .or(`phone.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  const addToWatchlist = async (profile: any) => {
    if (watchlist.some(w => w.user_id === profile.user_id)) return;
    const since = subDays(new Date(), 30).toISOString();
    const { data: txns } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", profile.user_id)
      .in("type", ["addmoney", "send"])
      .eq("status", "completed")
      .gte("created_at", since);

    let addMoney = 0, send = 0;
    for (const t of txns ?? []) {
      if (t.type === "addmoney") addMoney += Number(t.amount);
      else send += Number(t.amount);
    }

    setWatchlist(prev => [...prev, {
      user_id: profile.user_id,
      name: profile.name,
      phone: profile.phone,
      balance: Number(profile.balance),
      avatar_url: profile.avatar_url,
      addMoneyTotal: addMoney,
      sendTotal: send,
      txnCount: (txns ?? []).length,
    }]);
    setSearchResults([]);
    setSearchQuery("");
  };

  const removeFromWatchlist = (userId: string) => {
    setWatchlist(prev => prev.filter(w => w.user_id !== userId));
  };

  // Open detail sheet
  const openDetail = async (user: MonitoredUser) => {
    setSelectedUser(user);
    setLoadingDetail(true);

    const since = subDays(new Date(), 30).toISOString();
    const { data: txns } = await supabase
      .from("transactions")
      .select("id, type, amount, created_at, recipient_phone, recipient_name, status, short_id")
      .eq("user_id", user.user_id)
      .in("type", ["addmoney", "send"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    // Build chart data
    const dayMap = new Map<string, { addmoney: number; send: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      dayMap.set(d, { addmoney: 0, send: 0 });
    }

    for (const t of txns ?? []) {
      if (t.status !== "completed") continue;
      const day = format(parseISO(t.created_at), "MMM dd");
      const entry = dayMap.get(day);
      if (entry) {
        if (t.type === "addmoney") entry.addmoney += Number(t.amount);
        else entry.send += Number(t.amount);
      }
    }

    setChartData(Array.from(dayMap.entries()).map(([date, vals]) => ({ date, ...vals })));
    setRecentTxns((txns ?? []) as UserTxn[]);
    setLoadingDetail(false);
  };

  const allUsers = [
    ...watchlist,
    ...autoUsers.filter(au => !watchlist.some(w => w.user_id === au.user_id)),
  ];

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search user by phone or name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching} size="sm">
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {/* Search results */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2"
              >
                {searchResults.map(r => (
                  <div key={r.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.name || "No name"}</p>
                      <p className="text-xs text-muted-foreground">{r.phone}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addToWatchlist(r)}>
                      <UserPlus className="w-4 h-4 mr-1" /> Watch
                    </Button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-2 sm:p-3 text-center">
            <Eye className="w-4 h-4 sm:w-5 sm:h-5 mx-auto text-primary mb-1" />
            <p className="text-base sm:text-xl font-bold text-foreground">{allUsers.length}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">Monitored</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-2 sm:p-3 text-center">
            <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-xs sm:text-xl font-bold text-foreground truncate">৳{allUsers.reduce((s, u) => s + u.addMoneyTotal, 0).toLocaleString()}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">Add Money</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-2 sm:p-3 text-center">
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 mx-auto text-destructive mb-1" />
            <p className="text-xs sm:text-xl font-bold text-foreground truncate">৳{allUsers.reduce((s, u) => s + u.sendTotal, 0).toLocaleString()}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">Transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* User cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {loadingAuto ? "Loading active users..." : `Active Users (${allUsers.length})`}
          </h3>
          <Button variant="ghost" size="sm" onClick={fetchAutoUsers}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {allUsers.map(user => {
          const isWatched = watchlist.some(w => w.user_id === user.user_id);
          return (
            <motion.div
              key={user.user_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card
                className="border-0 shadow-[var(--shadow-card)] cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => openDetail(user)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {(user.name?.[0] || user.phone[0]).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{user.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isWatched && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={e => { e.stopPropagation(); removeFromWatchlist(user.user_id); }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Wallet className="w-3 h-3 mr-1" />৳{user.balance.toLocaleString()}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-primary/5 p-1.5">
                      <p className="text-xs text-muted-foreground">Add Money</p>
                      <p className="text-sm font-semibold text-primary">৳{user.addMoneyTotal.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-destructive/5 p-1.5">
                      <p className="text-xs text-muted-foreground">Sent</p>
                      <p className="text-sm font-semibold text-destructive">৳{user.sendTotal.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-muted p-1.5">
                      <p className="text-xs text-muted-foreground">Txns</p>
                      <p className="text-sm font-semibold text-foreground">{user.txnCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {!loadingAuto && allUsers.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No active users found. Search and add users to your watchlist.
          </p>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {(selectedUser?.name?.[0] || selectedUser?.phone?.[0] || "?").toUpperCase()}
                </span>
              </div>
              {selectedUser?.name || "Unknown"}
            </SheetTitle>
            <SheetDescription>{selectedUser?.phone}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(85vh-80px)]">
            <div className="p-4 space-y-4">
              {/* Balance + totals */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-0 bg-primary/5">
                  <CardContent className="p-3 text-center">
                    <Wallet className="w-4 h-4 mx-auto text-primary mb-1" />
                    <p className="text-lg font-bold text-foreground">৳{selectedUser?.balance.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Balance</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-emerald-500/5">
                  <CardContent className="p-3 text-center">
                    <ArrowDownLeft className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-bold text-foreground">৳{selectedUser?.addMoneyTotal.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Added</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-destructive/5">
                  <CardContent className="p-3 text-center">
                    <ArrowUpRight className="w-4 h-4 mx-auto text-destructive mb-1" />
                    <p className="text-lg font-bold text-foreground">৳{selectedUser?.sendTotal.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Sent</p>
                  </CardContent>
                </Card>
              </div>

              {/* 30-day chart */}
              <Card className="border-0 shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    30-Day Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  {loadingDetail ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
                  ) : (
                    <ChartContainer config={chartConfig} className="h-48 w-full">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="addGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="sendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="addmoney" stroke="hsl(var(--primary))" fill="url(#addGrad)" strokeWidth={2} />
                        <Area type="monotone" dataKey="send" stroke="hsl(var(--destructive))" fill="url(#sendGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Recent transactions */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Recent Transactions</h4>
                <div className="space-y-2">
                  {recentTxns.slice(0, 20).map(txn => (
                    <div key={txn.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          txn.type === "addmoney" ? "bg-primary/10" : "bg-destructive/10"
                        }`}>
                          {txn.type === "addmoney" ? (
                            <ArrowDownLeft className="w-4 h-4 text-primary" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {txn.type === "addmoney" ? "Add Money" : "Send Money"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(parseISO(txn.created_at), "MMM dd, hh:mm a")} · {txn.short_id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${
                          txn.type === "addmoney" ? "text-primary" : "text-destructive"
                        }`}>
                          {txn.type === "addmoney" ? "+" : "-"}৳{Number(txn.amount).toLocaleString()}
                        </p>
                        <Badge variant={txn.status === "completed" ? "default" : "secondary"} className="text-[9px] h-4">
                          {txn.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {recentTxns.length === 0 && !loadingDetail && (
                    <p className="text-center text-sm text-muted-foreground py-4">No transactions found</p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
