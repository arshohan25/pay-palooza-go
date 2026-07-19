import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, MessageSquare, Mail, Sparkles, RotateCcw, Send } from "lucide-react";

/**
 * Canonical loyalty notification templates. Users of the admin UI can tweak
 * copy without shipping code. Placeholders are substituted server-side by
 * whatever sender (in-app / SMS / email) consumes the template.
 */
const LOYALTY_TEMPLATES = [
  {
    name: "loyalty_upgrade",
    label: "Tier upgrade 🎉",
    defaults: {
      title: "You've been upgraded to {{tier_name}}!",
      body: "Congratulations {{user_name}}! You've reached the {{tier_name}} tier on EasyPay Club. Enjoy {{fee_discount_pct}}% fee discount, {{limit_multiplier}}× higher limits and {{cashback_bonus_pct}}% cashback bonus.",
    },
  },
  {
    name: "loyalty_downgrade",
    label: "Tier downgrade",
    defaults: {
      title: "Your EasyPay Club tier changed",
      body: "Hi {{user_name}}, your tier is now {{tier_name}}. Keep transacting to climb back up — check /loyalty to see what's needed.",
    },
  },
  {
    name: "loyalty_override_expired",
    label: "Admin override expired",
    defaults: {
      title: "Your {{previous_tier}} boost has expired",
      body: "Your temporary {{previous_tier}} tier has ended. You're back on your earned {{tier_name}} tier. Reach {{next_tier}} by adding ৳{{remaining_amount}} more this month.",
    },
  },
  {
    name: "loyalty_upgrade_reminder",
    label: "Close-to-upgrade nudge",
    defaults: {
      title: "Almost {{next_tier}}! 🌟",
      body: "You're within 10% of unlocking the {{next_tier}} tier. Just {{remaining_amount}} more on your {{remaining_metric}} to get there.",
    },
  },
] as const;

type TemplateName = typeof LOYALTY_TEMPLATES[number]["name"];

interface Row {
  id?: string;
  name: string;
  title: string;
  body: string;
  category: string;
  is_active: boolean;
}

const SAMPLE = {
  user_name: "Rahim",
  tier_name: "Gold",
  next_tier: "Platinum",
  previous_tier: "Platinum",
  fee_discount_pct: "10",
  limit_multiplier: "1.50",
  cashback_bonus_pct: "1.0",
  remaining_amount: "৳3,200",
  remaining_metric: "30-day volume",
};

function render(text: string) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (SAMPLE as any)[k] ?? `{{${k}}}`);
}

function TemplateCard({ tpl }: { tpl: typeof LOYALTY_TEMPLATES[number] }) {
  const qc = useQueryClient();
  const { data: row, isLoading } = useQuery({
    queryKey: ["loyalty-template", tpl.name],
    queryFn: async (): Promise<Row> => {
      const { data } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("name", tpl.name)
        .maybeSingle();
      if (data) return data as Row;
      return { name: tpl.name, title: tpl.defaults.title, body: tpl.defaults.body, category: "loyalty", is_active: true };
    },
  });

  const [form, setForm] = useState<Row | null>(null);
  const current = form ?? row ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const payload = { ...current, category: "loyalty" };
      if (current.id) {
        const { error } = await supabase.from("notification_templates").update(payload).eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notification_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Template saved"); qc.invalidateQueries({ queryKey: ["loyalty-template", tpl.name] }); setForm(null); },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const testSend = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("notifications").insert({
        user_id: user.id,
        title: render(current.title),
        body: render(current.body),
        category: "loyalty",
        metadata: { kind: "template_preview", template: tpl.name },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Sent a preview notification to yourself"),
    onError: (e: any) => toast.error(e.message ?? "Send failed"),
  });

  if (isLoading || !current) return <Card><CardContent className="p-4 text-xs text-muted-foreground">Loading…</CardContent></Card>;

  const upd = (k: keyof Row, v: any) => setForm({ ...(current as Row), [k]: v });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles size={14} className="text-primary" /> {tpl.label}
          <Badge variant="outline" className="text-[9.5px] font-mono">{tpl.name}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Switch checked={current.is_active} onCheckedChange={(v) => upd("is_active", v)} />
            <span className="text-[10px] text-muted-foreground">{current.is_active ? "Active" : "Off"}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-[11px]">Title</Label>
          <Input value={current.title} onChange={(e) => upd("title", e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">Body</Label>
          <Textarea rows={3} value={current.body} onChange={(e) => upd("body", e.target.value)} />
        </div>

        <div className="rounded-xl border border-dashed p-3 bg-muted/30 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MessageSquare size={11} /> In-app / push preview</p>
          <div className="rounded-lg bg-background border p-2.5">
            <p className="text-[12.5px] font-bold">{render(current.title)}</p>
            <p className="text-[11.5px] text-muted-foreground">{render(current.body)}</p>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 pt-1"><Mail size={11} /> SMS / email preview</p>
          <div className="rounded-lg bg-background border p-2.5">
            <p className="text-[11.5px] whitespace-pre-wrap">{render(current.title)}{"\n"}{render(current.body)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="w-3.5 h-3.5 mr-1" /> {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...(current as Row), title: tpl.defaults.title, body: tpl.defaults.body })}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to default
          </Button>
          <Button size="sm" variant="ghost" onClick={() => testSend.mutate()} disabled={testSend.isPending}>
            <Send className="w-3.5 h-3.5 mr-1" /> Send test to me
          </Button>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Placeholders: {Object.keys(SAMPLE).map((k) => `{{${k}}}`).join(" ")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminLoyaltyNotificationTemplates() {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold">Loyalty notification templates</h3>
        <p className="text-[11px] text-muted-foreground">
          Copy used for in-app, SMS and email messages when a user's EasyPay Club tier changes.
          Placeholders are filled in per send.
        </p>
      </div>
      {LOYALTY_TEMPLATES.map((t) => <TemplateCard key={t.name} tpl={t} />)}
    </div>
  );
}
