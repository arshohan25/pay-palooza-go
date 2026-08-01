import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserDetails } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, Loader2, LogOut, ShieldCheck, Search } from "lucide-react";

interface ViewSession {
  id: string;
  admin_id: string;
  target_user_id: string;
  reason: string;
  started_at: string;
  ended_at: string | null;
}

/**
 * Read-only "view as user" console. No actions can be performed on behalf of the
 * user — every view opens an audit-logged session in `admin_view_as_sessions`.
 */
const AdminViewAsUser = () => {
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<ViewSession[]>([]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("admin_view_as_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(25);
    setHistory((data ?? []) as ViewSession[]);
  };

  useEffect(() => { loadHistory(); }, []);

  const startView = async () => {
    const trimmed = phone.trim();
    if (!/^01\d{9}$/.test(trimmed)) { toast.error("Enter a valid 11-digit mobile number"); return; }
    if (reason.trim().length < 4) { toast.error("A short reason is required for the audit trail"); return; }
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .eq("phone", trimmed)
        .maybeSingle();
      if (error) throw error;
      if (!profile) { toast.error("No account found for that number"); return; }

      const details = await fetchUserDetails(profile.user_id);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: viewSession, error: sessionError } = await supabase
        .from("admin_view_as_sessions")
        .insert({
          admin_id: session?.user?.id as string,
          target_user_id: profile.user_id,
          reason: reason.trim(),
        })
        .select("id")
        .single();
      if (sessionError) throw sessionError;

      setSessionId(viewSession.id);
      setSnapshot({ ...details, phone: profile.phone, name: profile.name });
      toast.success("Read-only session opened (audit logged)");
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Failed to open session");
    } finally {
      setLoading(false);
    }
  };

  const endView = async () => {
    if (sessionId) {
      await supabase
        .from("admin_view_as_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    setSessionId(null);
    setSnapshot(null);
    setPhone("");
    setReason("");
    loadHistory();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">View as user (read-only)</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">no actions allowed</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">User mobile number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (audit logged)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Support ticket #1234" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={startView} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Open read-only view
          </Button>
          {snapshot && (
            <Button variant="outline" onClick={endView}>
              <LogOut className="w-4 h-4 mr-2" /> End session
            </Button>
          )}
        </div>
      </Card>

      {snapshot && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">{snapshot.profile?.name || snapshot.name || "User"}</h3>
            <span className="text-xs text-muted-foreground">{snapshot.profile?.phone || snapshot.phone}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-xl bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Balance</p>
              <p className="text-sm font-semibold text-foreground">৳{Number(snapshot.profile?.balance ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Status</p>
              <p className="text-sm font-semibold text-foreground capitalize">{snapshot.profile?.status ?? "active"}</p>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">KYC</p>
              <p className="text-sm font-semibold text-foreground capitalize">{snapshot.kyc?.status ?? "not started"}</p>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Roles</p>
              <p className="text-sm font-semibold text-foreground">
                {snapshot.roles?.length ? snapshot.roles.map((r: any) => r.role).join(", ") : "customer"}
              </p>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Recent transactions</h4>
            {snapshot.transactions?.length ? (
              <div className="space-y-1.5">
                {snapshot.transactions.map((txn: any) => (
                  <div key={txn.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{txn.type}</Badge>
                      <span className="text-muted-foreground">{new Date(txn.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">৳{Number(txn.amount ?? 0).toLocaleString()}</span>
                      <Badge variant="outline" className="text-[10px]">{txn.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions</p>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm">Recent view-as sessions</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No sessions recorded.</p>
        ) : (
          history.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">{new Date(s.started_at).toLocaleString()}</span>
              <span className="truncate text-foreground">{s.reason}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{s.ended_at ? "closed" : "open"}</Badge>
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default AdminViewAsUser;
