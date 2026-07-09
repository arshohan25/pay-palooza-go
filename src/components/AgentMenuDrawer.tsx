import { useState, useRef, useCallback } from "react";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Camera, QrCode, ShieldCheck, BarChart3, Bell,
  Home, LogOut, ChevronRight, Building2, Upload, Activity,
  Users,
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
  const { t } = useI18n();

  const [qrOpen, setQrOpen] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [kycSheetOpen, setKycSheetOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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


  const openAfterClose = (fn: () => void) => {
    onClose();
    setTimeout(fn, 300);
  };

  const menuItems = [
    { icon: Camera, label: "Edit Avatar", action: () => openAfterClose(() => setAvatarSheetOpen(true)), toggleKey: "agent_edit_avatar" },
    { icon: QrCode, label: "Share QR", action: () => openAfterClose(() => setQrOpen(true)), toggleKey: "agent_share_qr" },
    { icon: ShieldCheck, label: "Customer KYC", action: () => openAfterClose(() => setKycSheetOpen(true)), toggleKey: "agent_customer_kyc" },
    { icon: BarChart3, label: "Analytics", action: () => { onClose(); navigate("/agent/analytics"); }, toggleKey: "agent_analytics" },
    { icon: Bell, label: "Notifications", action: () => openAfterClose(() => setNotifSheetOpen(true)), toggleKey: "agent_notifications" },
  ].filter(item => !item.toggleKey || !isDisabled(item.toggleKey));

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
              onClick={(e) => e.stopPropagation()}
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
                      onClick={() => item.action()}
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

      {/* Notifications Preferences Sheet */}
      <Sheet open={notifSheetOpen} onOpenChange={setNotifSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="text-base font-bold">Notification Preferences</SheetTitle>
          </SheetHeader>
          <NotificationPreferences scope="agent" />
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AgentMenuDrawer;
