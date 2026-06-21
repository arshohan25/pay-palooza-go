import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone, CheckCircle2, Loader2, Wifi, Shield, Zap } from "lucide-react";
import { getInstallPrompt, onPromptAvailable, isAppInstalled, clearPrompt } from "@/lib/installPromptStore";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const DISMISSED_KEY = "mfs_pwa_dismissed";

type InstallStage = "idle" | "detecting" | "preparing" | "downloading" | "installing" | "done" | "failed";

const STAGE_CONFIG: Record<InstallStage, { labelKey: TranslationKey; descKey: TranslationKey; icon: typeof Loader2; color: string; progress: number }> = {
  idle: { labelKey: "ipStageIdle", descKey: "ipDescIdle", icon: Download, color: "text-primary", progress: 0 },
  detecting: { labelKey: "ipStageDetecting", descKey: "ipDescDetecting", icon: Wifi, color: "text-blue-500", progress: 15 },
  preparing: { labelKey: "ipStagePreparing", descKey: "ipDescPreparing", icon: Shield, color: "text-amber-500", progress: 35 },
  downloading: { labelKey: "ipStageDownloading", descKey: "ipDescDownloading", icon: Loader2, color: "text-primary", progress: 65 },
  installing: { labelKey: "ipStageInstalling", descKey: "ipDescInstalling", icon: Zap, color: "text-emerald-500", progress: 85 },
  done: { labelKey: "ipStageDone", descKey: "ipDescDone", icon: CheckCircle2, color: "text-emerald-500", progress: 100 },
  failed: { labelKey: "ipStageFailed", descKey: "ipDescFailed", icon: X, color: "text-destructive", progress: 0 },
};

const InstallPrompt = ({ isAuthenticated = true }: { isAuthenticated?: boolean }) => {
  const [hasPrompt, setHasPrompt] = useState(!!getInstallPrompt());
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<InstallStage>("idle");
  const [installed, setInstalled] = useState(false);
  const location = useLocation();

  const isSuppressed = location.pathname.startsWith("/install") || !isAuthenticated;

  useEffect(() => {
    if (isAppInstalled() || localStorage.getItem(DISMISSED_KEY)) return;

    const unsub = onPromptAvailable(() => {
      setHasPrompt(true);
      setTimeout(() => setShow(true), 3000);
    });

    const onInstalled = () => {
      setInstalled(true);
      setStage("done");
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      unsub();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const simulateStages = useCallback(async () => {
    setStage("detecting");
    await new Promise((r) => setTimeout(r, 800));
    setStage("preparing");
    await new Promise((r) => setTimeout(r, 1000));
    setStage("downloading");
  }, []);

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;

    await simulateStages();

    setStage("installing");
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setStage("done");
        setInstalled(true);
        clearPrompt();
        setTimeout(() => setShow(false), 3000);
      } else {
        setStage("failed");
        setTimeout(() => setStage("idle"), 2000);
      }
    } catch {
      setStage("failed");
      setTimeout(() => setStage("idle"), 2000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  if (isSuppressed) return null;

  const currentConfig = STAGE_CONFIG[stage];
  const StageIcon = currentConfig.icon;
  const isProcessing = !["idle", "done", "failed"].includes(stage);

  return (
    <AnimatePresence>
      {show && !installed && hasPrompt && (
        <motion.div
          key="install-banner"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="bg-card border border-border/60 rounded-2xl shadow-float overflow-hidden">
            {/* Progress bar */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 3 }}
                  exit={{ height: 0 }}
                  className="w-full bg-muted overflow-hidden"
                >
                  <motion.div
                    className="h-full bg-primary rounded-r-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${currentConfig.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-4 flex items-center gap-3">
              {/* Animated icon */}
              <div className="w-11 h-11 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-glow relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stage}
                    initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.5, opacity: 0, rotate: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isProcessing ? (
                      <Loader2 size={20} className="text-primary-foreground animate-spin" />
                    ) : stage === "done" ? (
                      <CheckCircle2 size={20} className="text-primary-foreground" />
                    ) : (
                      <Smartphone size={20} className="text-primary-foreground" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Status text */}
              <div className="flex-1 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stage}
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -6, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p className="text-[13px] font-bold text-foreground leading-tight">
                      {stage === "idle" ? "Install EasyPay" : currentConfig.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {stage === "idle" && "Add to home screen for instant access"}
                      {stage === "detecting" && "Checking device compatibility..."}
                      {stage === "preparing" && "Optimizing for your device..."}
                      {stage === "downloading" && "Getting the latest version..."}
                      {stage === "installing" && "Almost there..."}
                      {stage === "done" && "Check your home screen!"}
                      {stage === "failed" && "You can try again anytime"}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {stage === "idle" && (
                  <>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={handleInstall}
                      className="flex items-center gap-1.5 px-3 py-1.5 gradient-primary text-primary-foreground text-[12px] font-semibold rounded-xl shadow-glow"
                    >
                      <Download size={13} strokeWidth={2.5} />
                      Install
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={handleDismiss}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Dismiss"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </motion.button>
                  </>
                )}
                {isProcessing && (
                  <div className="text-[11px] font-semibold text-primary tabular-nums">
                    {currentConfig.progress}%
                  </div>
                )}
                {stage === "done" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <CheckCircle2 size={18} className="text-primary" />
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
