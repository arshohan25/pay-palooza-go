import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ShieldAlert, Shield, ShieldCheck, ShieldX, ShieldOff,
  Smartphone, Globe, MapPin, Phone, Hash, Clock, User, ChevronDown, ChevronUp,
  Eye, CheckCircle, XCircle, Lock, RefreshCw, Fingerprint, Wifi, Monitor,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FraudAlert {
  id: string;
  user_id: string;
  transaction_id: string | null;
  rule_triggered: string;
  severity: string;
  status: string;
  details: any;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  name: string | null;
  phone: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const SEVERITY_BORDER: Record<string, string> = {
  low: "border-l-blue-400",
  medium: "border-l-amber-400",
  high: "border-l-orange-500",
  critical: "border-l-red-500",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  investigating: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  false_positive: "bg-muted text-muted-foreground",
};

const STATUS_ICON: Record<string, any> = {
  open: ShieldAlert,
  investigating: Eye,
  resolved: ShieldCheck,
  false_positive: ShieldOff,
};

export default function AdminFraudAlerts() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionDialog, setActionDialog] = useState<{ alert: FraudAlert; action: string } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fraud_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    const alertList = (data ?? []) as FraudAlert[];
    setAlerts(alertList);

    // Fetch profiles for all user_ids in alerts
    const userIds = [...new Set(alertList.map(a => a.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", userIds);
      const map = new Map<string, UserProfile>();
      (profileData ?? []).forEach(p => map.set(p.user_id, p));
      setProfiles(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    const { alert, action } = actionDialog;

    try {
      if (action === "investigate") {
        await supabase
          .from("fraud_alerts")
          .update({ status: "investigating" as any })
          .eq("id", alert.id);
        toast.success("Alert marked as investigating");
      } else if (action === "resolve") {
        await supabase
          .from("fraud_alerts")
          .update({
            status: "resolved" as any,
            resolved_at: new Date().toISOString(),
            resolution_notes: resolutionNotes || null,
          })
          .eq("id", alert.id);
        toast.success("Alert resolved");
      } else if (action === "dismiss") {
        await supabase
          .from("fraud_alerts")
          .update({
            status: "false_positive" as any,
            resolved_at: new Date().toISOString(),
            resolution_notes: resolutionNotes || "Dismissed as false positive",
          })
          .eq("id", alert.id);
        toast.success("Alert dismissed as false positive");
      } else if (action === "lock") {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase
          .from("feature_locks")
          .insert({
            target_user_id: alert.user_id,
            feature: "account",
            reason: `Fraud alert: ${alert.rule_triggered}`,
            locked_by: session.user.id,
          });
        await supabase
          .from("fraud_alerts")
          .update({ status: "resolved" as any, resolved_at: new Date().toISOString(), resolution_notes: "Account locked" })
          .eq("id", alert.id);
        toast.success("Account locked & alert resolved");
      }
      setActionDialog(null);
      setResolutionNotes("");
      loadAlerts();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredAlerts = filterStatus === "all"
    ? alerts
    : alerts.filter(a => a.status === filterStatus);

  const openCount = alerts.filter(a => a.status === "open").length;
  const investigatingCount = alerts.filter(a => a.status === "investigating").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getDetail = (details: any, key: string) => {
    if (!details || typeof details !== "object") return null;
    return details[key] ?? null;
  };

  return (
    <div className="space-y-4">
      {/* Header & stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Fraud Alerts
          </h3>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {investigatingCount} investigating · {alerts.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["all", "open", "investigating", "resolved", "false_positive"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? "default" : "outline"}
              className="text-xs h-7 capitalize"
              onClick={() => setFilterStatus(s)}
            >
              {s === "false_positive" ? "Dismissed" : s}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-7" onClick={loadAlerts}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredAlerts.map(alert => {
            const profile = profiles.get(alert.user_id);
            const isExpanded = expandedId === alert.id;
            const details = alert.details ?? {};
            const SIcon = STATUS_ICON[alert.status] ?? ShieldAlert;

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                layout
              >
                <Card className={`border-0 border-l-4 ${SEVERITY_BORDER[alert.severity] ?? "border-l-border"} shadow-[var(--shadow-card)] overflow-hidden`}>
                  {/* Summary row */}
                  <button
                    className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${SEVERITY_COLORS[alert.severity]}`}>
                      <SIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{alert.rule_triggered}</span>
                        <Badge variant="secondary" className={`text-[10px] ${SEVERITY_COLORS[alert.severity]}`}>
                          {alert.severity}
                        </Badge>
                        <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[alert.status]}`}>
                          {alert.status === "false_positive" ? "dismissed" : alert.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {profile?.name || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {profile?.phone || alert.user_id.slice(0, 8)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.created_at).toLocaleString("en-BD", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
                          {/* Detail grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {/* Device */}
                            <DetailItem
                              icon={Smartphone}
                              label="Device"
                              value={getDetail(details, "device") || "—"}
                            />
                            {/* OS */}
                            <DetailItem
                              icon={Monitor}
                              label="OS / Browser"
                              value={getDetail(details, "os") || getDetail(details, "browser") || "—"}
                            />
                            {/* IP Address */}
                            <DetailItem
                              icon={Wifi}
                              label="IP Address"
                              value={getDetail(details, "ip") || "—"}
                            />
                            {/* Location */}
                            <DetailItem
                              icon={MapPin}
                              label="Location"
                              value={getDetail(details, "city") || getDetail(details, "location") || "—"}
                            />
                            {/* Phone */}
                            <DetailItem
                              icon={Phone}
                              label="Phone Number"
                              value={profile?.phone || "—"}
                            />
                            {/* User ID */}
                            <DetailItem
                              icon={Fingerprint}
                              label="User ID"
                              value={alert.user_id.slice(0, 12) + "…"}
                            />
                            {/* Transaction ID */}
                            <DetailItem
                              icon={Hash}
                              label="Transaction ID"
                              value={alert.transaction_id?.slice(0, 12) ?? getDetail(details, "transaction_id")?.slice(0, 12) ?? "N/A"}
                            />
                            {/* Network */}
                            <DetailItem
                              icon={Globe}
                              label="Network / ISP"
                              value={getDetail(details, "isp") || getDetail(details, "network") || "—"}
                            />
                          </div>

                          {/* Extra context from details */}
                          {Object.keys(details).length > 0 && (
                            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alert Context</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                {Object.entries(details).map(([key, value]) => {
                                  // Skip keys already shown in the detail grid
                                  if (["device", "os", "browser", "ip", "city", "location", "isp", "network", "transaction_id"].includes(key)) return null;
                                  return (
                                    <div key={key} className="flex flex-col">
                                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                                      <span className="font-medium text-foreground">{String(value)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Resolution notes if resolved */}
                          {alert.resolution_notes && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-sm">
                              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Resolution Notes</p>
                              <p className="text-foreground">{alert.resolution_notes}</p>
                            </div>
                          )}

                          {/* Action buttons */}
                          {(alert.status === "open" || alert.status === "investigating") && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {alert.status === "open" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-8 gap-1.5"
                                  onClick={() => setActionDialog({ alert, action: "investigate" })}
                                >
                                  <Eye className="w-3.5 h-3.5" /> Investigate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300"
                                onClick={() => setActionDialog({ alert, action: "resolve" })}
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 gap-1.5"
                                onClick={() => setActionDialog({ alert, action: "dismiss" })}
                              >
                                <XCircle className="w-3.5 h-3.5" /> Dismiss
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs h-8 gap-1.5"
                                onClick={() => setActionDialog({ alert, action: "lock" })}
                              >
                                <Lock className="w-3.5 h-3.5" /> Lock Account
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredAlerts.length === 0 && (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {filterStatus === "all" ? "No fraud alerts — system is clean" : `No ${filterStatus} alerts`}
          </p>
        </div>
      )}

      {/* Action confirmation dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) { setActionDialog(null); setResolutionNotes(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize flex items-center gap-2">
              {actionDialog?.action === "lock" && <Lock className="w-4 h-4 text-destructive" />}
              {actionDialog?.action === "resolve" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
              {actionDialog?.action === "investigate" && <Eye className="w-4 h-4 text-amber-600" />}
              {actionDialog?.action === "dismiss" && <XCircle className="w-4 h-4 text-muted-foreground" />}
              {actionDialog?.action === "lock" ? "Lock Account" : actionDialog?.action} Alert
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "lock"
                ? "This will lock the user's account and resolve the alert. The user will be unable to log in."
                : actionDialog?.action === "investigate"
                ? "Mark this alert as under investigation."
                : actionDialog?.action === "resolve"
                ? "Resolve this alert with notes."
                : "Dismiss this alert as a false positive."}
            </DialogDescription>
          </DialogHeader>

          {actionDialog?.action !== "investigate" && (
            <Textarea
              placeholder="Add resolution notes (optional)…"
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              className="min-h-[80px]"
            />
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setActionDialog(null); setResolutionNotes(""); }}>
              Cancel
            </Button>
            <Button
              variant={actionDialog?.action === "lock" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
