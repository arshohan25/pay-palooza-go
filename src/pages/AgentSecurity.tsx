import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, KeyRound, Smartphone, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ChangePinFlow from "@/components/ChangePinFlow";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";

type Device = {
  id: string;
  device_fp: string;
  portal: string;
  last_seen_at: string | null;
  created_at: string;
  token_expires_at: string | null;
  revoked_at: string | null;
};

const AgentSecurity = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPin, setShowPin] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentFp, setCurrentFp] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [fp, res] = await Promise.all([
        getDeviceFingerprint(),
        (supabase as any).from("device_registrations")
          .select("id, device_fp, portal, last_seen_at, created_at, token_expires_at, revoked_at")
          .eq("user_id", user.id)
          .order("last_seen_at", { ascending: false, nullsFirst: false }),
      ]);
      setCurrentFp(fp);
      setDevices((res?.data as Device[]) || []);
    } catch (err: any) {
      toast({ title: "Failed to load devices", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const revoke = async (id: string, isCurrent: boolean) => {
    if (isCurrent && !confirm("Sign out from THIS device? You will be logged out immediately.")) return;
    try {
      const { error } = await (supabase as any).from("device_registrations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Session revoked" });
      if (isCurrent) {
        await supabase.auth.signOut();
        navigate("/");
      } else {
        load();
      }
    } catch (err: any) {
      toast({ title: "Revoke failed", description: err.message, variant: "destructive" });
    }
  };

  const revokeAllOthers = async () => {
    if (!confirm("Sign out from ALL other devices?")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase as any).from("device_registrations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .neq("device_fp", currentFp)
        .is("revoked_at", null);
      if (error) throw error;
      toast({ title: "All other sessions revoked" });
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const active = devices.filter(d => !d.revoked_at);
  const revoked = devices.filter(d => d.revoked_at);

  return (
    <div className="min-h-screen bg-background pb-10">
      <motion.header
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-send px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/agent")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <Shield size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Security</h1>
              <p className="text-[9px] text-primary-foreground/60">PIN & active sessions</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {/* Change PIN */}
        <Card className="p-4 border-0 shadow-elevated rounded-2xl">
          <button onClick={() => setShowPin(true)} className="w-full flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <KeyRound size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Change PIN</p>
              <p className="text-[11px] text-muted-foreground">Update your 4-digit transaction PIN</p>
            </div>
            <span className="text-muted-foreground text-lg">›</span>
          </button>
        </Card>

        {/* Sessions */}
        <Card className="p-4 border-0 shadow-elevated rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-primary" />
              <p className="text-sm font-bold text-foreground">Active Sessions</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{active.length} active</span>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
          ) : active.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No active sessions</p>
          ) : (
            <div className="space-y-2">
              {active.map(d => {
                const isCurrent = d.device_fp === currentFp;
                return (
                  <div key={d.id} className="p-3 rounded-xl bg-muted/50 border border-border/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          {isCurrent && <CheckCircle2 size={12} className="text-primary" />}
                          {isCurrent ? "This device" : "Device"}
                          <span className="font-mono text-[9px] text-muted-foreground truncate">· {d.device_fp.slice(0, 10)}…</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Portal: <span className="font-semibold uppercase">{d.portal}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Last active: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          First registered: {new Date(d.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => revoke(d.id, isCurrent)}
                        className="h-8 px-2.5 text-[11px] gap-1 rounded-lg text-destructive border-destructive/40 hover:bg-destructive/10">
                        <LogOut size={11} />
                        {isCurrent ? "Sign out" : "Revoke"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {active.filter(d => d.device_fp !== currentFp).length > 0 && (
            <Button onClick={revokeAllOthers} variant="outline" className="w-full rounded-xl h-10 text-xs font-bold text-destructive border-destructive/40 hover:bg-destructive/10">
              Sign out from all other devices
            </Button>
          )}
        </Card>

        {revoked.length > 0 && (
          <Card className="p-4 border-0 shadow-elevated rounded-2xl">
            <p className="text-xs font-bold text-muted-foreground mb-2">Recently revoked ({revoked.length})</p>
            <div className="space-y-1">
              {revoked.slice(0, 5).map(d => (
                <div key={d.id} className="text-[10px] text-muted-foreground flex justify-between">
                  <span className="font-mono truncate">{d.device_fp.slice(0, 14)}…</span>
                  <span>{d.revoked_at ? new Date(d.revoked_at).toLocaleDateString() : ""}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {showPin && <ChangePinFlow onClose={() => { setShowPin(false); }} />}
    </div>
  );
};

export default AgentSecurity;
