import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, Check, X, Shield, Clock, ArrowRight, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccessRequests, type StaffAccessRequest, type RequestablePermissionKey } from "@/hooks/use-staff-access-requests";
import { useEffect } from "react";

interface Props {
  merchantId: string;
  /** When true, only render the inline pending inbox (no full screen). */
  inboxOnly?: boolean;
}

const PERM_LABEL: Record<RequestablePermissionKey, string> = {
  payouts: "Payouts (Send Money, Cash Out, Bank Transfer)",
  store_settings: "Store Settings",
  settlements: "Settlements",
  add_bank: "Add bank account",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface StaffLite { id: string; name: string; phone: string; role: string; permissions: Record<string, boolean> | null; }

function useMerchantStaffLite(merchantId: string) {
  const [staff, setStaff] = useState<StaffLite[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("merchant_staff")
        .select("id,name,phone,role,permissions")
        .eq("merchant_id", merchantId);
      if (!cancelled) setStaff((data || []) as any);
    };
    load();
    const ch = supabase
      .channel(`staff_lite_${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_staff", filter: `merchant_id=eq.${merchantId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [merchantId]);
  return staff;
}

export default function StaffAccessRequestsPanel({ merchantId, inboxOnly }: Props) {
  const { pending, history, loading, grant, deny, revoke } = useStaffAccessRequests(merchantId);
  const staff = useMerchantStaffLite(merchantId);
  const [showAll, setShowAll] = useState(false);
  const [denying, setDenying] = useState<StaffAccessRequest | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [tab, setTab] = useState<"pending" | "history" | "granted">("pending");

  const staffById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), [staff]);

  const handleGrant = async (r: StaffAccessRequest) => {
    const { error } = await grant(r.id);
    if (error) toast.error(error.message);
    else toast.success(`Granted ${r.display_label} to ${staffById[r.staff_id]?.name ?? "staff"}`);
  };

  const submitDeny = async () => {
    if (!denying) return;
    const { error } = await deny(denying.id, denyReason.trim() || undefined);
    if (error) toast.error(error.message);
    else toast.success("Request denied");
    setDenying(null);
    setDenyReason("");
  };

  const handleRevoke = async (staffId: string, key: RequestablePermissionKey, label: string) => {
    const { error } = await revoke({ staffId, permissionKey: key, displayLabel: label });
    if (error) toast.error(error.message);
    else toast.success(`Revoked ${label}`);
  };

  // ===== Inline inbox view (rendered above staff list) =====
  if (inboxOnly) {
    if (loading) return null;
    if (pending.length === 0) return null;
    return (
      <Card className="border-0 shadow-elevated bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
        <CardContent className="p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Inbox size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Access Requests</p>
                <p className="text-[10px] text-muted-foreground">{pending.length} waiting for your decision</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => { setTab("pending"); setShowAll(true); }}>
              View all <ArrowRight size={11} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {pending.slice(0, 3).map(r => {
              const s = staffById[r.staff_id];
              return (
                <div key={r.id} className="rounded-xl bg-background/60 backdrop-blur p-2.5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {(s?.name ?? "?").charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-foreground truncate">
                      {s?.name ?? "Staff"} <span className="text-muted-foreground font-normal">wants</span> {r.display_label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}{r.note ? ` · "${r.note}"` : ""}</p>
                  </div>
                  <Button size="sm" className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleGrant(r)}>
                    <Check size={11} className="mr-0.5" /> Grant
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setDenying(r)}>
                    <X size={11} />
                  </Button>
                </div>
              );
            })}
            {pending.length > 3 && (
              <button onClick={() => { setTab("pending"); setShowAll(true); }} className="w-full text-center text-[10px] text-amber-700 hover:underline py-1">
                + {pending.length - 3} more
              </button>
            )}
          </div>
        </CardContent>

        {/* Full screen sheet */}
        <FullScreenSheet
          open={showAll}
          onClose={() => setShowAll(false)}
          tab={tab}
          setTab={setTab}
          pending={pending}
          history={history}
          staff={staff}
          loading={loading}
          onGrant={handleGrant}
          onDenyOpen={(r) => setDenying(r)}
          onRevoke={handleRevoke}
        />

        {/* Deny dialog */}
        <Dialog open={!!denying} onOpenChange={(o) => { if (!o) { setDenying(null); setDenyReason(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Deny request?</DialogTitle>
              <DialogDescription className="text-xs">
                Optionally tell {denying ? (staffById[denying.staff_id]?.name ?? "the staff") : "the staff"} why.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Reason (optional)"
              maxLength={200}
              className="text-xs"
            />
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setDenying(null); setDenyReason(""); }}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={submitDeny}>Deny</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  // ===== Standalone full-screen mode (not currently used outside the inbox sheet) =====
  return (
    <FullScreenSheet
      open
      onClose={() => {}}
      tab={tab}
      setTab={setTab}
      pending={pending}
      history={history}
      staff={staff}
      loading={loading}
      onGrant={handleGrant}
      onDenyOpen={(r) => setDenying(r)}
      onRevoke={handleRevoke}
    />
  );
}

function FullScreenSheet({
  open, onClose, tab, setTab, pending, history, staff, loading, onGrant, onDenyOpen, onRevoke,
}: {
  open: boolean;
  onClose: () => void;
  tab: "pending" | "history" | "granted";
  setTab: (t: "pending" | "history" | "granted") => void;
  pending: StaffAccessRequest[];
  history: StaffAccessRequest[];
  staff: StaffLite[];
  loading: boolean;
  onGrant: (r: StaffAccessRequest) => void;
  onDenyOpen: (r: StaffAccessRequest) => void;
  onRevoke: (staffId: string, key: RequestablePermissionKey, label: string) => void;
}) {
  const staffById = Object.fromEntries(staff.map(s => [s.id, s]));

  const grantedList = useMemo(() => {
    const rows: Array<{ staff: StaffLite; key: RequestablePermissionKey; label: string }> = [];
    const KEYS: RequestablePermissionKey[] = ["payouts", "store_settings", "settlements"];
    for (const s of staff) {
      const perms = (s.permissions ?? {}) as Record<string, boolean>;
      for (const k of KEYS) {
        if (perms[k]) rows.push({ staff: s, key: k, label: PERM_LABEL[k] });
      }
    }
    return rows;
  }, [staff]);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl z-[80] max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }} overlayClassName="z-[80]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield size={16} className="text-primary" /> Staff Access
          </SheetTitle>
        </SheetHeader>

        {/* Segmented tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 mt-3 bg-muted/40 rounded-xl">
          {([
            { k: "pending", label: "Pending", count: pending.length },
            { k: "granted", label: "Granted", count: grantedList.length },
            { k: "history", label: "History", count: history.length },
          ] as const).map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`text-[11px] font-semibold py-1.5 rounded-lg transition ${tab === t.k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              {t.label} <span className="text-[10px] opacity-70">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {loading && [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}

          {!loading && tab === "pending" && (
            pending.length === 0 ? (
              <EmptyState icon={<Inbox size={22} />} title="No pending requests" subtitle="When staff request access, you'll see them here." />
            ) : pending.map(r => {
              const s = staffById[r.staff_id];
              return (
                <Card key={r.id} className="border-0 shadow-elevated">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold shrink-0">
                        {(s?.name ?? "?").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-foreground">{s?.name ?? "Staff"}</p>
                          {s?.role && <Badge variant="outline" className="text-[9px] px-1 py-0">{s.role}</Badge>}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock size={9} />{timeAgo(r.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-foreground mt-0.5">
                          Wants <span className="font-semibold">{r.display_label}</span>
                          <span className="text-muted-foreground"> · {PERM_LABEL[r.permission_key]}</span>
                        </p>
                        {r.note && <p className="text-[10px] text-muted-foreground italic mt-1">"{r.note}"</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1 h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onGrant(r)}>
                        <Check size={12} className="mr-1" /> Grant access
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px]" onClick={() => onDenyOpen(r)}>
                        <X size={12} className="mr-1" /> Deny
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {!loading && tab === "granted" && (
            grantedList.length === 0 ? (
              <EmptyState icon={<ShieldCheck size={22} />} title="No granted permissions yet" subtitle="When you grant access, you can revoke it from here." />
            ) : grantedList.map(({ staff: s, key, label }) => (
              <Card key={`${s.id}-${key}`} className="border-0 shadow-elevated">
                <CardContent className="p-3 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <ShieldCheck size={15} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{s.role}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => onRevoke(s.id, key, label)}>
                    <ShieldOff size={11} className="mr-1" /> Revoke
                  </Button>
                </CardContent>
              </Card>
            ))
          )}

          {!loading && tab === "history" && (
            history.length === 0 ? (
              <EmptyState icon={<Clock size={22} />} title="No history yet" />
            ) : history.map(r => {
              const s = staffById[r.staff_id];
              const tone =
                r.status === "granted" ? "text-emerald-600 bg-emerald-500/10 border-emerald-200" :
                r.status === "denied"  ? "text-destructive bg-destructive/10 border-destructive/30" :
                r.status === "revoked" ? "text-amber-700 bg-amber-500/10 border-amber-300" :
                                         "text-muted-foreground bg-muted border-border";
              return (
                <Card key={r.id} className="border-0 shadow-elevated">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {(s?.name ?? "?").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">{s?.name ?? "Staff"} · {r.display_label}</p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(r.decided_at || r.created_at)}{r.deny_reason ? ` · ${r.deny_reason}` : ""}</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] capitalize ${tone}`}>{r.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Button variant="outline" className="w-full mt-4" onClick={onClose}>Close</Button>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground mx-auto mb-2">{icon}</div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

/** Standalone trigger button shown in the staff tab header. */
export function AccessRequestsHeaderButton({ merchantId }: { merchantId: string }) {
  const { pending } = useStaffAccessRequests(merchantId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"pending" | "history" | "granted">("pending");
  const { history, grant, deny, revoke, loading } = useStaffAccessRequests(merchantId);
  const staff = useMerchantStaffLite(merchantId);
  const [denying, setDenying] = useState<StaffAccessRequest | null>(null);
  const [denyReason, setDenyReason] = useState("");

  const handleGrant = async (r: StaffAccessRequest) => {
    const { error } = await grant(r.id);
    if (error) toast.error(error.message); else toast.success("Granted");
  };
  const submitDeny = async () => {
    if (!denying) return;
    const { error } = await deny(denying.id, denyReason.trim() || undefined);
    if (error) toast.error(error.message); else toast.success("Denied");
    setDenying(null); setDenyReason("");
  };
  const handleRevoke = async (staffId: string, key: RequestablePermissionKey, label: string) => {
    const { error } = await revoke({ staffId, permissionKey: key, displayLabel: label });
    if (error) toast.error(error.message); else toast.success("Revoked");
  };

  return (
    <>
      <Card className="border-0 shadow-elevated cursor-pointer hover:bg-muted/30 transition" onClick={() => setOpen(true)}>
        <CardContent className="p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users size={15} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground">Access Requests & Permissions</p>
            <p className="text-[10px] text-muted-foreground">Grant or revoke payouts, settlements & store settings</p>
          </div>
          {pending.length > 0 && (
            <Badge className="bg-amber-500 text-white border-0 text-[10px]">{pending.length} new</Badge>
          )}
          <ArrowRight size={14} className="text-muted-foreground" />
        </CardContent>
      </Card>

      <FullScreenSheet
        open={open}
        onClose={() => setOpen(false)}
        tab={tab}
        setTab={setTab}
        pending={pending}
        history={history}
        staff={staff}
        loading={loading}
        onGrant={handleGrant}
        onDenyOpen={(r) => setDenying(r)}
        onRevoke={handleRevoke}
      />

      <Dialog open={!!denying} onOpenChange={(o) => { if (!o) { setDenying(null); setDenyReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deny request?</DialogTitle>
            <DialogDescription className="text-xs">Optionally explain why.</DialogDescription>
          </DialogHeader>
          <Textarea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Reason (optional)" maxLength={200} className="text-xs" />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDenying(null); setDenyReason(""); }}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={submitDeny}>Deny</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
