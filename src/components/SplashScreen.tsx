import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/easypay-logo.png";

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 500); // wait for exit animation
    }, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary)/0.7) 60%, hsl(var(--accent)/0.9))" }}
        >
          {/* Background orbs */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-white/8 blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-0 w-40 h-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />

          {/* Pulsing ring */}
          <div className="relative flex items-center justify-center mb-8">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-white/20"
                initial={{ width: 96, height: 96, opacity: 0.6 }}
                animate={{
                  width: [96, 96 + (i + 1) * 38],
                  height: [96, 96 + (i + 1) * 38],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "easeOut",
                }}
              />
            ))}

            {/* Logo box */}
            <motion.div
              initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="relative w-24 h-24 rounded-[26px] bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center shadow-2xl"
            >
              <img src={logo} alt="EasyPay" className="w-16 h-16 object-contain" onError={(e) => { e.currentTarget.src = "/icons/easypay-logo.png"; }} />
              {/* Shine */}
              <motion.div
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 120, opacity: [0, 0.5, 0] }}
                transition={{ duration: 1.1, delay: 0.5, ease: "easeInOut" }}
                className="absolute inset-0 rounded-[26px] overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-8 h-full bg-white/30 skew-x-12" />
              </motion.div>
            </motion.div>
          </div>

          {/* App name */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-4xl font-black text-white tracking-tight leading-none">EasyPay</h1>
            <p className="text-white/70 text-sm font-semibold mt-2 tracking-wide">বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট</p>
          </motion.div>

          {/* Loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex gap-2 mt-10"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-white/60"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
