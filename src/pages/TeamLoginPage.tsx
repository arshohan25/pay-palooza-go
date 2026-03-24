import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { teamSignIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lock, User, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function TeamLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Forced password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }
    setLoading(true);
    try {
      await teamSignIn(username.trim(), password);

      // Check team_members for onboarding status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("has_logged_in, has_changed_password, temp_password")
          .eq("user_id", user.id)
          .maybeSingle();

        if (tm) {
          // Mark first login
          if (!tm.has_logged_in) {
            await supabase.from("team_members")
              .update({
                has_logged_in: true,
                first_login_at: new Date().toISOString(),
              } as any)
              .eq("user_id", user.id);
          }

          // Force password change if temp_password exists and password hasn't been changed
          if (!tm.has_changed_password && tm.temp_password) {
            setShowPasswordChange(true);
            setLoading(false);
            return;
          }
        }
      }

      toast.success("Welcome back!");
      const dest = await getRedirectByRole(user!);
      navigate(dest, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    }
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Update team_members
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("team_members")
          .update({
            has_changed_password: true,
            password_changed_at: new Date().toISOString(),
            temp_password: null,
          } as any)
          .eq("user_id", user.id);
      }

      toast.success("Password changed successfully!");
      setShowPasswordChange(false);
      navigate("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    }
    setChangingPassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img src="/icons/easypay-logo.png" alt="EasyPay" className="w-16 h-16 rounded-2xl" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Team Login</h1>
            <p className="text-sm text-muted-foreground">Sign in with your team credentials</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="staff-XXXX"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Contact your administrator if you need credentials.
        </p>
      </div>

      {/* Forced Password Change Dialog */}
      <Dialog open={showPasswordChange} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Change Your Password
            </DialogTitle>
            <DialogDescription>
              For security, you must change your temporary password before continuing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-destructive">Must be at least 8 characters</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handlePasswordChange}
              disabled={changingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full"
            >
              {changingPassword ? "Changing..." : "Change Password & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
