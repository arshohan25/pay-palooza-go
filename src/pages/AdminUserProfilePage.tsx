import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, User as UserIcon, Phone, Mail, Wallet, ShieldCheck, Calendar, Hash, ShieldOff, UserX, History } from "lucide-react";
import { fetchUserByEasypayUid, toggleUserStatus, softDeleteUser } from "@/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminUserActivityPanel from "@/components/admin/AdminUserActivityPanel";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

export default function AdminUserProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

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

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [uid]);

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
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin#users")} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Back to Users
          </Button>
        </div>

        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
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
                      <Badge variant="outline" className="text-[10px]">
                        KYC: {profile.kyc_status}
                      </Badge>
                    )}
                  </div>
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
                  variant="outline"
                  onClick={() => navigate(`/admin#transactions`)}
                  className="gap-1.5 rounded-full"
                >
                  <History className="w-4 h-4" /> View transactions
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
