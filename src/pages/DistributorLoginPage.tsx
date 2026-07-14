import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Smartphone, Lock, Users, ArrowRight, Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { APP_ROLE_HOME, APP_ROLE_LABEL, isRoleAllowedForApp } from "@/lib/appRole";
import { haptics } from "@/lib/haptics";

const DistributorLoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || rolesLoading || !isAuthenticated) return;
    if (isRoleAllowedForApp("distributor", roles as string[])) {
      navigate(APP_ROLE_HOME.distributor, { replace: true });
    }
  }, [isAuthenticated, authLoading, rolesLoading, roles, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      setError("Enter a valid 11-digit distributor mobile number.");
      return;
    }
    if (pin.length !== 4) {
      setError("Enter your 4-digit PIN.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(phone, pin);
      localStorage.setItem("mfs_has_authenticated", "1");
      haptics.success();
      toast.success("Signed in");
    } catch (err) {
      haptics.error();
      const msg =
        err instanceof Error && err.message.includes("Invalid login credentials")
          ? "Incorrect phone number or PIN."
          : err instanceof Error
            ? err.message
            : "Unable to sign in right now.";
      setError(msg);
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  const title = `${APP_ROLE_LABEL.distributor} — Sign in`;

  return (
    <div className="min-h-screen bg-[#0b1220] text-white flex flex-col">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content="EasyPay Distributor sign-in — create agents, manage float and track commissions." />
        <link rel="icon" href="/icons/role-distributor.png" />
        <link rel="apple-touch-icon" href="/icons/role-distributor.png" />
      </Helmet>

      <header className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-cyan-500 to-sky-500 px-6 pt-8 pb-8 text-center rounded-b-[28px]">
        <div className="absolute inset-0 opacity-20 pointer-events-none [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-2 shadow-lg">
            <Users size={26} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">EasyPay</p>
          <h1 className="text-xl font-extrabold mt-0.5">EasyPay Distributor Portal</h1>
          <p className="text-xs opacity-90 mt-1 max-w-[280px] mx-auto">
            Manage agents, float and commissions.
          </p>
        </div>
      </header>

      <div className="flex-1 px-5 pt-5">
        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
          onSubmit={handleSubmit}
          className="bg-[#111c2b] border border-white/10 rounded-[22px] p-5 space-y-4 shadow-2xl"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Distributor mobile number
            </label>
            <div className="relative">
              <Smartphone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                maxLength={11}
                value={phone}
                onChange={(e) => {
                  setError(null);
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
                }}
                className="w-full h-12 pl-10 pr-3 rounded-xl bg-black/30 border border-white/10 text-white text-base tracking-wider placeholder:text-white/30 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              4-digit PIN
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setError(null);
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  if (v.length > pin.length) haptics.light();
                  setPin(v);
                }}
                className="w-full h-12 pl-10 pr-3 rounded-xl bg-black/30 border border-white/10 text-white text-2xl text-center tracking-[0.8rem] focus:outline-none focus:border-cyan-400"
                placeholder="••••"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 disabled:opacity-60"
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Signing in…</>
            ) : (
              <>Sign in as Distributor <ArrowRight size={18} /></>
            )}
          </button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button type="button" onClick={() => navigate("/forgot-pin")} className="text-cyan-400 font-semibold hover:underline">
              Forgot PIN?
            </button>
            <span className="text-white/40">Distributors only</span>
          </div>
        </motion.form>
      </div>
    </div>
  );
};

export default DistributorLoginPage;
