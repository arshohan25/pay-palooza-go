import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Gift, Award, Smartphone, Check, X, RefreshCw, MoreHorizontal, RotateCcw, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const { visible, flash } = useRealtimeIndicator();
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyRows, setBusyRows] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [{ data: refs }, { data: rews }, { data: devs }] = await Promise.all([
      supabase.from("referrals").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("referral_rewards").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("device_registrations").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => { fetchData(); flash(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_rewards" }, () => { fetchData(); flash(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // --- Milestone toggle ---
  const handleToggleMilestone = async (referralId: string, milestone: number, isPaid: boolean) => {
    if (busyRows.has(referralId)) return;
    setBusyRows(prev => new Set(prev).add(referralId));
    try {
      const action = isPaid ? "reset" : "pay";
      const { error } = await supabase.rpc("admin_toggle_referral_milestone", {
        p_referral_id: referralId,
        p_milestone: milestone,
        p_action: action,
      });
      if (error) throw error;
      toast.success(`Milestone ${milestone} ${action === "pay" ? "paid" : "reset"} successfully`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle milestone");
    } finally {
      setBusyRows(prev => { const n = new Set(prev); n.delete(referralId); return n; });
    }
  };

  const handleResetAll = async (referralId: string) => {
    if (busyRows.has(referralId)) return;
    setBusyRows(prev => new Set(prev).add(referralId));
    try {
      const { error } = await supabase.rpc("admin_reset_all_milestones", {
        p_referral_id: referralId,
      });
      if (error) throw error;
      toast.success("All milestones reset successfully");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset milestones");
    } finally {
      setBusyRows(prev => { const n = new Set(prev); n.delete(referralId); return n; });
    }
  };

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

  const MilestoneButton = ({ paid, onClick, disabled }: { paid: boolean; onClick: () => void; disabled: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
        paid
          ? "bg-emerald-100 text-emerald-600 hover:bg-red-100 hover:text-red-500 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          : "bg-muted text-muted-foreground/40 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={paid ? "Click to reset" : "Click to pay"}
    >
      {paid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
    </button>
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
      <RealtimeUpdateIndicator visible={visible} />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search code, phone, name…" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals" className="gap-1.5"><Gift className="w-4 h-4" /> Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5"><Award className="w-4 h-4" /> Rewards ({rewards.length})</TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5"><Smartphone className="w-4 h-4" /> Devices ({devices.length})</TabsTrigger>
        </TabsList>

        {/* ═══ REFERRALS TAB ═══ */}
        <TabsContent value="referrals">
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "pending", "active", "completed"].map(s => (
              <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">{s}</Button>
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
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReferrals.map(r => {
                      const isBusy = busyRows.has(r.id);
                      return (
                        <TableRow key={r.id} className={isBusy ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="text-sm font-medium text-foreground">{r.referrer_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.referrer_phone}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium text-foreground">{r.referee_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.referee_phone}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.referral_code}</TableCell>
                          <TableCell className="text-center">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /> :
                              <MilestoneButton paid={r.milestone_1_paid} disabled={isBusy} onClick={() => handleToggleMilestone(r.id, 1, r.milestone_1_paid)} />}
                          </TableCell>
                          <TableCell className="text-center">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /> :
                              <MilestoneButton paid={r.milestone_2_paid} disabled={isBusy} onClick={() => handleToggleMilestone(r.id, 2, r.milestone_2_paid)} />}
                          </TableCell>
                          <TableCell className="text-center">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /> :
                              <MilestoneButton paid={r.milestone_3_paid} disabled={isBusy} onClick={() => handleToggleMilestone(r.id, 3, r.milestone_3_paid)} />}
                          </TableCell>
                          <TableCell className="font-semibold">৳{r.total_rewarded}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isBusy}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleResetAll(r.id)}
                                  className="text-destructive focus:text-destructive"
                                  disabled={!r.milestone_1_paid && !r.milestone_2_paid && !r.milestone_3_paid}
                                >
                                  <RotateCcw className="w-4 h-4 mr-2" /> Reset All Milestones
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredReferrals.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Users className="w-7 h-7 text-muted-foreground" />
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">No referrals found</p>
                  <p className="text-xs text-muted-foreground mt-1">Referrals will appear here</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ REWARDS TAB ═══ */}
        <TabsContent value="rewards">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total Paid", value: `৳${totalRewardsPaid}` },
              { label: "KYC Rewards", value: kycCount },
              { label: "1st Txn Rewards", value: firstTxnCount },
              { label: "5-Txn Rewards", value: fiveTxnCount },
            ].map(s => (
              <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
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
                          <Badge variant="outline" className="text-xs">{MILESTONE_LABELS[r.milestone] ?? r.milestone}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">৳{r.amount}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rewards.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Gift className="w-7 h-7 text-muted-foreground" />
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">No rewards paid yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Reward history will appear here</p>
                </motion.div>
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
                        <TableCell className="font-mono text-xs">{d.device_fingerprint.slice(0, 16)}…</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{d.user_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{d.user_phone}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredDevices.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Smartphone className="w-7 h-7 text-muted-foreground" />
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">No device registrations found</p>
                  <p className="text-xs text-muted-foreground mt-1">Device data will appear here</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
