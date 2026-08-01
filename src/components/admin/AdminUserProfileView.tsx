import { Fragment, useEffect, useState } from "react";
import { ChevronLeft, Loader2, User as UserIcon, Phone, Mail, Wallet, ShieldCheck, Calendar, Hash, ShieldOff, UserX, History, ChevronUp } from "lucide-react";
import { fetchUserByEasypayUid, toggleUserStatus, softDeleteUser } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminUserActivityPanel from "@/components/admin/AdminUserActivityPanel";
import AdminTxnRecordInline, { AdminTxnRow } from "@/components/admin/AdminTxnRecordInline";
import { resolveAdminLedgerLabel, resolveLedgerDirection } from "@/lib/adminLedger";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

interface Props {
  uid: string;
  onBack: () => void;
}

export default function AdminUserProfileView({ uid, onBack }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showTxns, setShowTxns] = useState(false);
  const [txns, setTxns] = useState<any[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);


  const reload = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const p = await fetchUserByEasypayUid(uid);
      if (!p) toast.error(`No user found for ${uid}`);
      setProfile(p);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setShowTxns(false); setTxns([]); reload(); /* eslint-disable-next-line */ }, [uid]);

  const loadTxns = async () => {
    if (!profile?.user_id) return;
    setTxnLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", profile.user_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setTxns(data ?? []);
    setTxnLoading(false);
  };

  const toggleTxns = async () => {
    const next = !showTxns;
    setShowTxns(next);
    if (next && txns.length === 0) await loadTxns();
  };

  const handleToggleStatus = async () => {
    if (!profile?.user_id) return;
    setActing(true);
    try {
      const next = await toggleUserStatus(profile.user_id, profile.status || "active");
      toast.success(next === "suspended" ? "User suspended" : "User reactivated");
      setProfile((p: any) => ({ ...p, status: next }));
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setActing(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!profile?.user_id) return;
    if (!confirm(`Soft-delete ${profile.name || profile.phone}? This is reversible from the Deleted Users panel.`)) return;
    setActing(true);
    try {
      await softDeleteUser(profile.user_id);
      toast.success("User deactivated");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Soft delete failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Users
        </Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {loading ? "Loading…" : profile?.name || "Unnamed user"}
              </CardTitle>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-foreground">
                  {profile?.easypay_uid || uid}
                </code>
                {profile?.status && (
                  <Badge variant={profile.status === "suspended" ? "destructive" : "secondary"} className="text-[10px]">
                    {profile.status}
                  </Badge>
                )}
                {profile?.kyc_status && (
                  <Badge variant="outline" className="text-[10px]">KYC: {profile.kyc_status}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
          ) : !profile ? (
            <div className="text-center text-muted-foreground text-sm py-6">
              No user matched EasyPay UID <code className="font-mono">{uid}</code>.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info icon={Phone} label="Phone" value={profile.phone} />
              <Info icon={Mail} label="Email" value={profile.email} />
              <Info icon={Wallet} label="Balance" value={`৳${Number(profile.balance || 0).toLocaleString()}`} />
              <Info icon={Hash} label="User ID" value={profile.user_id} mono />
              <Info
                icon={Calendar}
                label="Joined"
                value={profile.created_at ? `${new Date(profile.created_at).toLocaleDateString()} (${formatDistanceToNowStrict(new Date(profile.created_at), { addSuffix: true })})` : "—"}
              />
              <Info icon={ShieldCheck} label="EasyPay UID" value={profile.easypay_uid} mono />
            </div>
          )}
          {profile && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button
                size="sm"
                variant={profile.status === "suspended" ? "default" : "destructive"}
                disabled={acting}
                onClick={handleToggleStatus}
                className="gap-1.5 rounded-full"
              >
                {profile.status === "suspended" ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                {profile.status === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
              <Button
                size="sm"
                variant={showTxns ? "secondary" : "outline"}
                onClick={toggleTxns}
                className="gap-1.5 rounded-full"
              >
                {showTxns ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                {showTxns ? "Hide transactions" : "View transactions"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={acting}
                onClick={handleSoftDelete}
                className="gap-1.5 rounded-full text-rose-600 hover:text-rose-700 ml-auto"
              >
                <UserX className="w-4 h-4" /> Soft delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showTxns && profile?.user_id && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">
              Transactions {txns.length > 0 && <span className="text-muted-foreground text-xs font-normal">({txns.length})</span>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadTxns} disabled={txnLoading}>Refresh</Button>
          </CardHeader>
          <CardContent className="p-0">
            {txnLoading ? (
              <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
            ) : txns.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No transactions for this account</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Amount</th>
                      <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Fee</th>
                      <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Counterparty</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <Fragment key={t.id}>
                        <tr
                          key={t.id}
                          onClick={() => setExpandedId((cur) => (cur === t.id ? null : t.id))}
                          className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer ${expandedId === t.id ? "bg-muted/40" : ""}`}
                        >
                          <td className="px-4 py-2">
                            <Badge variant="secondary" className="text-[10px]">{resolveAdminLedgerLabel(t as AdminTxnRow)}</Badge>
                          </td>
                          <td className={`px-4 py-2 font-semibold ${resolveLedgerDirection(t as AdminTxnRow) === "credit" ? "text-emerald-600" : "text-foreground"}`}>
                            {resolveLedgerDirection(t as AdminTxnRow) === "credit" ? "+" : "−"}৳{Number(t.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">৳{Number(t.fee || 0).toLocaleString()}</td>
                          <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{t.recipient_name || t.recipient_phone || "—"}</td>
                          <td className="px-4 py-2"><Badge variant="outline" className="text-[10px]">{t.status}</Badge></td>
                          <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(t.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                        {expandedId === t.id && (
                          <tr key={`${t.id}-detail`} className="border-b border-border/50 bg-muted/10">
                            <td colSpan={6} className="p-3">
                              <AdminTxnRecordInline tx={t as AdminTxnRow} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {profile?.user_id && (
        <AdminKycStatusManager
          userId={profile.user_id}
          compact
          onChanged={(s) => setProfile((p: any) => ({ ...p, kyc_status: s }))}
        />
      )}

      {profile?.user_id && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminUserActivityPanel userId={profile.user_id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value, mono }: { icon: any; label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border/40">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</div>
      </div>
    </div>
  );
}
