// Illustrated SVG icons for Quick Actions — with micro-animation support
import { motion } from "framer-motion";

interface IconProps {
  isHovered?: boolean;
}

export const SendMoneyIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* Flying taka coin — spins on hover */}
    <motion.g
      animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
      transition={isHovered ? { duration: 0.6, ease: "easeInOut" } : { duration: 0.4 }}
      style={{ originX: "32px", originY: "28px", transformBox: "fill-box", transformOrigin: "center" }}
    >
      <circle cx="32" cy="28" r="13" fill="#E91E8C" opacity="0.15"/>
      <circle cx="32" cy="28" r="10" fill="#E91E8C" opacity="0.25"/>
      <circle cx="32" cy="28" r="7.5" fill="#E91E8C"/>
      <text x="32" y="32.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="serif">৳</text>
    </motion.g>
    {/* Speed lines — fade in on hover */}
    <motion.g
      animate={isHovered ? { opacity: 1, x: -3 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <line x1="8" y1="24" x2="19" y2="24" stroke="#E91E8C" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="10" y1="28" x2="18" y2="28" stroke="#E91E8C" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <line x1="13" y1="32" x2="19" y2="32" stroke="#E91E8C" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </motion.g>
    {/* Arrow tip */}
    <motion.path
      d="M42 28 L37 24 M42 28 L37 32"
      stroke="#E91E8C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      animate={isHovered ? { x: 3 } : { x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    />
  </svg>
);

export const CashOutIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* Bill stack — bounces up */}
    <motion.g
      animate={isHovered ? { y: -3 } : { y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      <rect x="14" y="16" width="28" height="17" rx="3" fill="#4CAF50" opacity="0.3"/>
      <rect x="14" y="14" width="28" height="16" rx="3" fill="#4CAF50" opacity="0.6"/>
      <rect x="14" y="12" width="28" height="15" rx="3" fill="#2E7D32"/>
      <circle cx="28" cy="19.5" r="3.5" fill="#4CAF50" opacity="0.7"/>
      <circle cx="28" cy="19.5" r="2" fill="#fff" opacity="0.5"/>
      <rect x="18" y="18" width="3" height="3" rx="1" fill="#4CAF50" opacity="0.6"/>
      <rect x="35" y="18" width="3" height="3" rx="1" fill="#4CAF50" opacity="0.6"/>
    </motion.g>
    {/* Hand stays */}
    <path d="M20 27 Q17 28 16 31 Q15 34 17 36 L22 38 Q26 40 30 39 L40 36 Q43 35 43 32 Q43 30 41 29 L37 28 L33 30 L28 30 Q24 30 22 29 Z" fill="#FFCC80"/>
    <path d="M28 30 L28 27" stroke="#FFB74D" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M33 30 L33 27" stroke="#FFB74D" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M37 28 L37 26" stroke="#FFB74D" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const PaymentIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* QR scan frame */}
    <rect x="13" y="13" width="13" height="13" rx="2" fill="none" stroke="#9C27B0" strokeWidth="2.5"/>
    <rect x="17" y="17" width="5" height="5" rx="1" fill="#9C27B0"/>
    <rect x="30" y="13" width="13" height="13" rx="2" fill="none" stroke="#9C27B0" strokeWidth="2.5"/>
    <rect x="34" y="17" width="5" height="5" rx="1" fill="#9C27B0"/>
    <rect x="13" y="30" width="13" height="13" rx="2" fill="none" stroke="#9C27B0" strokeWidth="2.5"/>
    <rect x="17" y="34" width="5" height="5" rx="1" fill="#9C27B0"/>
    {/* QR dots bottom right */}
    <rect x="30" y="30" width="5" height="2" rx="1" fill="#9C27B0"/>
    <rect x="38" y="30" width="5" height="2" rx="1" fill="#9C27B0"/>
    <rect x="30" y="35" width="8" height="2" rx="1" fill="#9C27B0"/>
    <rect x="30" y="40" width="5" height="2" rx="1" fill="#9C27B0"/>
    <rect x="38" y="37" width="5" height="5" rx="1" fill="#9C27B0"/>
    {/* scan line — sweeps top to bottom on hover */}
    <motion.line
      x1="10" x2="46"
      stroke="#CE93D8" strokeWidth="2" strokeLinecap="round"
      animate={isHovered ? { y1: [13, 43, 13], y2: [13, 43, 13], opacity: [0.9, 0.9, 0.9] } : { y1: 28, y2: 28, opacity: 0.7 }}
      transition={isHovered ? { duration: 0.9, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
    />
  </svg>
);

export const AddMoneyIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* Wallet body */}
    <rect x="10" y="20" width="32" height="22" rx="4" fill="#1565C0"/>
    <rect x="10" y="20" width="32" height="7" rx="2" fill="#1976D2"/>
    <path d="M10 22 Q10 18 14 18 L38 18 Q42 18 42 22" fill="#1E88E5" opacity="0.6"/>
    <rect x="30" y="26" width="10" height="10" rx="3" fill="#0D47A1"/>
    <circle cx="35" cy="31" r="3" fill="#1565C0"/>
    <circle cx="35" cy="31" r="1.5" fill="#42A5F5" opacity="0.6"/>
    {/* Plus badge — pulses on hover */}
    <motion.g
      animate={isHovered ? { scale: [1, 1.25, 1], opacity: [1, 0.85, 1] } : { scale: 1, opacity: 1 }}
      transition={isHovered ? { duration: 0.55, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "16px 20px" }}
    >
      <circle cx="16" cy="20" r="8" fill="#4CAF50"/>
      <path d="M16 16 L16 24 M12 20 L20 20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </motion.g>
  </svg>
);

export const RechargeIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* Phone body — vibrates on hover */}
    <motion.g
      animate={isHovered ? { x: [0, -2.5, 2.5, -2, 2, -1, 1, 0] } : { x: 0 }}
      transition={isHovered ? { duration: 0.45, ease: "easeInOut" } : { duration: 0.2 }}
    >
      <rect x="16" y="8" width="24" height="38" rx="5" fill="#37474F"/>
      <rect x="18" y="11" width="20" height="30" rx="3" fill="#546E7A"/>
      <rect x="18" y="11" width="20" height="30" rx="3" fill="url(#phoneScreen)"/>
      <defs>
        <linearGradient id="phoneScreen" x1="18" y1="11" x2="38" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00BCD4" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#006064" stopOpacity="0.9"/>
        </linearGradient>
      </defs>
      <text x="28" y="30" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="serif">৳</text>
      <rect x="20" y="14" width="2" height="3" rx="0.5" fill="white" opacity="0.6"/>
      <rect x="23" y="13" width="2" height="4" rx="0.5" fill="white" opacity="0.7"/>
      <rect x="26" y="12" width="2" height="5" rx="0.5" fill="white" opacity="0.8"/>
      <rect x="29" y="11" width="2" height="6" rx="0.5" fill="white"/>
      <circle cx="28" cy="44" r="2" fill="#455A64"/>
    </motion.g>
    {/* Signal ripple rings on hover */}
    {isHovered && (
      <>
        <motion.circle
          cx="28" cy="6" r="4"
          stroke="#00BCD4" strokeWidth="1.5" fill="none"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.5, 2] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: 0 }}
        />
        <motion.circle
          cx="28" cy="6" r="4"
          stroke="#00BCD4" strokeWidth="1" fill="none"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 2, 2.8] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: 0.25 }}
        />
      </>
    )}
  </svg>
);

