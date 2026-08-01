import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLoyaltyTiers, type LoyaltyTier } from "@/hooks/use-loyalty";
import LoyaltyBadge from "@/components/LoyaltyBadge";
import AdminLoyaltyNotificationTemplates from "@/components/admin/AdminLoyaltyNotificationTemplates";
import AdminLoyaltyTierLimits from "@/components/admin/AdminLoyaltyTierLimits";
import { Sparkles, Save, Search, Crown, RefreshCw } from "lucide-react";

/* -------------------------------------------------------------- */
/*  Tier editor                                                    */
/* -------------------------------------------------------------- */

function TierEditor({ tier, onClose }: { tier: LoyaltyTier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<LoyaltyTier>>(tier ?? {
    code: "", name: "", name_bn: "", rank: 1,
    min_volume_30d: 0, min_lifetime_txn_count: 0, min_wallet_balance: 0,
    min_addmoney_lifetime: 0, min_savings_balance: 0, min_combined_score: 0,
    limit_multiplier: 1, fee_discount_pct: 0, cashback_bonus_pct: 0,
    priority_support: false, badge_color: "#3b82f6", badge_icon: "Award",
    gradient_from: "#60a5fa", gradient_to: "#2563eb", description: "", is_active: true,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (tier?.id) {
        const { error } = await supabase.from("loyalty_tiers" as any).update(payload).eq("id", tier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loyalty_tiers" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tier ? "Tier updated" : "Tier created");
      qc.invalidateQueries({ queryKey: ["loyalty-tiers"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const upd = (k: keyof LoyaltyTier, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const Icon = (Icons as any)[form.badge_icon ?? "Award"] ?? Icons.Award;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {tier ? `Edit ${tier.name}` : "Create Tier"}
          </DialogTitle>
        </DialogHeader>

        {/* preview */}
        <div className="rounded-xl p-4 border" style={{
          background: `linear-gradient(135deg, ${form.gradient_from ?? form.badge_color}, ${form.gradient_to ?? form.badge_color})`,
        }}>
          <div className="flex items-center gap-3 text-white">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Icon size={24} />
            </div>
            <div>
              <p className="text-xs opacity-80">Preview</p>
              <p className="text-lg font-bold">{form.name || "Tier name"}</p>
              <p className="text-xs opacity-90">{form.description}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="basics">
          <TabsList className="w-full">
            <TabsTrigger value="basics" className="flex-1">Basics</TabsTrigger>
            <TabsTrigger value="thresholds" className="flex-1">Thresholds</TabsTrigger>
            <TabsTrigger value="perks" className="flex-1">Perks</TabsTrigger>
            <TabsTrigger value="visual" className="flex-1">Visual</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={form.code ?? ""} onChange={(e) => upd("code", e.target.value)} placeholder="starter" /></div>
              <div><Label>Rank</Label><Input type="number" value={form.rank ?? 1} onChange={(e) => upd("rank", +e.target.value)} /></div>
              <div><Label>Name (EN)</Label><Input value={form.name ?? ""} onChange={(e) => upd("name", e.target.value)} /></div>
              <div><Label>Name (BN)</Label><Input value={form.name_bn ?? ""} onChange={(e) => upd("name_bn", e.target.value)} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => upd("description", e.target.value)} rows={2} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active ?? true} onCheckedChange={(v) => upd("is_active", v)} />
              <Label>Active</Label>
            </div>
          </TabsContent>

          <TabsContent value="thresholds" className="space-y-3">
            <p className="text-xs text-muted-foreground">A user reaches this tier when ALL thresholds are met.</p>
            {[
              ["min_volume_30d", "30-day volume (৳)"],
              ["min_lifetime_txn_count", "Lifetime txn count"],
              ["min_wallet_balance", "Wallet balance (৳)"],
              ["min_addmoney_lifetime", "Add-money lifetime (৳)"],
              ["min_savings_balance", "Savings balance (৳)"],
              ["min_combined_score", "Combined score"],
            ].map(([k, label]) => (
              <div key={k}>
                <Label>{label}</Label>
                <Input type="number" value={(form as any)[k] ?? 0} onChange={(e) => upd(k as any, +e.target.value)} />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="perks" className="space-y-3">
            <div><Label>Limit multiplier (×)</Label><Input type="number" step="0.05" value={form.limit_multiplier ?? 1} onChange={(e) => upd("limit_multiplier", +e.target.value)} /></div>
            <div><Label>Fee discount (%)</Label><Input type="number" step="0.5" value={form.fee_discount_pct ?? 0} onChange={(e) => upd("fee_discount_pct", +e.target.value)} /></div>
            <div><Label>Cashback bonus (%)</Label><Input type="number" step="0.1" value={form.cashback_bonus_pct ?? 0} onChange={(e) => upd("cashback_bonus_pct", +e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.priority_support ?? false} onCheckedChange={(v) => upd("priority_support", v)} />
              <Label>Priority support</Label>
            </div>
          </TabsContent>

          <TabsContent value="visual" className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Badge color</Label><Input type="color" value={form.badge_color ?? "#3b82f6"} onChange={(e) => upd("badge_color", e.target.value)} /></div>
              <div><Label>Gradient from</Label><Input type="color" value={form.gradient_from ?? "#60a5fa"} onChange={(e) => upd("gradient_from", e.target.value)} /></div>
              <div><Label>Gradient to</Label><Input type="color" value={form.gradient_to ?? "#2563eb"} onChange={(e) => upd("gradient_to", e.target.value)} /></div>
            </div>
            <div>
              <Label>Icon (lucide name)</Label>
              <Input value={form.badge_icon ?? "Award"} onChange={(e) => upd("badge_icon", e.target.value)} placeholder="Award, Crown, Gem, Zap, Sparkles, Star" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Saving…" : "Save tier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------- */
/*  User override panel                                            */
/* -------------------------------------------------------------- */

function OverrideUserPanel() {
  const { data: tiers } = useLoyaltyTiers();
  const [phone, setPhone] = useState("");
  const [foundUser, setFoundUser] = useState<{ user_id: string; name: string | null; phone: string } | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [reason, setReason] = useState("");

  const search = async () => {
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return;
    const { data } = await supabase.from("profiles").select("user_id, name, phone").eq("phone", normalized).maybeSingle();
    if (!data) { toast.error("No account for this phone"); setFoundUser(null); return; }
    setFoundUser(data);
  };

  const apply = async () => {
    if (!foundUser) return;
    const { error } = await supabase.rpc("admin_set_loyalty_override" as any, {
      _target_user_id: foundUser.user_id,
      _tier_id: selectedTierId || null,
      _reason: reason || null,
      _until: null,
    });
    if (error) return toast.error(error.message);
    toast.success(selectedTierId ? "Override applied" : "Override cleared");
    setReason("");
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4" /> Manually override a user's tier</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
          <Button onClick={search}><Search className="w-4 h-4" /></Button>
        </div>
        {foundUser && (
          <>
            <div className="rounded-lg border p-3 bg-muted/40">
              <p className="text-sm font-medium">{foundUser.name ?? "Unnamed"}</p>
              <p className="text-xs text-muted-foreground">{foundUser.phone}</p>
            </div>
            <div>
              <Label>Set tier (empty = clear override)</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={selectedTierId}
                onChange={(e) => setSelectedTierId(e.target.value)}
              >
                <option value="">— Clear override (auto-calc) —</option>
                {tiers?.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            </div>
            <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            <Button onClick={apply} className="w-full">Apply override</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- */
/*  Main admin page                                                */
/* -------------------------------------------------------------- */

export default function AdminLoyaltyTiers() {
  const { data: tiers, isLoading, refetch } = useLoyaltyTiers();
  const [editing, setEditing] = useState<LoyaltyTier | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> EasyPay Club
          </h2>
          <p className="text-sm text-muted-foreground">
            Promotional loyalty tiers earned by usage. Not a role — every user is still a customer.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={() => setCreating(true)}>+ New tier</Button>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Tier catalog</TabsTrigger>
          <TabsTrigger value="limits">Tier limits</TabsTrigger>
          <TabsTrigger value="override">User override</TabsTrigger>
          <TabsTrigger value="templates">Notification templates</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {tiers?.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="h-1" style={{
                background: `linear-gradient(90deg, ${t.gradient_from ?? t.badge_color}, ${t.gradient_to ?? t.badge_color})`,
              }} />
              <CardContent className="p-4 flex items-center gap-4">
                <LoyaltyBadge tier={t} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{t.name}</p>
                    <Badge variant="outline" className="text-[10px]">Rank {t.rank}</Badge>
                    {!t.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                    {t.priority_support && <Badge className="text-[10px] bg-primary/10 text-primary">Priority support</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    <span>30d ≥ ৳{t.min_volume_30d.toLocaleString()}</span>
                    <span>Txn ≥ {t.min_lifetime_txn_count}</span>
                    <span>Wallet ≥ ৳{t.min_wallet_balance.toLocaleString()}</span>
                    <span>Limits ×{t.limit_multiplier}</span>
                    <span>Fee −{t.fee_discount_pct}%</span>
                    <span>Cashback +{t.cashback_bonus_pct}%</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(t)}>Edit</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="limits">
          <AdminLoyaltyTierLimits />
        </TabsContent>

        <TabsContent value="override">
          <OverrideUserPanel />
        </TabsContent>

        <TabsContent value="templates">
          <AdminLoyaltyNotificationTemplates />
        </TabsContent>
      </Tabs>

      {(editing || creating) && (
        <TierEditor tier={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}
