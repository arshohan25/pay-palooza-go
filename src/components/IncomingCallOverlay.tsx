import { motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";

interface IncomingCallOverlayProps {
  callerName: string;
  mode: "audio" | "video";
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallOverlay = ({
  callerName,
  mode,
  onAccept,
  onReject,
}: IncomingCallOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: "-100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "-100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between pb-20 pt-28 bg-gradient-to-b from-primary/95 to-primary/70 backdrop-blur-xl"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Caller info */}
      <div className="flex flex-col items-center gap-5 z-10">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="relative"
        >
          {/* Ripple rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-white/30"
              animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.7,
                ease: "easeOut",
              }}
            />
          ))}
          <div className="w-28 h-28 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-4xl shadow-elevated border-4 border-white/20">
            {callerName
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")}
          </div>
        </motion.div>

        <div className="text-center text-white">
          <h2 className="text-3xl font-extrabold">{callerName}</h2>
          <p className="text-white/70 text-base mt-2 font-medium">
            Incoming {mode === "video" ? "video" : "audio"} call…
          </p>
          <motion.div className="flex items-center justify-center gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-white/60"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Accept / Reject */}
      <div className="flex items-center gap-16 z-10">
        {/* Reject */}
        <div className="flex flex-col items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onReject}
            className="w-18 h-18 rounded-full bg-destructive flex items-center justify-center shadow-elevated"
            style={{ width: 72, height: 72 }}
          >
            <PhoneOff size={28} className="text-destructive-foreground" />
          </motion.button>
          <span className="text-sm text-white/70 font-medium">Decline</span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.88 }}
            animate={{
              scale: [1, 1.08, 1],
              boxShadow: [
                "0 0 0 0 rgba(34,197,94,0.4)",
                "0 0 0 16px rgba(34,197,94,0)",
                "0 0 0 0 rgba(34,197,94,0)",
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            onClick={onAccept}
            className="w-18 h-18 rounded-full bg-primary flex items-center justify-center shadow-elevated"
            style={{ width: 72, height: 72 }}
          >
            {mode === "video" ? (
              <Video size={28} className="text-white" />
            ) : (
              <Phone size={28} className="text-white" />
            )}
          </motion.button>
          <span className="text-sm text-white/70 font-medium">Accept</span>
        </div>
      </div>
    </motion.div>
  );
};

export default IncomingCallOverlay;
