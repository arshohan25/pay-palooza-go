import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { teamSignIn } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Lock, User, Eye, EyeOff, ShieldCheck, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User as AuthUser } from "@supabase/supabase-js";

const TEAM_ROLES = ["admin", "compliance", "finance", "support", "operations", "marketing", "hr", "audit", "risk", "developer", "manager"];

const ROLE_ROUTES: Record<string, string> = {
  agent: "/agent",
  merchant: "/merchant",
  distributor: "/distributor",
  super_distributor: "/super-distributor",
};

async function getRedirectByRole(user: AuthUser): Promise<string> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = data?.map((r) => r.role) ?? [];
  if (roles.some((r) => TEAM_ROLES.includes(r))) return "/admin";
  for (const [role, path] of Object.entries(ROLE_ROUTES)) {
    if (roles.includes(role as any)) return path;
  }
  return "/admin";
}

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

  // 2FA state
  const [show2fa, setShow2fa] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying2fa, setVerifying2fa] = useState(false);
  const [teamEmail, setTeamEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const proceedToRedirect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const dest = user ? await getRedirectByRole(user) : "/admin";
    navigate(dest, { replace: true });
  };

  const start2faOrRedirect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { await proceedToRedirect(); return; }

    // Fetch team member email for 2FA
    const { data: tm } = await supabase
      .from("team_members")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();

    const email = (tm as any)?.email;
    if (!email) {
      // No email configured — skip 2FA
      toast.success("Welcome back!");
      await proceedToRedirect();
      return;
    }

    // Send OTP
    setTeamEmail(email);
    try {
      await supabase.functions.invoke("send-email-otp", {
        body: { email, purpose: "team_2fa" },
      });
      setShow2fa(true);
      toast.info(`Verification code sent to ${maskEmail(email)}`);
    } catch {
      toast.error("Failed to send verification code");
    }
  };

  const verify2fa = async () => {
    if (otpCode.length !== 6) return;
    setVerifying2fa(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-otp", {
        body: { email: teamEmail, action: "verify", code: otpCode, purpose: "team_2fa" },
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result?.error) throw new Error(result.error);

      toast.success("Welcome back!");
      setShow2fa(false);
      await proceedToRedirect();
    } catch (err: any) {
      toast.error(err.message || "Invalid or expired code");
      setOtpCode("");
    }
    setVerifying2fa(false);
  };

  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await supabase.functions.invoke("send-email-otp", {
        body: { email: teamEmail, purpose: "team_2fa" },
      });
      toast.info("New code sent");
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast.error("Failed to resend code");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }
    setLoading(true);
    try {
      await teamSignIn(username.trim(), password);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("has_logged_in, has_changed_password, temp_password")
          .eq("user_id", user.id)
          .maybeSingle();

        if (tm) {
          if (!tm.has_logged_in) {
            await supabase.from("team_members")
              .update({
                has_logged_in: true,
                first_login_at: new Date().toISOString(),
              } as any)
              .eq("user_id", user.id);
          }

          if (!tm.has_changed_password && tm.temp_password) {
            setShowPasswordChange(true);
            setLoading(false);
            return;
          }
        }
      }

      await start2faOrRedirect();
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
      await start2faOrRedirect();
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
          <img src="/icons/easypay-logo.webp" alt="EasyPay" className="w-16 h-16 rounded-2xl" />
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

      {/* 2FA OTP Dialog */}
      <Dialog open={show2fa} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-primary" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to <strong>{maskEmail(teamEmail)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={setOtpCode}
              disabled={verifying2fa}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            <button
              type="button"
              className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              disabled={resendCooldown > 0}
              onClick={resendOtp}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>

          <DialogFooter>
            <Button
              onClick={verify2fa}
              disabled={verifying2fa || otpCode.length !== 6}
              className="w-full"
            >
              {verifying2fa ? "Verifying..." : "Verify & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}
