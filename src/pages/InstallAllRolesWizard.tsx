import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  Shield,
  ShoppingBag,
  Smartphone,
  Users,
  BarChart3,
  Copy,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { getRoleInstallUrl } from "@/lib/rolePwaOrigins";
import type { InstallableRoleKey } from "@/lib/appRole";

const INSTALLED_ROLES_KEY = "mfs_pwa_installed_roles";
const WIZARD_PROGRESS_KEY = "mfs_pwa_wizard_progress";

type WizardRole = {
  key: Exclude<InstallableRoleKey, "customer">;
  name: string;
  short: string;
  why: string;
  Icon: typeof Shield;
  gradient: string;
};

// Install order — least privileged to most privileged. Agents & merchants first
// (front-line devices), then distributor tiers, then admin last.
const STEPS: WizardRole[] = [
  {
    key: "agent",
    name: "EasyPay Agent",
    short: "Agent",
    why: "Front-line cash-in, cash-out and customer onboarding.",
    Icon: Smartphone,
    gradient: "from-orange-500 to-amber-500",
  },
  {
    key: "merchant",
    name: "EasyPay Merchant",
    short: "Merchant",
    why: "Accept payments, manage products and track sales.",
    Icon: ShoppingBag,
    gradient: "from-rose-500 to-pink-500",
  },
  {
    key: "distributor",
    name: "EasyPay Distributor",
    short: "Distributor",
    why: "Create agents, manage float and commissions.",
    Icon: Users,
    gradient: "from-blue-600 to-cyan-500",
  },
  {
    key: "super-distributor",
    name: "EasyPay Super Distributor",
    short: "Super Distributor",
    why: "Oversee distributors and network-wide allocation.",
    Icon: BarChart3,
    gradient: "from-violet-600 to-purple-500",
  },
  {
    key: "admin",
    name: "EasyPay Admin",
    short: "Admin",
    why: "Manage users, transactions and platform settings.",
    Icon: Shield,
    gradient: "from-emerald-600 to-teal-500",
  },
];

const readInstalled = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(INSTALLED_ROLES_KEY) || "{}");
  } catch {
    return {};
  }
};

const readProgress = (): number => {
  const n = Number(localStorage.getItem(WIZARD_PROGRESS_KEY));
  return Number.isFinite(n) && n >= 0 && n < STEPS.length ? n : 0;
};

