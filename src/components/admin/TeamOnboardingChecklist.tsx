import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, Circle, Lock, UserCircle, LogIn, Eye, EyeOff, X } from "lucide-react";

interface OnboardingData {
  has_logged_in: boolean;
  has_changed_password: boolean;
  has_completed_profile: boolean;
}

export default function TeamOnboardingChecklist() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Password change dialog
  const [showPwDialog, setShowPwDialog] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Profile setup dialog
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: tm } = await supabase
        .from("team_members")
        .select("has_logged_in, has_changed_password, has_completed_profile, display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (tm) {
        setData({
          has_logged_in: (tm as any).has_logged_in ?? false,
          has_changed_password: (tm as any).has_changed_password ?? false,
          has_completed_profile: (tm as any).has_completed_profile ?? false,
        });
        setProfileName((tm as any).display_name || "");
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !data || dismissed) return null;

  const steps = [
    { key: "has_logged_in", label: "First Login", icon: LogIn, done: data.has_logged_in },
    { key: "has_changed_password", label: "Change Password", icon: Lock, done: data.has_changed_password },
    { key: "has_completed_profile", label: "Complete Profile", icon: UserCircle, done: data.has_completed_profile },
  ];

  const completed = steps.filter(s => s.done).length;
  if (completed === 3) return null;

  const progress = Math.round((completed / 3) * 100);

  const handleChangePassword = async () => {
    if (newPw.length < 8) { toast.error("Min 8 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("team_members").update({
          has_changed_password: true,
          password_changed_at: new Date().toISOString(),
          temp_password: null,
        } as any).eq("user_id", user.id);
      }
      setData(prev => prev ? { ...prev, has_changed_password: true } : prev);
      setShowPwDialog(false);
      setNewPw("");
      setConfirmPw("");
      toast.success("Password changed!");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
    setChangingPw(false);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) { toast.error("Name is required"); return; }
    setSavingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase.from("team_members").update({
        display_name: profileName.trim(),
        has_completed_profile: true,
      } as any).eq("user_id", user.id);
      await supabase.from("profiles").update({ name: profileName.trim() }).eq("user_id", user.id);
      setData(prev => prev ? { ...prev, has_completed_profile: true } : prev);
      setShowProfileDialog(false);
      toast.success("Profile updated!");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
    setSavingProfile(false);
  };

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Onboarding Checklist</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{completed}/3</span>
              <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <Progress value={progress} className="h-2 mb-3" />
          <div className="space-y-2">
            {steps.map(step => (
              <div key={step.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {step.done ? (
                    <CheckCircle className="w-4 h-4 text-primary" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={`text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {step.label}
                  </span>
                </div>
                {!step.done && step.key === "has_changed_password" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowPwDialog(true)}>
                    Change Now
                  </Button>
                )}
                {!step.done && step.key === "has_completed_profile" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowProfileDialog(true)}>
                    Set Up
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={showPwDialog} onOpenChange={setShowPwDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Set a new secure password for your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} disabled={changingPw || newPw.length < 8 || newPw !== confirmPw} className="w-full">
              {changingPw ? "Changing..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Setup Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Profile</DialogTitle>
            <DialogDescription>Set up your display name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your name" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProfile} disabled={savingProfile || !profileName.trim()} className="w-full">
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
