import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Camera, QrCode, ShieldCheck, BarChart3, Gauge, Settings,
  Home, LogOut, ChevronRight, Building2, Upload, TrendingUp,
  Users, Activity, ArrowDownToLine, Banknote, Receipt, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import UserQrModal from "@/components/UserQrModal";

interface AgentMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  agentInfo: {
    business_name: string | null;
    commission_earned: number;
    max_float: number;
    customers_onboarded: number;
    status: string;
    territory_code: string | null;
  } | null;
  recentTxns: any[];
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const AgentMenuDrawer = ({ open, onClose, agentInfo, recentTxns }: AgentMenuDrawerProps) => {
  const { user, signOut } = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();

  const [qrOpen, setQrOpen] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [analyticsSheetOpen, setAnalyticsSheetOpen] = useState(false);
  const [kycSheetOpen, setKycSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<"daily" | "monthly" | "alltime">("daily");
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [allTxnsLoaded, setAllTxnsLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAllTxns = useCallback(async () => {
    if (!user || allTxnsLoaded) return;
    const { data } = await supabase
      .from("transactions")
      .select("type, amount, commission, created_at, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1000);
    setAllTxns(data ?? []);
    setAllTxnsLoaded(true);
  }, [user, allTxnsLoaded]);

  // Avatar upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadAvatar = async () => {
    if (!fileRef.current?.files?.[0] || !user) return;
    setUploading(true);
    const file = fileRef.current.files[0];
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("user_id", user.id);

    if (updateErr) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Avatar updated!");
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: {} }));
    }
    setPreviewUrl(null);
    setAvatarSheetOpen(false);
    setUploading(false);
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    const source = analyticsTab === "daily" ? recentTxns : allTxns;
    const now = new Date();
    const todayStr = now.toDateString();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    let filtered = source;
    if (analyticsTab === "daily") {
      filtered = source.filter(t => new Date(t.created_at).toDateString() === todayStr);
    } else if (analyticsTab === "monthly") {
      filtered = source.filter(t => {
        const d = new Date(t.created_at);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
    }

    const totalVolume = filtered.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const totalCommission = filtered.reduce((s: number, t: any) => s + Number(t.commission || 0), 0);
    const count = filtered.length;

    // Breakdown by type
    const byType: Record<string, { count: number; volume: number; commission: number }> = {};
    for (const t of filtered) {
      if (!byType[t.type]) byType[t.type] = { count: 0, volume: 0, commission: 0 };
      byType[t.type].count++;
      byType[t.type].volume += Number(t.amount || 0);
      byType[t.type].commission += Number(t.commission || 0);
    }

    return { totalVolume, totalCommission, count, byType };
  }, [analyticsTab, recentTxns, allTxns]);

  const typeIcons: Record<string, any> = {
    cashin: ArrowDownToLine, send: TrendingUp, receive: ArrowDownToLine,
    cashout: Banknote, banktransfer: Building2, payment: Receipt,
    recharge: Activity, paybill: Receipt, addmoney: ArrowDownToLine,
    b2b: ArrowRightLeft,
  };
  const typeLabels: Record<string, string> = {
    send: "Send Money", receive: "Received", cashout: "Cash Out",
    cashin: "Cash In", banktransfer: "Bank Transfer", payment: "Payment",
    recharge: "Recharge", paybill: "Bill Pay", addmoney: "Add Money",
  };

  const menuItems = [
    { icon: Camera, label: "Edit Avatar", action: () => setAvatarSheetOpen(true) },
    { icon: QrCode, label: "Share QR", action: () => setQrOpen(true) },
    { icon: ShieldCheck, label: "Customer KYC", action: () => setKycSheetOpen(true) },
    { icon: BarChart3, label: "Analytics", action: () => { setAnalyticsSheetOpen(true); loadAllTxns(); } },
    { icon: Gauge, label: "Transaction Limits", action: () => navigate("/limits") },
    { icon: Settings, label: "Settings", action: () => toast.info("Settings coming soon") },
  ];

  const bottomItems = [
    { icon: Home, label: "Back to Home", action: () => { onClose(); navigate("/"); } },
    { icon: LogOut, label: "Sign Out", action: async () => { await signOut(); navigate("/"); }, danger: true },
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-sm z-[71] bg-card shadow-float overflow-y-auto"
            >
              <div className="px-5 py-5 space-y-5">
                {/* Close */}
                <div className="flex justify-end">
                  <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                    <X size={15} />
                  </button>
                </div>

                {/* Profile Section */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAvatarSheetOpen(true)}
                    className="relative w-14 h-14 rounded-2xl overflow-hidden bg-muted flex items-center justify-center group shrink-0"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={24} className="text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={16} className="text-white" />
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {agentInfo?.business_name || "Agent Portal"}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className="bg-primary/10 text-primary border-0 text-[9px] px-1.5 py-0 font-semibold">
                        {agentInfo?.territory_code || "BD"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground capitalize">{agentInfo?.status || "active"}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{profile.phone || "—"}</p>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="space-y-1">
                  {menuItems.map(item => (
                    <button
                      key={item.label}
                      onClick={() => { item.action(); if (item.label !== "Edit Avatar" && item.label !== "Share QR" && item.label !== "Customer KYC" && item.label !== "Analytics") onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <item.icon size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-sm font-semibold text-foreground flex-1 text-left">{item.label}</span>
                      <ChevronRight size={14} className="text-muted-foreground/40" />
                    </button>
                  ))}
                </div>

                <div className="border-t border-border/50" />

                {/* Bottom Items */}
                <div className="space-y-1">
                  {bottomItems.map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors group ${item.danger ? "" : ""}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.danger ? "bg-destructive/10" : "bg-muted"}`}>
                        <item.icon size={16} className={item.danger ? "text-destructive" : "text-muted-foreground"} />
                      </div>
                      <span className={`text-sm font-semibold flex-1 text-left ${item.danger ? "text-destructive" : "text-foreground"}`}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <UserQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        userId={user?.id || ""}
        userName={agentInfo?.business_name || profile.displayName}
      />

      {/* Avatar Upload Sheet */}
      <Sheet open={avatarSheetOpen} onOpenChange={setAvatarSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">Change Avatar</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted flex items-center justify-center border-2 border-dashed border-border">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Current" className="w-full h-full object-cover" />
              ) : (
                <Camera size={32} className="text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} /> Choose Photo
            </Button>
            {previewUrl && (
              <Button
                className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold"
                disabled={uploading}
                onClick={uploadAvatar}
              >
                {uploading ? "Uploading..." : "Save Avatar"}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Analytics Sheet */}
      <Sheet open={analyticsSheetOpen} onOpenChange={setAnalyticsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">Analytics</SheetTitle>
          </SheetHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-muted/60 rounded-xl mb-4">
            {(["daily", "monthly", "alltime"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setAnalyticsTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${analyticsTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab === "daily" ? "Today" : tab === "monthly" ? "This Month" : "All Time"}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card className="p-3 border-0 shadow-card rounded-xl text-center">
              <Activity size={16} className="mx-auto text-primary mb-1" />
              <p className="text-lg font-extrabold text-foreground">{analytics.count}</p>
              <p className="text-[9px] text-muted-foreground font-semibold">Transactions</p>
            </Card>
            <Card className="p-3 border-0 shadow-card rounded-xl text-center">
              <TrendingUp size={16} className="mx-auto text-accent mb-1" />
              <p className="text-sm font-extrabold text-foreground">৳{fmt(analytics.totalVolume)}</p>
              <p className="text-[9px] text-muted-foreground font-semibold">Volume</p>
            </Card>
            <Card className="p-3 border-0 shadow-card rounded-xl text-center">
              <Banknote size={16} className="mx-auto text-primary mb-1" />
              <p className="text-sm font-extrabold text-primary">৳{fmt(analytics.totalCommission)}</p>
              <p className="text-[9px] text-muted-foreground font-semibold">Commission</p>
            </Card>
          </div>

          {/* Breakdown by type */}
          <h4 className="text-xs font-bold text-foreground mb-2">Breakdown by Type</h4>
          <div className="space-y-2">
            {Object.entries(analytics.byType).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No transactions in this period</p>
            ) : (
              Object.entries(analytics.byType)
                .sort((a, b) => b[1].volume - a[1].volume)
                .map(([type, data]) => {
                  const Icon = typeIcons[type] || Activity;
                  return (
                    <Card key={type} className="p-3 border-0 shadow-card rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon size={14} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">{typeLabels[type] || type}</p>
                          <p className="text-[10px] text-muted-foreground">{data.count} transactions</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-foreground">৳{fmt(data.volume)}</p>
                          {data.commission > 0 && (
                            <p className="text-[10px] font-semibold text-primary">+৳{fmt(data.commission)}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Customer KYC Sheet */}
      <Sheet open={kycSheetOpen} onOpenChange={setKycSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">Customer KYC Status</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <Card className="p-5 border-0 shadow-card rounded-2xl text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Users size={24} className="text-primary" />
              </div>
              <p className="text-3xl font-extrabold text-foreground">{agentInfo?.customers_onboarded ?? 0}</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">Customers Onboarded</p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 border-0 shadow-card rounded-xl text-center">
                <ShieldCheck size={20} className="mx-auto text-primary mb-2" />
                <p className="text-lg font-extrabold text-foreground">{agentInfo?.customers_onboarded ?? 0}</p>
                <p className="text-[10px] text-muted-foreground font-semibold">Registered</p>
              </Card>
              <Card className="p-4 border-0 shadow-card rounded-xl text-center">
                <Activity size={20} className="mx-auto text-accent mb-2" />
                <p className="text-lg font-extrabold text-foreground">—</p>
                <p className="text-[10px] text-muted-foreground font-semibold">KYC Verified</p>
              </Card>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Detailed customer KYC tracking will be available soon.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AgentMenuDrawer;
