import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCircle2, Copy, Loader2, RefreshCw, AlertCircle, KeyRound, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePushSubscription } from "@/hooks/use-push-subscription";

interface VapidStatus {
  public: boolean;
  private: boolean;
  subject: boolean;
  ready: boolean;
  public_key: string | null;
}

export default function AdminPushSetupWizard() {
  const { toast } = useToast();
  const { supported, configured, subscribed, subscribe, sendTest, busy, checkExistingSubscription } = usePushSubscription();
  const [status, setStatus] = useState<VapidStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = async () => {
    setChecking(true);
    const { data, error } = await (supabase as any).functions.invoke("check-vapid-status", { method: "POST" });
    setChecking(false);
    if (error) { toast({ title: "Status check failed", description: error.message, variant: "destructive" }); return; }
    setStatus(data);
  };

  useEffect(() => { refresh(); checkExistingSubscription(); /* eslint-disable-next-line */ }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const handleSubscribe = async () => {
    const r = await subscribe();
    if (r.ok) toast({ title: "Subscribed on this device 🔔" });
    else toast({ title: "Subscribe failed", description: r.error, variant: "destructive" });
  };

  const handleTest = async () => {
    setTesting(true);
    const r = await sendTest();
    setTesting(false);
    if (r.ok) toast({ title: "Test sent", description: `Delivered to ${r.data?.sent ?? 0} device(s)` });
    else toast({ title: "Test failed", description: r.error, variant: "destructive" });
  };

  const Step = ({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border/60 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${done ? "bg-green-500 text-white" : "bg-primary/15 text-primary"}`}>
          {done ? <CheckCircle2 size={14} /> : n}
        </div>
        <p className="text-[13.5px] font-bold text-foreground">{title}</p>
      </div>
      <div className="text-[12px] text-muted-foreground space-y-2 pl-9">{children}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Bell size={18} className="text-primary" />
          <p className="text-[15px] font-bold text-foreground">Web Push Setup</p>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Enable browser push so buyers get instant order updates and merchants get payout alerts.
        </p>
        <Button onClick={refresh} disabled={checking} variant="outline" size="sm" className="mt-3 rounded-xl gap-1.5 h-8 text-[12px]">
          {checking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Re-check status
        </Button>
      </div>

      <Step n={1} done={false} title="Generate VAPID keys">
        <p>Run this on any machine with Node:</p>
        <div className="bg-muted/60 rounded-lg p-2.5 flex items-center justify-between gap-2 font-mono text-[11px]">
          <code className="truncate">npx web-push generate-vapid-keys</code>
          <button onClick={() => copy("npx web-push generate-vapid-keys", "Command")}
            className="shrink-0 p-1 rounded bg-background hover:bg-muted">
            <Copy size={11} />
          </button>
        </div>
        <p>You'll get a Public Key and a Private Key.</p>
      </Step>

      <Step n={2} done={!!status?.ready} title="Add secrets to Lovable Cloud">
        <p>Open <strong>Connectors → Lovable Cloud → Secrets</strong> and add:</p>
        <ul className="space-y-1.5 mt-1">
          {[
            { name: "VAPID_PUBLIC_KEY", ok: status?.public, hint: "the public key from step 1" },
            { name: "VAPID_PRIVATE_KEY", ok: status?.private, hint: "the private key (kept server-side)" },
            { name: "VAPID_SUBJECT", ok: status?.subject, hint: "e.g. mailto:support@yourdomain.com" },
          ].map(s => (
            <li key={s.name} className="flex items-center gap-2">
              {s.ok ? <CheckCircle2 size={13} className="text-green-600 shrink-0" /> : <AlertCircle size={13} className="text-amber-500 shrink-0" />}
              <code className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded">{s.name}</code>
              <span className="text-[11px]">— {s.hint}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 pt-2 border-t border-border/40">
          Also add <code className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded">VITE_VAPID_PUBLIC_KEY</code> as a <strong>build secret</strong> (Workspace Settings → Build Secrets) with the <em>same</em> public key — it's needed in the browser to subscribe.
        </p>
      </Step>

      <Step n={3} done={subscribed} title="Subscribe this device">
        {!supported ? (
          <p className="text-amber-600">This browser doesn't support web push. Try Chrome, Edge, or an installed PWA.</p>
        ) : !configured ? (
          <p className="text-amber-600">Add <code>VITE_VAPID_PUBLIC_KEY</code> as a build secret first, then republish.</p>
        ) : subscribed ? (
          <p className="text-green-600 flex items-center gap-1.5"><CheckCircle2 size={13} /> This device is subscribed.</p>
        ) : (
          <Button onClick={handleSubscribe} disabled={busy} size="sm" className="rounded-xl gap-1.5 h-8 text-[12px]">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />}
            Allow notifications
          </Button>
        )}
      </Step>

      <Step n={4} done={false} title="Send a test push">
        <p>Once steps 1–3 are green, send yourself a test:</p>
        <Button onClick={handleTest} disabled={testing || !status?.ready || !subscribed}
          size="sm" className="rounded-xl gap-1.5 h-8 text-[12px]">
          {testing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Send test push to my device
        </Button>
      </Step>

      <div className="text-center pt-2">
        <p className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1.5">
          <KeyRound size={11} /> All keys stay server-side except the public key.
        </p>
      </div>
    </div>
  );
}
