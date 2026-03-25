import { useEffect, useState } from "react";
import logo from "@/assets/easypay-logo.webp";

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDone, 250);
    }, 300);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden splash-container ${exiting ? "splash-exit" : ""}`}
      style={{ background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary)/0.7) 60%, hsl(var(--accent)/0.9))" }}
    >
      {/* Background orbs — pure CSS, no layout queries */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-white/8 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-40 h-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />

      {/* Pulsing rings — CSS animation */}
      <div className="relative flex items-center justify-center mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border-2 border-white/20 splash-ring"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}

        {/* Logo box — CSS animation */}
        <div className="relative w-24 h-24 rounded-[26px] bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center shadow-2xl splash-logo-box">
          <img
            src={logo}
            alt="EasyPay"
            className="w-16 h-16 object-contain"
            width={64}
            height={64}
            onError={(e) => { e.currentTarget.src = "/icons/easypay-logo.webp"; }}
          />
          {/* Shine — CSS animation */}
          <div className="absolute inset-0 rounded-[26px] overflow-hidden splash-shine">
            <div className="absolute top-0 left-0 w-8 h-full bg-white/30 skew-x-12" />
          </div>
        </div>
      </div>

      {/* App name */}
      <div className="text-center splash-text">
        <h1 className="text-4xl font-black text-white tracking-tight leading-none">EasyPay</h1>
        <p className="text-white/70 text-sm font-semibold mt-2 tracking-wide">বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট</p>
      </div>

      {/* Loading dots — CSS animation */}
      <div className="flex gap-2 mt-10 splash-dots">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-white/60 splash-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
