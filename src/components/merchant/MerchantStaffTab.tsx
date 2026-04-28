import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Shield, Trash2, LinkIcon, AlertTriangle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const roleColors: Record<string, string> = {
  Manager: "bg-primary/10 text-primary border-primary/20",
  Cashier: "bg-blue-500/10 text-blue-700 border-blue-200",
  Viewer: "bg-muted text-muted-foreground border-border",
};

const roles = ["Manager", "Cashier", "Viewer"] as const;

interface Props { merchantId: string; }

export default function MerchantStaffTab({ merchantId }: Props) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("Cashier");
  const [saving, setSaving] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState<{ status: "idle" | "checking" | "found" | "missing"; name: string | null }>({ status: "idle", name: null });
  const [resendingId, setResendingId] = useState<string | null>(null);

  const sendInvite = async (staff_id: string, opts?: { silent?: boolean }) => {
    setResendingId(staff_id);
    const { data, error } = await supabase.functions.invoke("notify-staff-invite", { body: { staff_id } });
    setResendingId(null);
    if (error) {
      // 429 cooldown returns non-2xx; supabase-js surfaces it as error with context
      const ctx: any = (error as any).context;
      try {
        const body = ctx ? await ctx.json() : null;
        if (body?.cooldown) { toast.error(body.message || "Please wait before resending."); return; }
      } catch (_) { /* ignore */ }
      if (!opts?.silent) toast.error(error.message || "Failed to send invite");
      return;
    }
    if (!opts?.silent) {
      const r = (data as any)?.results || {};
      const channels: string[] = [];
      if (r.push?.sent > 0) channels.push("push");
      if (r.sms?.status === "sent") channels.push("SMS");
      if (r.email?.status === "sent") channels.push("email");
      toast.success(channels.length ? `Invite sent via ${channels.join(", ")}` : "Invite logged (no channels available)");
    }
  };

  // Debounced EasyPay phone lookup
  useEffect(() => {
    if (!showAdd) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 11) { setPhoneLookup({ status: "idle", name: null }); return; }
    setPhoneLookup({ status: "checking", name: null });
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("lookup_easypay_user_by_phone", { p_phone: digits });
      const row = Array.isArray(data) ? data[0] : null;
      if (row?.found) {
        setPhoneLookup({ status: "found", name: row.full_name });
        setName(prev => prev.trim() ? prev : (row.full_name || ""));
      } else {
        setPhoneLookup({ status: "missing", name: null });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, showAdd]);

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("merchant_staff")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
    const channel = supabase
      .channel("merchant_staff_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_staff", filter: `merchant_id=eq.${merchantId}` }, () => fetchStaff())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId]);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("merchant_staff").insert({ merchant_id: merchantId, name: name.trim(), phone: phone.trim(), role }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (data?.user_id) {
      toast.success("Staff added & linked to EasyPay account");
    } else {
      toast.success("Staff added (not yet on EasyPay)");
    }
    // Fire-and-forget invite send (push/SMS/email per availability)
    if (data?.id) sendInvite(data.id, { silent: true });
    setShowAdd(false); setName(""); setPhone(""); setRole("Cashier"); setPhoneLookup({ status: "idle", name: null });
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("merchant_staff").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteStaff = async (id: string) => {
    const { error } = await supabase.from("merchant_staff").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Staff removed");
  };

  const activeCount = staff.filter(s => s.is_active).length;
  const linkedCount = staff.filter(s => s.user_id).length;

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" /> Staff Accounts
        </h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowAdd(true)}>
          <Plus size={13} className="mr-1" /> Add Staff
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{staff.length}</p><p className="text-[10px] text-muted-foreground">Total Staff</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">{activeCount}</p><p className="text-[10px] text-muted-foreground">Active</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-blue-600">{linkedCount}</p><p className="text-[10px] text-muted-foreground">Linked</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-elevated">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center gap-2"><Shield size={14} className="text-primary" /><p className="text-xs font-semibold text-foreground">Role Permissions</p></div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
            <div><p className="font-semibold text-foreground">Manager</p><p>Full access, manage staff</p></div>
            <div><p className="font-semibold text-foreground">Cashier</p><p>Process orders, view products</p></div>
            <div><p className="font-semibold text-foreground">Viewer</p><p>View-only, no actions</p></div>
          </div>
        </CardContent>
      </Card>

      {staff.length === 0 ? (
        <Card className="border-0 shadow-elevated"><CardContent className="p-8 text-center text-muted-foreground text-xs">No staff added yet. Tap "Add Staff" to get started.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <Card key={s.id} className="border-0 shadow-elevated">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold text-foreground">{s.name.charAt(0)}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-foreground">{s.name}</p>
                        {s.user_id ? (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                            <LinkIcon size={8} className="mr-0.5" />Linked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-200">
                            <AlertTriangle size={8} className="mr-0.5" />Not on EasyPay
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{s.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] ${roleColors[s.role] || ""}`}>{s.role}</Badge>
                    <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteStaff(s.id)}><Trash2 size={13} /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent side="bottom" className="rounded-t-2xl z-[80]" overlayClassName="z-[80]">
          <SheetHeader><SheetTitle>Add Staff Member</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Staff name" /></div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="numeric" />
              {phoneLookup.status === "checking" && (
                <p className="text-[10px] text-muted-foreground mt-1">Checking EasyPay…</p>
              )}
              {phoneLookup.status === "found" && (
                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                  <LinkIcon size={10} /> On EasyPay{phoneLookup.name ? ` — ${phoneLookup.name}` : ""}. They'll get instant access.
                </p>
              )}
              {phoneLookup.status === "missing" && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> Not on EasyPay yet. They'll be linked automatically when they sign up.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <div className="flex gap-2 mt-1">
                {roles.map(r => (
                  <Button key={r} size="sm" variant={role === r ? "default" : "outline"} className="text-xs flex-1" onClick={() => setRole(r)}>{r}</Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Pick <span className="font-semibold text-foreground">Manager</span> for full dashboard access. Ask them to sign in at <span className="font-semibold text-foreground">/merchant-manager-login</span> using their <span className="font-semibold text-foreground">own phone &amp; PIN</span>.</p>
            </div>
            <Button className="w-full" disabled={saving} onClick={handleAdd}>{saving ? "Adding..." : "Add Staff"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
