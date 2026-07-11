import { useState, useRef } from "react";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Camera, QrCode, ShieldCheck, BarChart3, Bell,
  LogOut, ChevronRight, Building2, Upload, Activity,
  Users, Languages, ArrowDownToLine, ArrowRightLeft, Banknote,
  Receipt, UserPlus, History, Headphones, LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import UserQrModal from "@/components/UserQrModal";
import NotificationPreferences from "@/components/NotificationPreferences";
import { useI18n } from "@/lib/i18n";

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
  const { isDisabled } = useGlobalToggles();
  const { t, lang, toggleLang } = useI18n();

  const [qrOpen, setQrOpen] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [kycSheetOpen, setKycSheetOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  // Avatar upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("agImageMax"));
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
      toast.error(t("agUploadFailed"));
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("user_id", user.id);

    if (updateErr) {
      toast.error(t("agProfileUpdateFailed"));
    } else {
      toast.success(t("agAvatarUpdated"));
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: {} }));
    }
    setPreviewUrl(null);
    setAvatarSheetOpen(false);
    setUploading(false);
  };


  const openAfterClose = (fn: () => void) => {
    onClose();
    setTimeout(fn, 300);
  };

  const goto = (path: string) => { onClose(); navigate(path); };

  const navItems = [
    { icon: LayoutDashboard, label: t("agdAgentPortal"), action: () => goto("/agent"), toggleKey: null },
    { icon: ArrowDownToLine, label: t("cashIn"), action: () => goto("/agent/cashin"), toggleKey: "agent_cash_in" },
    { icon: ArrowRightLeft, label: t("agdB2BSend"), action: () => goto("/agent/b2b"), toggleKey: "agent_b2b" },
    { icon: Banknote, label: t("bank"), action: () => goto("/agent/bank"), toggleKey: "agent_bank_transfer" },
    { icon: Receipt, label: t("agdBillPay"), action: () => goto("/agent/billpay"), toggleKey: "agent_bill_pay" },
    { icon: UserPlus, label: t("agdRegister"), action: () => goto("/agent/register"), toggleKey: "agent_register" },
    { icon: History, label: t("history"), action: () => goto("/agent/history"), toggleKey: "agent_history" },
    { icon: BarChart3, label: t("agAnalytics"), action: () => goto("/agent/analytics"), toggleKey: "agent_analytics" },
  ].filter(item => !item.toggleKey || !isDisabled(item.toggleKey));

  const accountItems = [
    { icon: Camera, label: t("agEditAvatar"), sub: lang === "bn" ? "প্রোফাইল ছবি আপডেট করুন" : "Update your profile photo", tint: "bg-blue-500/10 text-blue-500", action: () => openAfterClose(() => setAvatarSheetOpen(true)), toggleKey: "agent_edit_avatar" },
    { icon: QrCode, label: t("agShareQr"), sub: lang === "bn" ? "গ্রাহকদের সাথে QR শেয়ার করুন" : "Share your agent QR code", tint: "bg-violet-500/10 text-violet-500", action: () => openAfterClose(() => setQrOpen(true)), toggleKey: "agent_share_qr" },
    { icon: ShieldCheck, label: t("agCustomerKyc"), sub: lang === "bn" ? "যাচাইকরণের স্ট্যাটাস দেখুন" : "Track verification status", tint: "bg-emerald-500/10 text-emerald-500", action: () => openAfterClose(() => setKycSheetOpen(true)), toggleKey: "agent_customer_kyc" },
    { icon: Bell, label: t("agNotifications"), sub: lang === "bn" ? "সতর্কতা পছন্দ ব্যবস্থাপনা" : "Manage alert preferences", tint: "bg-amber-500/10 text-amber-500", action: () => openAfterClose(() => setNotifSheetOpen(true)), toggleKey: "agent_notifications" },
  ].filter(item => !item.toggleKey || !isDisabled(item.toggleKey));

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/");
    } finally {
      setSigningOut(false);
      setLogoutOpen(false);
    }
  };


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
              className="fixed top-0 left-0 bottom-0 w-[86vw] max-w-sm z-[71] bg-card shadow-float flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header with profile */}
              <div className="px-4 pt-4 pb-3 border-b border-border/50 bg-card">
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => setAvatarSheetOpen(true)}
                    className="relative w-12 h-12 rounded-2xl overflow-hidden bg-muted flex items-center justify-center group shrink-0"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={20} className="text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={14} className="text-white" />
                    </div>
                  </button>
                  <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <X size={15} />
                  </button>
                </div>
                <h3 className="text-sm font-bold text-foreground truncate">
                  {agentInfo?.business_name || t("agAgentPortal")}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className="bg-primary/10 text-primary border-0 text-[9px] px-1.5 py-0 font-semibold">
                    {agentInfo?.territory_code || "BD"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground capitalize">{agentInfo?.status || t("agActive")}</span>
                  <span className="text-[10px] text-muted-foreground truncate">· {profile.phone || "—"}</span>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                {/* Navigate */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                    {t("agdRecentActivity").length > 0 ? (lang === "bn" ? "নেভিগেশন" : "Navigate") : "Navigate"}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {navItems.map(item => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className="flex items-center gap-2 px-2.5 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 group-hover:bg-primary/15">
                          <item.icon size={14} className="text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="text-[11.5px] font-semibold text-foreground flex-1 truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                    {lang === "bn" ? "অ্যাকাউন্ট" : "Account"}
                  </p>
                  <div className="space-y-0.5">
                    {accountItems.map(item => (
                      <button
                        key={item.label}
                        onClick={() => item.action()}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/60 active:scale-[0.99] transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10">
                          <item.icon size={14} className="text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="text-[13px] font-semibold text-foreground flex-1 text-left truncate">{item.label}</span>
                        <ChevronRight size={13} className="text-muted-foreground/40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                    {lang === "bn" ? "পছন্দসমূহ" : "Preferences"}
                  </p>
                  <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Languages size={14} className="text-muted-foreground" />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground flex-1 text-left truncate">{t("language")}</span>
                    <div className="relative flex items-center bg-muted/70 border border-border/60 rounded-full p-0.5 shrink-0">
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                        className="absolute top-0.5 bottom-0.5 gradient-primary rounded-full shadow-glow"
                        style={{ width: "calc(50% - 2px)", left: lang === "en" ? 2 : "calc(50% + 0px)" }}
                      />
                      <button
                        onClick={() => lang !== "en" && toggleLang()}
                        className={`relative z-10 px-2.5 h-6 text-[10.5px] font-bold rounded-full transition-colors ${lang === "en" ? "text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => lang !== "bn" && toggleLang()}
                        className={`relative z-10 px-2.5 h-6 text-[10.5px] font-bold rounded-full transition-colors ${lang === "bn" ? "text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        বাং
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky bottom logout */}
              <div className="px-3 py-3 border-t border-border/50 bg-card">
                <button
                  onClick={() => setLogoutOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-destructive/8 hover:bg-destructive/15 active:scale-[0.99] transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                    <LogOut size={15} className="text-destructive" />
                  </div>
                  <span className="text-sm font-bold text-destructive flex-1 text-left">{t("agSignOut")}</span>
                </button>
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
            <SheetTitle className="text-base font-extrabold">{t("agChangeAvatar")}</SheetTitle>
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
              <Upload size={14} /> {t("agChoosePhoto")}
            </Button>
            {previewUrl && (
              <Button
                className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold"
                disabled={uploading}
                onClick={uploadAvatar}
              >
                {uploading ? t("agUploading") : t("agSaveAvatar")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Customer KYC Sheet */}
      <Sheet open={kycSheetOpen} onOpenChange={setKycSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">{t("agCustomerKycStatus")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <Card className="p-5 border-0 shadow-card rounded-2xl text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Users size={24} className="text-primary" />
              </div>
              <p className="text-3xl font-extrabold text-foreground">{agentInfo?.customers_onboarded ?? 0}</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">{t("agCustomersOnboarded")}</p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 border-0 shadow-card rounded-xl text-center">
                <ShieldCheck size={20} className="mx-auto text-primary mb-2" />
                <p className="text-lg font-extrabold text-foreground">{agentInfo?.customers_onboarded ?? 0}</p>
                <p className="text-[10px] text-muted-foreground font-semibold">{t("agRegistered")}</p>
              </Card>
              <Card className="p-4 border-0 shadow-card rounded-xl text-center">
                <Activity size={20} className="mx-auto text-accent mb-2" />
                <p className="text-lg font-extrabold text-foreground">—</p>
                <p className="text-[10px] text-muted-foreground font-semibold">{t("agKycVerified")}</p>
              </Card>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              {t("agKycTrackingSoon")}
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications Preferences Sheet */}
      <Sheet open={notifSheetOpen} onOpenChange={setNotifSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="text-base font-bold">{t("agNotifPrefs")}</SheetTitle>
          </SheetHeader>
          <NotificationPreferences scope="agent" />
        </SheetContent>
      </Sheet>

      {/* Logout Confirmation */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("agSignOut")}?</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "bn"
                ? "আপনি কি নিশ্চিতভাবে সাইন আউট করতে চান? পুনরায় প্রবেশ করতে আপনাকে আবার লগইন করতে হবে।"
                : "Are you sure you want to sign out? You'll need to log in again to continue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut} className="rounded-xl">
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={signingOut}
              onClick={(e) => { e.preventDefault(); handleLogout(); }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {signingOut ? (lang === "bn" ? "সাইন আউট হচ্ছে..." : "Signing out...") : t("agSignOut")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AgentMenuDrawer;
