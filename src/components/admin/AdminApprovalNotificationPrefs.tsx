import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, Mail, Smartphone, Siren, Moon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const CATEGORIES = [
  { key: "permission_approval_new",     label: "New approval requests",   desc: "When another admin creates a permission change awaiting your review." },
  { key: "permission_approval_result",  label: "Results of my requests",  desc: "When your own permission requests are approved or rejected." },
  { key: "permission_escalation",       label: "Escalation alerts",       desc: "When another admin's request is nearing expiry and you're pinged as backup." },
];

interface PrefRow { category: string; push_enabled: boolean; email_enabled: boolean; in_app_enabled: boolean; }

export default function AdminApprovalNotificationPrefs() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, PrefRow>>({});
  const [settings, setSettings] = useState({
    quiet_hours_enabled: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00",
    permission_escalation_opt_in: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: rows }, { data: s }] = await Promise.all([
        (supabase as any).from("notification_preferences")
          .select("category, push_enabled, email_enabled, in_app_enabled")
          .eq("user_id", user.id)
          .in("category", CATEGORIES.map((c) => c.key)),
        (supabase as any).from("user_notification_settings")
          .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end, permission_escalation_opt_in")
          .eq("user_id", user.id).maybeSingle(),
      ]);
      const map: Record<string, PrefRow> = {};
      for (const c of CATEGORIES) {
        map[c.key] = { category: c.key, push_enabled: true, email_enabled: true, in_app_enabled: true };
      }
      for (const r of (rows ?? []) as PrefRow[]) map[r.category] = { ...map[r.category], ...r };
      setPrefs(map);
      if (s) setSettings({
        quiet_hours_enabled: !!s.quiet_hours_enabled,
        quiet_hours_start: (s.quiet_hours_start ?? "22:00").slice(0, 5),
        quiet_hours_end: (s.quiet_hours_end ?? "07:00").slice(0, 5),
        permission_escalation_opt_in: s.permission_escalation_opt_in ?? true,
      });
      setLoading(false);
    })();
  }, [user]);

  const save = async (category: string, patch: Partial<PrefRow>) => {
    if (!user) return;
    const next = { ...prefs[category], ...patch };
    setPrefs((p) => ({ ...p, [category]: next }));
    setSaving(category);
    const { error } = await (supabase as any).from("notification_preferences").upsert(
      { user_id: user.id, ...next }, { onConflict: "user_id,category" });
    setSaving(null);
    if (error) toast.error(error.message);
  };

  const saveSettings = async (patch: Partial<typeof settings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSavingSettings(true);
    const { error } = await (supabase as any).from("user_notification_settings").upsert(
      { user_id: user.id, ...next }, { onConflict: "user_id" });
    setSavingSettings(false);
    if (error) toast.error(error.message);
  };

  if (loading) return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4" /> Approval notification channels</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_repeat(3,90px)] items-center px-4 py-2 border-b border-border/60 text-[10px] uppercase text-muted-foreground">
            <div>Category</div>
            <div className="text-center flex items-center justify-center gap-1"><Bell className="w-3 h-3" /> In-app</div>
            <div className="text-center flex items-center justify-center gap-1"><Smartphone className="w-3 h-3" /> Push</div>
            <div className="text-center flex items-center justify-center gap-1"><Mail className="w-3 h-3" /> Email</div>
          </div>
          {CATEGORIES.map((c) => {
            const p = prefs[c.key];
            return (
              <div key={c.key} className="grid grid-cols-[1fr_repeat(3,90px)] items-center px-4 py-3 border-b border-border/40 last:border-b-0">
                <div className="pr-4">
                  <p className="text-sm font-medium">{c.label} {saving === c.key && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</p>
                  <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                </div>
                <div className="flex justify-center"><Switch checked={p.in_app_enabled} onCheckedChange={(v) => save(c.key, { in_app_enabled: v })} /></div>
                <div className="flex justify-center"><Switch checked={p.push_enabled}  onCheckedChange={(v) => save(c.key, { push_enabled: v })} /></div>
                <div className="flex justify-center"><Switch checked={p.email_enabled} onCheckedChange={(v) => save(c.key, { email_enabled: v })} /></div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Siren className="w-4 h-4" /> Escalation & quiet hours</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Backup-admin escalation opt-in {savingSettings && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</p>
              <p className="text-[11px] text-muted-foreground">Receive alerts when another admin's request is nearing expiry.</p>
            </div>
            <Switch checked={settings.permission_escalation_opt_in} onCheckedChange={(v) => saveSettings({ permission_escalation_opt_in: v })} />
          </div>

          <div className="flex items-start justify-between gap-3 border-t border-border/40 pt-4">
            <div>
              <p className="text-sm font-medium flex items-center gap-1"><Moon className="w-3.5 h-3.5" /> Quiet hours</p>
              <p className="text-[11px] text-muted-foreground">Suppress push and email during these hours (in-app still delivered).</p>
            </div>
            <Switch checked={settings.quiet_hours_enabled} onCheckedChange={(v) => saveSettings({ quiet_hours_enabled: v })} />
          </div>
          {settings.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-muted-foreground">From
                <Input type="time" value={settings.quiet_hours_start}
                  onChange={(e) => setSettings((s) => ({ ...s, quiet_hours_start: e.target.value }))}
                  onBlur={() => saveSettings({ quiet_hours_start: settings.quiet_hours_start })} className="mt-1 h-9" />
              </label>
              <label className="text-[11px] text-muted-foreground">To
                <Input type="time" value={settings.quiet_hours_end}
                  onChange={(e) => setSettings((s) => ({ ...s, quiet_hours_end: e.target.value }))}
                  onBlur={() => saveSettings({ quiet_hours_end: settings.quiet_hours_end })} className="mt-1 h-9" />
              </label>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
            <Badge variant="outline" className="mr-1 text-[10px]">note</Badge>
            Email delivery is triggered by these preferences. Escalation notifications also honour the opt-in above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