export const PayBillIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* Bulb body */}
    <path d="M28 10 C21 10 16 15 16 22 C16 27 19 31 22 33 L22 38 L34 38 L34 33 C37 31 40 27 40 22 C40 15 35 10 28 10 Z" fill="#FFC107"/>
    <path d="M28 10 C21 10 16 15 16 22 C16 27 19 31 22 33 L22 38 L34 38 L34 33 C37 31 40 27 40 22 C40 15 35 10 28 10 Z" fill="url(#bulbGrad)"/>
    <defs>
      <linearGradient id="bulbGrad" x1="16" y1="10" x2="40" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF9C4"/>
        <stop offset="100%" stopColor="#F57F17" stopOpacity="0.8"/>
      </linearGradient>
    </defs>
    <rect x="23" y="38" width="10" height="3" rx="1.5" fill="#FF8F00"/>
    <rect x="24" y="41" width="8" height="3" rx="1.5" fill="#E65100"/>
    {/* Glow lines — flicker on hover */}
    <motion.g
      animate={isHovered ? { opacity: [1, 0.2, 1, 0.5, 1] } : { opacity: 1 }}
      transition={isHovered ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
    >
      <line x1="28" y1="6" x2="28" y2="8" stroke="#FFEB3B" strokeWidth="2" strokeLinecap="round"/>
      <line x1="40" y1="11" x2="38.5" y2="12.5" stroke="#FFEB3B" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="11" x2="17.5" y2="12.5" stroke="#FFEB3B" strokeWidth="2" strokeLinecap="round"/>
    </motion.g>
    {/* Bolt inside — brightness flicker */}
    <motion.path
      d="M30 18 L26 25 L29 25 L26 32 L32 23 L29 23 Z"
      fill="white"
      animate={isHovered ? { opacity: [0.9, 0.3, 1, 0.5, 1] } : { opacity: 0.9 }}
      transition={isHovered ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
    />
    {/* Outer glow halo on hover */}
    {isHovered && (
      <motion.ellipse
        cx="28" cy="22" rx="14" ry="13"
        fill="#FFEB3B"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.18, 0, 0.12, 0] }}
        transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "blur(4px)" }}
      />
    )}
  </svg>
);

export const ShopIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* Shopping bag — slight swing on hover */}
    <motion.g
      animate={isHovered ? { rotate: [0, -6, 6, -4, 4, 0] } : { rotate: 0 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 14px" }}
    >
      <path d="M16 22 L14 44 Q14 46 16 46 L40 46 Q42 46 42 44 L40 22 Z" fill="#FF7043"/>
      <path d="M16 22 L14 44 Q14 46 16 46 L40 46 Q42 46 42 44 L40 22 Z" fill="url(#bagGrad)"/>
      <defs>
        <linearGradient id="bagGrad" x1="14" y1="22" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF8A65"/>
          <stop offset="100%" stopColor="#BF360C"/>
        </linearGradient>
      </defs>
      <rect x="14" y="22" width="28" height="5" rx="1" fill="#FF5722" opacity="0.6"/>
      <path d="M22 22 Q22 14 28 14 Q34 14 34 22" fill="none" stroke="#FF7043" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="28" cy="35" r="5" fill="white" opacity="0.2"/>
      <text x="28" y="38" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">৳</text>
    </motion.g>
  </svg>
);

export const MoreIcon = () => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="18" cy="18" r="5" fill="#E91E8C"/>
    <circle cx="28" cy="18" r="5" fill="#9C27B0"/>
    <circle cx="38" cy="18" r="5" fill="#2196F3"/>
    <circle cx="18" cy="28" r="5" fill="#4CAF50"/>
    <circle cx="28" cy="28" r="5" fill="#FF9800"/>
    <circle cx="38" cy="28" r="5" fill="#F44336"/>
    <circle cx="18" cy="38" r="5" fill="#00BCD4"/>
    <circle cx="28" cy="38" r="5" fill="#FF5722"/>
    <circle cx="38" cy="38" r="5" fill="#795548"/>
  </svg>
);
