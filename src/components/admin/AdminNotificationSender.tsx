
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Send, Tag, Gift, Megaphone, ShieldCheck, Coins, Users,
  Store, UserCheck, Crown, Truck, Image as ImageIcon, Link2, Copy, CheckCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

const CATEGORIES = [
  { value: "promo", label: "Promotion", icon: Megaphone, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "update", label: "Update", icon: ShieldCheck, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "offer", label: "Offer", icon: Tag, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { value: "coupon", label: "Coupon", icon: Gift, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "cashback", label: "Cashback", icon: Coins, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "system", label: "System", icon: Bell, color: "bg-muted text-muted-foreground" },
];

const ROLES = [
  { value: "all", label: "All Users", icon: Users },
  { value: "customer", label: "Customers", icon: UserCheck },
  { value: "agent", label: "Agents", icon: UserCheck },
  { value: "merchant", label: "Merchants", icon: Store },
  { value: "distributor", label: "Distributors", icon: Truck },
  { value: "super_distributor", label: "Super Distributors", icon: Crown },
];

const AREAS = [
  "All Areas", "Dhaka", "Chittagong", "Khulna", "Rajshahi", "Barishal", "Cumilla",
];

interface AdminNotif {
  id: string;
  title: string;
  body: string;
  category: string;
  target_roles: string[];
  target_area: string | null;
  target_user: string | null;
  sent_count: number;
  created_at: string;
  metadata: any;
}

export default function AdminNotificationSender() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("promo");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["all"]);
  const [targetArea, setTargetArea] = useState("All Areas");
  const [couponCode, setCouponCode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [linkedFeature, setLinkedFeature] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AdminNotif[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("admin_notifications" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((data as any[]) || []);
    setHistoryLoading(false);
  };

  const toggleRole = (role: string) => {
    if (role === "all") {
      setSelectedRoles(["all"]);
      return;
    }
    setSelectedRoles((prev) => {
      const without = prev.filter((r) => r !== "all" && r !== role);
      if (prev.includes(role)) return without.length === 0 ? ["all"] : without;
      return [...without, role];
    });
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const metadata: any = {};
      if (couponCode) metadata.coupon_code = couponCode;
      if (imageUrl) metadata.image_url = imageUrl;
      if (actionUrl) metadata.action_url = actionUrl;
      if (actionLabel) metadata.action_label = actionLabel;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-admin-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            category,
            target_roles: selectedRoles.includes("all") ? [] : selectedRoles,
            target_area: targetArea === "All Areas" ? null : targetArea.toLowerCase(),
            metadata,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send");

      toast.success(`Notification sent to ${result.sent_count} users`);
      setTitle("");
      setBody("");
      setCouponCode("");
      setImageUrl("");
      setActionUrl("");
      setActionLabel("");
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const catMeta = CATEGORIES.find((c) => c.value === category)!;

  return (
    <div className="space-y-6">
      {/* ── Compose ────────────────────────────────────────────── */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell size={18} className="text-primary" /> Compose Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      active
                        ? `${c.color} border-current shadow-sm`
                        : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                    }`}
                  >
                    <Icon size={13} /> {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Body */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 🎉 Eid Special Cashback!"
              className="font-semibold"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your notification message..."
              rows={3}
              maxLength={500}
            />
          </div>

          <Separator />

          {/* Target Roles */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Roles</Label>
            <div className="flex flex-wrap gap-3">
              {ROLES.map((r) => {
                const checked = selectedRoles.includes(r.value);
                const Icon = r.icon;
                return (
                  <label
                    key={r.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm font-medium ${
                      checked
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleRole(r.value)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Icon size={14} />
                    {r.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Target Area */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Area</Label>
            <Select value={targetArea} onValueChange={setTargetArea}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Optional Metadata */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Optional Extras
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Gift size={12} /> Coupon Code</Label>
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="e.g. EID2026" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><ImageIcon size={12} /> Image URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Link2 size={12} /> Action URL</Label>
                <Input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag size={12} /> Action Label</Label>
                <Input value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder="e.g. Claim Now" />
              </div>
            </div>
          </div>

          {/* Preview & Send */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Targeting: <span className="font-semibold text-foreground">{selectedRoles.includes("all") ? "All Users" : selectedRoles.join(", ")}</span>
              {targetArea !== "All Areas" && <> · <span className="font-semibold text-foreground">{targetArea}</span></>}
            </div>
            <Button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()} className="gap-2">
              <Send size={14} />
              {sending ? "Sending..." : "Send Notification"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── History ────────────────────────────────────────────── */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Sent History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No notifications sent yet</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {history.map((n) => {
                  const cat = CATEGORIES.find((c) => c.value === n.category);
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat?.color || "bg-muted text-muted-foreground"}`}>
                        {cat ? <cat.icon size={14} /> : <Bell size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.body}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {n.sent_count} sent
                          </Badge>
                          {(n.target_roles?.length ?? 0) > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {n.target_roles.join(", ")}
                            </Badge>
                          )}
                          {!n.target_roles?.length && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">All Users</Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
