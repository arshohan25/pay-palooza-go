import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { getInstallPrompt, onPromptAvailable, isAppInstalled, clearPrompt } from "@/lib/installPromptStore";

const DISMISSED_KEY = "mfs_pwa_dismissed";

const InstallPrompt = () => {
  const [hasPrompt, setHasPrompt] = useState(!!getInstallPrompt());
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);
  const location = useLocation();

  const isSuppressed = location.pathname.startsWith("/install") || location.pathname.startsWith("/auth");

  useEffect(() => {
    if (isAppInstalled() || localStorage.getItem(DISMISSED_KEY)) return;

    const unsub = onPromptAvailable(() => {
      setHasPrompt(true);
      setTimeout(() => setShow(true), 3000);
    });

    window.addEventListener("appinstalled", () => setInstalled(true));
    return unsub;
  }, []);

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      clearPrompt();
    }
    setShow(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  // Don't show global banner on /install/* pages
  if (isInstallRoute) return null;

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
          <div className="bg-card border border-border/60 rounded-2xl shadow-float p-4 flex items-center gap-3">
            <div className="w-11 h-11 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-glow">
              <Smartphone size={20} className="text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground leading-tight">Install EasyPay</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Add to home screen for the best experience</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleInstall} className="flex items-center gap-1.5 px-3 py-1.5 gradient-primary text-primary-foreground text-[12px] font-semibold rounded-xl shadow-glow">
                <Download size={13} strokeWidth={2.5} />
                Install
              </motion.button>
              <motion.button whileTap={{ scale: 0.88 }} onClick={handleDismiss} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Dismiss">
                <X size={14} strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
