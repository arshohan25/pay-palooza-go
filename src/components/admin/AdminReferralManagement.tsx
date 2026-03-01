import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Gift, Award, Smartphone, Check, X, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ReferralRow {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code: string;
  milestone_1_paid: boolean;
  milestone_2_paid: boolean;
  milestone_3_paid: boolean;
  total_rewarded: number;
  status: string;
  created_at: string;
  referrer_name?: string;
  referrer_phone?: string;
  referee_name?: string;
  referee_phone?: string;
}

interface RewardRow {
  id: string;
  referral_id: string;
  referrer_id: string;
  milestone: string;
  amount: number;
  created_at: string;
  referrer_name?: string;
  referrer_phone?: string;
}

interface DeviceRow {
  id: string;
  device_fingerprint: string;
  user_id: string;
  created_at: string;
  user_name?: string;
  user_phone?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const MILESTONE_LABELS: Record<string, string> = {
  kyc_verified: "KYC Verified",
  first_txn: "1st Transaction",
  five_txns: "5 Transactions",
};

export default function AdminReferralManagement() {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch referrals
    const { data: refs } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    // Fetch rewards
    const { data: rews } = await supabase
      .from("referral_rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    // Fetch devices
    const { data: devs } = await supabase
      .from("device_registrations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    // Collect all user IDs for profile lookup
    const userIds = new Set<string>();
    refs?.forEach((r: any) => { userIds.add(r.referrer_id); userIds.add(r.referee_id); });
    rews?.forEach((r: any) => { userIds.add(r.referrer_id); });
    devs?.forEach((d: any) => { userIds.add(d.user_id); });

    let profileMap: Record<string, { name: string | null; phone: string }> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", Array.from(userIds));
      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map(p => [p.user_id, { name: p.name, phone: p.phone }])
        );
      }
    }

    setReferrals((refs ?? []).map((r: any) => ({
      ...r,
      referrer_name: profileMap[r.referrer_id]?.name || null,
      referrer_phone: profileMap[r.referrer_id]?.phone || null,
      referee_name: profileMap[r.referee_id]?.name || null,
      referee_phone: profileMap[r.referee_id]?.phone || null,
    })));

    setRewards((rews ?? []).map((r: any) => ({
      ...r,
      referrer_name: profileMap[r.referrer_id]?.name || null,
      referrer_phone: profileMap[r.referrer_id]?.phone || null,
    })));

    setDevices((devs ?? []).map((d: any) => ({
      ...d,
      user_name: profileMap[d.user_id]?.name || null,
      user_phone: profileMap[d.user_id]?.phone || null,
    })));

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("admin-referral-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_rewards" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Stats
  const totalRewardsPaid = rewards.reduce((s, r) => s + r.amount, 0);
  const kycCount = rewards.filter(r => r.milestone === "kyc_verified").length;
  const firstTxnCount = rewards.filter(r => r.milestone === "first_txn").length;
  const fiveTxnCount = rewards.filter(r => r.milestone === "five_txns").length;

  // Filtered referrals
  const filteredReferrals = referrals.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.referral_code.toLowerCase().includes(q) ||
      r.referrer_phone?.includes(q) ||
      r.referee_phone?.includes(q) ||
      r.referrer_name?.toLowerCase().includes(q) ||
      r.referee_name?.toLowerCase().includes(q)
    );
  });

  // Filtered devices
  const filteredDevices = devices.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.device_fingerprint.toLowerCase().includes(q) ||
      d.user_phone?.includes(q) ||
      d.user_name?.toLowerCase().includes(q)
    );
  });

  const MilestoneIcon = ({ paid }: { paid: boolean }) => (
    paid
      ? <Check className="w-4 h-4 text-emerald-500" />
      : <X className="w-4 h-4 text-muted-foreground/40" />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search code, phone, name…"
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals" className="gap-1.5">
            <Gift className="w-4 h-4" /> Referrals ({referrals.length})
          </TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5">
            <Award className="w-4 h-4" /> Rewards ({rewards.length})
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5">
            <Smartphone className="w-4 h-4" /> Devices ({devices.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══ REFERRALS TAB ═══ */}
        <TabsContent value="referrals">
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "pending", "active", "completed"].map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>

          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead>Referee</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-center">KYC</TableHead>
                      <TableHead className="text-center">1st Txn</TableHead>
                      <TableHead className="text-center">5 Txns</TableHead>
                      <TableHead>Rewarded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReferrals.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{r.referrer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.referrer_phone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{r.referee_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.referee_phone}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.referral_code}</TableCell>
                        <TableCell className="text-center"><MilestoneIcon paid={r.milestone_1_paid} /></TableCell>
                        <TableCell className="text-center"><MilestoneIcon paid={r.milestone_2_paid} /></TableCell>
                        <TableCell className="text-center"><MilestoneIcon paid={r.milestone_3_paid} /></TableCell>
                        <TableCell className="font-semibold">৳{r.total_rewarded}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredReferrals.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No referrals found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ REWARDS TAB ═══ */}
        <TabsContent value="rewards">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">৳{totalRewardsPaid}</p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{kycCount}</p>
                <p className="text-xs text-muted-foreground">KYC Rewards</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{firstTxnCount}</p>
                <p className="text-xs text-muted-foreground">1st Txn Rewards</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{fiveTxnCount}</p>
                <p className="text-xs text-muted-foreground">5-Txn Rewards</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{r.referrer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.referrer_phone}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {MILESTONE_LABELS[r.milestone] ?? r.milestone}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">৳{r.amount}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rewards.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No rewards paid yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DEVICES TAB ═══ */}
        <TabsContent value="devices">
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device Fingerprint</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Registered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDevices.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">
                          {d.device_fingerprint.slice(0, 16)}…
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{d.user_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{d.user_phone}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(d.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredDevices.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No device registrations found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