const InstallAllRolesWizard = () => {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(readProgress);
  const [installed, setInstalled] = useState<Record<string, boolean>>(readInstalled);

  // Poll installed state so if the user completes install in another tab it reflects here.
  useEffect(() => {
    const tick = () => setInstalled(readInstalled());
    const id = window.setInterval(tick, 1500);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(WIZARD_PROGRESS_KEY, String(stepIndex));
  }, [stepIndex]);

  const current = STEPS[stepIndex];
  const currentInstalled = !!installed[current?.key ?? ""];
  const installUrl = useMemo(() => getRoleInstallUrl(current.key), [current.key]);
  const allDone = STEPS.every((s) => installed[s.key]);
  const completedCount = STEPS.filter((s) => installed[s.key]).length;

  const openInstaller = useCallback(() => {
    if (installUrl.startsWith(window.location.origin)) {
      navigate(`/install/${current.key}`);
    } else {
      window.open(installUrl, "_blank", "noopener");
    }
  }, [installUrl, navigate, current.key]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl);
      toast.success(`${current.short} install link copied`);
    } catch {
      toast.error("Copy failed — long-press the link to copy manually");
    }
  };

  const markInstalled = () => {
    const next = { ...readInstalled(), [current.key]: true };
    localStorage.setItem(INSTALLED_ROLES_KEY, JSON.stringify(next));
    setInstalled(next);
    toast.success(`${current.short} marked installed`);
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  };

  const skip = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  };

  const restart = () => {
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
    setStepIndex(0);
    toast.info("Wizard restarted");
  };

  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 sm:px-6 pt-10 pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/install")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={14} /> All installers
            </button>
            <button
              onClick={restart}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw size={12} /> Restart
            </button>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-3">
            <Download size={12} />
            Install all roles · wizard
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Install every EasyPay role app in order
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Each role installs as its own PWA. Follow these {STEPS.length} steps —
            we'll track progress and open the correct installer for you.
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5">
              <span>{completedCount} of {STEPS.length} installed</span>
              <span className="tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 pb-16 max-w-3xl mx-auto">
        {/* Stepper */}
        <ol className="flex items-center justify-between gap-1 mt-6 mb-6 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done = !!installed[s.key];
            const active = i === stepIndex;
            return (
              <li key={s.key} className="flex-1 min-w-[60px]">
                <button
                  type="button"
                  onClick={() => setStepIndex(i)}
                  className={`w-full flex flex-col items-center gap-1.5 px-1 py-2 rounded-xl transition ${
                    active ? "bg-primary/10" : "hover:bg-accent"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition ${
                      done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : active
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  <span
                    className={`text-[10px] font-semibold truncate max-w-full ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.short}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Current step card */}
        <AnimatePresence mode="wait">
          <motion.section
            key={current.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-lg"
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${current.gradient}`}
              aria-hidden
            />

            <div className="flex items-start gap-4">
              <div
                className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${current.gradient} flex items-center justify-center shadow-md`}
              >
                <current.Icon size={26} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    STEP {stepIndex + 1} / {STEPS.length}
                  </span>
                  {currentInstalled && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Installed
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-extrabold text-foreground mt-0.5">
                  {current.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{current.why}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-muted/50 border border-border p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Installer link
              </p>
              <p className="text-xs font-mono text-foreground break-all">{installUrl}</p>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={openInstaller}
                className={`h-11 rounded-xl bg-gradient-to-r ${current.gradient} text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition`}
              >
                <ExternalLink size={15} />
                Open {current.short} installer
              </button>
              <button
                onClick={copyLink}
                className="h-11 rounded-xl border border-border bg-background hover:bg-accent text-sm font-semibold text-foreground flex items-center justify-center gap-2 transition"
              >
                <Copy size={14} /> Copy link
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-background border border-border p-4">
              <p className="text-xs font-bold text-foreground mb-2">
                What to do on this step
              </p>
              <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
                <li>Tap <b>Open {current.short} installer</b>.</li>
                <li>On the installer page, tap <b>Install</b> and confirm in your browser.</li>
                <li>Return here and tap <b>Mark installed &amp; continue</b>.</li>
              </ol>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div className="flex items-center gap-2">
                {stepIndex < STEPS.length - 1 && (
                  <button
                    onClick={skip}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <SkipForward size={14} /> Skip
                  </button>
                )}
                <button
                  onClick={markInstalled}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.98]"
                >
                  {stepIndex === STEPS.length - 1 ? (
                    <>
                      <CheckCircle2 size={15} /> Mark installed &amp; finish
                    </>
                  ) : (
                    <>
                      Mark installed &amp; continue <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.section>
        </AnimatePresence>

        {/* Overview list */}
        <section className="mt-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Overview
          </h3>
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {STEPS.map((s, i) => {
              const done = !!installed[s.key];
              const active = i === stepIndex;
              return (
                <li
                  key={s.key}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    active ? "bg-primary/5" : ""
                  }`}
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  ) : (
                    <Circle size={18} className="text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {i + 1}. {s.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.why}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStepIndex(i)}
                    className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                  >
                    {active ? "Current" : "Go"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center"
          >
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-base font-bold text-foreground">
              All role apps installed 🎉
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Launch any role from your home screen — each app logs you into its
              own dashboard.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => navigate("/install/status")}
                className="h-10 px-4 rounded-xl border border-border bg-background text-sm font-semibold hover:bg-accent"
              >
                View install status
              </button>
              <button
                onClick={() => navigate("/install")}
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default InstallAllRolesWizard;
