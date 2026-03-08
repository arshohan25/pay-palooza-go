// Illustrated SVG icons for Quick Actions — with micro-animation support
import { motion } from "framer-motion";

interface IconProps {
  isHovered?: boolean;
}

export const SendMoneyIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="planeGrad" x1="10" y1="12" x2="46" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F06292"/>
        <stop offset="100%" stopColor="#AD1457"/>
      </linearGradient>
      <filter id="sendCoinGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {/* Paper plane body */}
    <motion.g
      animate={isHovered ? { x: [0, 4, -1, 3, 0], y: [0, -3, 1, -2, 0] } : { x: 0, y: 0 }}
      transition={isHovered ? { duration: 0.55, ease: "easeInOut" } : { duration: 0.3 }}
    >
      <path d="M10 28 L46 12 L34 46 L26 34 Z" fill="#E91E8C"/>
      <path d="M10 28 L46 12 L34 46 L26 34 Z" fill="url(#planeGrad)"/>
      <path d="M26 34 L46 12 L34 36 Z" fill="#AD1457" opacity="0.5"/>
      <path d="M10 28 L26 34 L20 30 Z" fill="white" opacity="0.2"/>
      {/* Coin glow pulse */}
      <motion.circle
        cx="42" cy="40" r="10" fill="#FFC107" opacity={0}
        animate={isHovered ? { opacity: [0, 0.3, 0] } : { opacity: 0 }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      {/* Taka badge */}
      <circle cx="42" cy="40" r="7" fill="#FFC107" filter="url(#sendCoinGlow)"/>
      <text x="42" y="43.5" textAnchor="middle" fill="#7B3F00" fontSize="8" fontWeight="bold" fontFamily="serif">৳</text>
      {/* Sparkle diamonds */}
      <motion.g
        animate={isHovered ? { opacity: [0, 1, 0], scale: [0.5, 1, 0.5] } : { opacity: 0 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "42px 40px" }}
      >
        <path d="M50 34 L51 32 L52 34 L51 36 Z" fill="#FFF8E1"/>
        <path d="M34 34 L35 32 L36 34 L35 36 Z" fill="#FFF8E1"/>
        <path d="M48 48 L49 46 L50 48 L49 50 Z" fill="#FFF8E1"/>
      </motion.g>
    </motion.g>
    {/* Trail dots */}
    <motion.g
      animate={isHovered ? { opacity: [0, 1, 0], x: [-2, -6] } : { opacity: 0 }}
      transition={isHovered ? { duration: 0.5, repeat: Infinity } : {}}
    >
      <circle cx="18" cy="30" r="1.5" fill="#E91E8C" opacity="0.7"/>
      <circle cx="13" cy="32" r="1" fill="#E91E8C" opacity="0.4"/>
    </motion.g>
  </svg>
);

export const CashOutIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="atmGrad" x1="8" y1="14" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#43A047"/>
        <stop offset="100%" stopColor="#1B5E20"/>
      </linearGradient>
      <linearGradient id="screenGrad" x1="13" y1="20" x2="43" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#A5D6A7"/>
        <stop offset="100%" stopColor="#388E3C"/>
      </linearGradient>
    </defs>
    {/* ATM machine body */}
    <rect x="8" y="14" width="40" height="34" rx="5" fill="url(#atmGrad)"/>
    {/* Screen */}
    <rect x="13" y="19" width="24" height="14" rx="3" fill="url(#screenGrad)"/>
    {/* Taka symbol on screen */}
    <text x="25" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="serif">৳</text>
    {/* Keypad dots */}
    <circle cx="40" cy="22" r="1.5" fill="#81C784"/>
    <circle cx="40" cy="27" r="1.5" fill="#81C784"/>
    <circle cx="40" cy="32" r="1.5" fill="#81C784"/>
    {/* Card slot */}
    <rect x="13" y="36" width="14" height="3" rx="1.5" fill="#1B5E20"/>
    {/* Cash slot */}
    <rect x="13" y="42" width="20" height="3" rx="1.5" fill="#1B5E20"/>
    {/* Cash bills coming out — animate on hover */}
    <motion.g
      animate={isHovered ? { y: [0, 4, 0] } : { y: 0 }}
      transition={isHovered ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
    >
      <rect x="14" y="43" width="18" height="5" rx="1.5" fill="#A5D6A7" opacity="0.9"/>
      <rect x="15" y="44" width="16" height="3" rx="1" fill="white" opacity="0.4"/>
      <text x="23" y="47" textAnchor="middle" fill="#2E7D32" fontSize="5" fontWeight="bold" fontFamily="serif">৳৳৳</text>
    </motion.g>
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
    <defs>
      <linearGradient id="bagGrad" x1="14" y1="22" x2="42" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF8A65"/>
        <stop offset="100%" stopColor="#BF360C"/>
      </linearGradient>
      <filter id="shopCoinGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <motion.g
      animate={isHovered ? { rotate: [0, -6, 6, -4, 4, 0] } : { rotate: 0 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 14px" }}
    >
      <path d="M16 22 L14 44 Q14 46 16 46 L40 46 Q42 46 42 44 L40 22 Z" fill="#FF7043"/>
      <path d="M16 22 L14 44 Q14 46 16 46 L40 46 Q42 46 42 44 L40 22 Z" fill="url(#bagGrad)"/>
      <rect x="14" y="22" width="28" height="5" rx="1" fill="#FF5722" opacity="0.6"/>
      <path d="M22 22 Q22 14 28 14 Q34 14 34 22" fill="none" stroke="#FF7043" strokeWidth="3" strokeLinecap="round"/>
      {/* Coin glow pulse */}
      <motion.circle
        cx="28" cy="35" r="8" fill="white" opacity={0}
        animate={isHovered ? { opacity: [0, 0.25, 0] } : { opacity: 0 }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      <circle cx="28" cy="35" r="5" fill="white" opacity="0.2" filter="url(#shopCoinGlow)"/>
      <text x="28" y="38" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">৳</text>
      {/* Sparkle diamonds */}
      <motion.g
        animate={isHovered ? { opacity: [0, 1, 0], scale: [0.5, 1, 0.5] } : { opacity: 0 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "28px 35px" }}
      >
        <path d="M20 30 L21 28 L22 30 L21 32 Z" fill="#FFF8E1"/>
        <path d="M35 30 L36 28 L37 30 L36 32 Z" fill="#FFF8E1"/>
        <path d="M28 44 L29 42 L30 44 L29 46 Z" fill="#FFF8E1"/>
      </motion.g>
    </motion.g>
  </svg>
);

// Refer & Earn icon — gift box with star burst
export const ReferIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="giftBoxGrad" x1="10" y1="20" x2="46" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF8A65"/>
        <stop offset="100%" stopColor="#BF360C"/>
      </linearGradient>
      <linearGradient id="giftLidGrad" x1="10" y1="18" x2="46" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFAB91"/>
        <stop offset="100%" stopColor="#FF7043"/>
      </linearGradient>
    </defs>
    {/* Box body */}
    <rect x="11" y="26" width="34" height="22" rx="3" fill="url(#giftBoxGrad)"/>
    {/* Lid */}
    <rect x="10" y="19" width="36" height="8" rx="3" fill="url(#giftLidGrad)"/>
    {/* Ribbon vertical */}
    <rect x="25" y="19" width="6" height="29" rx="1" fill="#FF3D00" opacity="0.7"/>
    {/* Ribbon horizontal */}
    <rect x="10" y="22" width="36" height="5" rx="1" fill="#FF3D00" opacity="0.5"/>
    {/* Bow left */}
    <path d="M28 19 Q20 12 16 16 Q14 20 20 20 Z" fill="#FF5722"/>
    {/* Bow right */}
    <path d="M28 19 Q36 12 40 16 Q42 20 36 20 Z" fill="#FF5722"/>
    {/* Star badge — spins on hover */}
    <motion.g
      animate={isHovered ? { rotate: [0, 20, -20, 15, -15, 0], scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
      transition={isHovered ? { duration: 0.6, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "42px 16px" }}
    >
      <circle cx="42" cy="16" r="8" fill="#FFC107"/>
      {/* Star shape */}
      <path d="M42 9.5 L43.5 13.5 L47.5 13.5 L44.3 16 L45.5 20 L42 17.5 L38.5 20 L39.7 16 L36.5 13.5 L40.5 13.5 Z"
        fill="white" opacity="0.9"/>
    </motion.g>
  </svg>
);

export const BankTransferIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="bankBuildGrad" x1="10" y1="12" x2="46" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1E88E5"/>
        <stop offset="100%" stopColor="#0D47A1"/>
      </linearGradient>
      <linearGradient id="bankRoofGrad" x1="10" y1="8" x2="46" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#42A5F5"/>
        <stop offset="100%" stopColor="#1565C0"/>
      </linearGradient>
    </defs>
    {/* Roof / pediment */}
    <path d="M28 8 L10 22 L46 22 Z" fill="url(#bankRoofGrad)"/>
    {/* Roof trim */}
    <rect x="8" y="21" width="40" height="4" rx="1" fill="#1565C0"/>
    {/* Building body */}
    <rect x="12" y="25" width="32" height="17" rx="1" fill="url(#bankBuildGrad)"/>
    {/* Columns */}
    <rect x="16" y="25" width="4" height="17" rx="1" fill="#90CAF9" opacity="0.35"/>
    <rect x="24" y="25" width="4" height="17" rx="1" fill="#90CAF9" opacity="0.35"/>
    <rect x="32" y="25" width="4" height="17" rx="1" fill="#90CAF9" opacity="0.35"/>
    {/* Base */}
    <rect x="10" y="42" width="36" height="4" rx="1" fill="#0D47A1"/>
    {/* Taka glow pulse */}
    <motion.circle
      cx="28" cy="35" r="8" fill="#90CAF9" opacity={0}
      animate={isHovered ? { opacity: [0, 0.2, 0] } : { opacity: 0 }}
      transition={{ duration: 1.4, repeat: Infinity }}
    />
    {/* Taka symbol */}
    <text x="28" y="38" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="serif">৳</text>
    {/* Sparkle diamonds */}
    <motion.g
      animate={isHovered ? { opacity: [0, 1, 0], scale: [0.5, 1, 0.5] } : { opacity: 0 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "28px 35px" }}
    >
      <path d="M20 32 L21 30 L22 32 L21 34 Z" fill="#E3F2FD"/>
      <path d="M36 32 L37 30 L38 32 L37 34 Z" fill="#E3F2FD"/>
    </motion.g>
    {/* Transfer arrow — slides right on hover */}
    <motion.g
      animate={isHovered ? { x: [0, 5, 0], opacity: [0.7, 1, 0.7] } : { x: 0, opacity: 0.8 }}
      transition={isHovered ? { duration: 0.6, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
    >
      <path d="M36 50 L44 50" stroke="#42A5F5" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M41 47 L44 50 L41 53" stroke="#42A5F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
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

// Savings / Growing plant icon — growth metaphor
export const SavingsIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="potGrad" x1="18" y1="34" x2="38" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#8D6E63"/>
        <stop offset="100%" stopColor="#5D4037"/>
      </linearGradient>
      <linearGradient id="leafGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#4CAF50"/>
        <stop offset="100%" stopColor="#1B5E20"/>
      </linearGradient>
      <filter id="coinGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Pot rim */}
    <rect x="16" y="34" width="24" height="4" rx="2" fill="#A1887F"/>
    {/* Pot body — trapezoid */}
    <path d="M18 38 L20 50 Q20 52 22 52 L34 52 Q36 52 36 50 L38 38 Z" fill="url(#potGrad)"/>
    {/* Soil */}
    <ellipse cx="28" cy="37" rx="10" ry="3" fill="#3E2723"/>
    {/* Stem */}
    <motion.g
      animate={isHovered ? { scaleY: [1, 1.08, 1], rotate: [0, 2, -2, 0] } : { scaleY: 1, rotate: 0 }}
      transition={isHovered ? { duration: 1.2, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 34px" }}
    >
      <path d="M28 34 L28 18" stroke="#388E3C" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Left leaf */}
      <path d="M28 26 Q20 20 18 14 Q22 16 28 22" fill="url(#leafGrad)"/>
      <path d="M28 26 Q23 22 22 17" stroke="#1B5E20" strokeWidth="0.6" fill="none" opacity="0.5"/>
      {/* Right leaf */}
      <path d="M28 22 Q36 16 38 10 Q34 12 28 18" fill="url(#leafGrad)"/>
      <path d="M28 22 Q33 18 34 13" stroke="#1B5E20" strokeWidth="0.6" fill="none" opacity="0.5"/>
      {/* Top small leaf / bud */}
      <path d="M28 18 Q26 13 24 10 Q27 12 28 15" fill="#4CAF50"/>
      <path d="M28 18 Q30 13 32 10 Q29 12 28 15" fill="#66BB6A"/>
    </motion.g>
    {/* Glow pulse behind coin */}
    <motion.circle
      cx="12" cy="12" r="14"
      fill="#FFD54F"
      opacity={0}
      animate={isHovered ? { opacity: [0, 0.35, 0] } : { opacity: 0 }}
      transition={isHovered ? { duration: 1.4, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
    />
    {/* Sparkle diamonds around coin */}
    <motion.g
      animate={isHovered ? { opacity: [0, 1, 0], scale: [0.5, 1, 0.5] } : { opacity: 0 }}
      transition={isHovered ? { duration: 1.2, ease: "easeInOut", repeat: Infinity } : { duration: 0.2 }}
      style={{ transformBox: "fill-box", transformOrigin: "12px 12px" }}
    >
      <path d="M3 5 L4 3 L5 5 L4 7 Z" fill="#FFF8E1"/>
      <path d="M20 3 L21 1 L22 3 L21 5 Z" fill="#FFF8E1"/>
      <path d="M4 19 L5 17 L6 19 L5 21 Z" fill="#FFF8E1"/>
    </motion.g>
    {/* Coin badge — bounces on hover */}
    <motion.g
      animate={isHovered ? { y: [0, -4, 0], rotate: [0, 15, -10, 0] } : { y: 0, rotate: 0 }}
      transition={isHovered ? { duration: 0.55, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "12px 12px" }}
    >
      <circle cx="12" cy="12" r="11" fill="#FFD54F" filter="url(#coinGlow)"/>
      <circle cx="12" cy="12" r="8.5" fill="#FFC107" opacity="0.6"/>
      <text x="12" y="16.5" textAnchor="middle" fill="#7B3F00" fontSize="11" fontWeight="bold" fontFamily="serif">৳</text>
    </motion.g>
  </svg>
);

// Coupons icon — ticket with percentage badge
export const CouponsIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="couponGrad" x1="8" y1="16" x2="48" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F06292"/>
        <stop offset="100%" stopColor="#AD1457"/>
      </linearGradient>
    </defs>
    <motion.g
      animate={isHovered ? { rotate: [0, -4, 4, -2, 0] } : { rotate: 0 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 28px" }}
    >
      {/* Ticket body */}
      <rect x="8" y="16" width="40" height="26" rx="4" fill="url(#couponGrad)"/>
      {/* Notch top */}
      <circle cx="28" cy="16" r="4" fill="hsl(var(--card))"/>
      {/* Notch bottom */}
      <circle cx="28" cy="42" r="4" fill="hsl(var(--card))"/>
      {/* Dotted tear line */}
      <line x1="28" y1="20" x2="28" y2="38" stroke="white" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5"/>
      {/* Left side content */}
      <rect x="13" y="22" width="10" height="2" rx="1" fill="white" opacity="0.5"/>
      <rect x="13" y="26" width="8" height="2" rx="1" fill="white" opacity="0.35"/>
      {/* Percentage badge */}
      <circle cx="40" cy="22" r="7" fill="#FFC107"/>
      <text x="40" y="25" textAnchor="middle" fill="#7B3F00" fontSize="8" fontWeight="bold">%</text>
    </motion.g>
  </svg>
);

// Donations icon — heart with hand
export const DonationsIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="heartGrad" x1="12" y1="10" x2="44" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#EF5350"/>
        <stop offset="100%" stopColor="#B71C1C"/>
      </linearGradient>
    </defs>
    {/* Open hand */}
    <path d="M20 46 Q16 44 14 40 L14 36 Q14 34 16 34 L40 34 Q42 34 42 36 L42 40 Q40 44 36 46 Z" fill="#FFCCBC" opacity="0.8"/>
    <path d="M18 38 L38 38" stroke="#FFAB91" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    {/* Heart */}
    <motion.g
      animate={isHovered ? { scale: [1, 1.15, 1, 1.1, 1] } : { scale: 1 }}
      transition={isHovered ? { duration: 0.6, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 22px" }}
    >
      <path d="M28 32 C20 26 12 20 12 14 C12 8 18 6 22 10 L28 16 L34 10 C38 6 44 8 44 14 C44 20 36 26 28 32 Z" fill="url(#heartGrad)"/>
      <path d="M28 16 L22 10 C18 6 12 8 12 14 C12 16 13 18 15 20 L28 16 Z" fill="white" opacity="0.2"/>
    </motion.g>
  </svg>
);

// Loan icon — banknote stack with clock badge
export const LoanIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="loanGrad" x1="8" y1="16" x2="48" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFA726"/>
        <stop offset="100%" stopColor="#E65100"/>
      </linearGradient>
    </defs>
    <motion.g
      animate={isHovered ? { rotate: [0, -3, 3, 0] } : { rotate: 0 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 32px" }}
    >
      {/* Stacked notes */}
      <rect x="10" y="24" width="36" height="20" rx="3" fill="#FFB74D" opacity="0.5"/>
      <rect x="12" y="20" width="36" height="20" rx="3" fill="#FFA726" opacity="0.7"/>
      <rect x="8" y="18" width="36" height="20" rx="3" fill="url(#loanGrad)"/>
      {/* Taka symbol */}
      <text x="26" y="32" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="serif">৳</text>
      {/* Detail lines */}
      <rect x="13" y="22" width="8" height="2" rx="1" fill="white" opacity="0.4"/>
      <rect x="13" y="34" width="12" height="2" rx="1" fill="white" opacity="0.3"/>
    </motion.g>
    {/* Clock badge */}
    <motion.g
      animate={isHovered ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "42px 16px" }}
    >
      <circle cx="42" cy="16" r="8" fill="#FFC107"/>
      <circle cx="42" cy="16" r="5.5" fill="white" opacity="0.9"/>
      <line x1="42" y1="16" x2="42" y2="12.5" stroke="#E65100" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="42" y1="16" x2="45" y2="16" stroke="#E65100" strokeWidth="1.5" strokeLinecap="round"/>
    </motion.g>
  </svg>
);

// Insurance icon — shield with checkmark
export const InsuranceIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="shieldGrad" x1="12" y1="6" x2="44" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#B39DDB"/>
        <stop offset="100%" stopColor="#4527A0"/>
      </linearGradient>
    </defs>
    <motion.g
      animate={isHovered ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 28px" }}
    >
      {/* Shield */}
      <path d="M28 6 L12 14 L12 28 C12 38 20 46 28 50 C36 46 44 38 44 28 L44 14 Z" fill="url(#shieldGrad)"/>
      {/* Inner highlight */}
      <path d="M28 10 L16 16 L16 28 C16 36 22 42 28 46 C34 42 40 36 40 28 L40 16 Z" fill="white" opacity="0.12"/>
      {/* Checkmark */}
      <path d="M20 28 L26 34 L38 20" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </motion.g>
    {/* Glow on hover */}
    {isHovered && (
      <motion.path
        d="M28 6 L12 14 L12 28 C12 38 20 46 28 50 C36 46 44 38 44 28 L44 14 Z"
        fill="#B39DDB"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.15, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        style={{ filter: "blur(6px)" }}
      />
    )}
  </svg>
);

// Gift Cards icon — card with ribbon and star
export const GiftCardsIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="giftCardGrad" x1="8" y1="14" x2="48" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF8A65"/>
        <stop offset="100%" stopColor="#C62828"/>
      </linearGradient>
    </defs>
    <motion.g
      animate={isHovered ? { rotate: [0, -3, 3, -2, 0] } : { rotate: 0 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "28px 30px" }}
    >
      {/* Card body */}
      <rect x="8" y="14" width="40" height="30" rx="4" fill="url(#giftCardGrad)"/>
      {/* Ribbon horizontal */}
      <rect x="8" y="26" width="40" height="5" rx="1" fill="#FF3D00" opacity="0.6"/>
      {/* Ribbon vertical */}
      <rect x="25" y="14" width="6" height="30" rx="1" fill="#FF3D00" opacity="0.5"/>
      {/* Bow */}
      <path d="M28 26 Q22 20 18 22 Q16 24 20 26 Z" fill="#FF5722"/>
      <path d="M28 26 Q34 20 38 22 Q40 24 36 26 Z" fill="#FF5722"/>
      {/* Magnetic stripe */}
      <rect x="8" y="18" width="40" height="4" rx="1" fill="white" opacity="0.12"/>
    </motion.g>
    {/* Star badge */}
    <motion.g
      animate={isHovered ? { rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] } : { rotate: 0, scale: 1 }}
      transition={isHovered ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "44px 14px" }}
    >
      <circle cx="44" cy="14" r="7" fill="#FFC107"/>
      <path d="M44 8.5 L45.2 11.5 L48.5 11.5 L45.8 13.5 L46.8 16.5 L44 14.5 L41.2 16.5 L42.2 13.5 L39.5 11.5 L42.8 11.5 Z" fill="white" opacity="0.9"/>
    </motion.g>
  </svg>
);

// ── Transaction Icons ─────────────────────────────────────────────────────────

export const TxSendIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <path d="M6 22 L38 10 L28 38 L21 28 Z" fill="#E91E8C"/>
    <path d="M6 22 L38 10 L28 38 L21 28 Z" fill="url(#txSendGrad)"/>
    <defs>
      <linearGradient id="txSendGrad" x1="6" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F48FB1"/>
        <stop offset="100%" stopColor="#AD1457"/>
      </linearGradient>
    </defs>
    <path d="M21 28 L38 10 L28 30 Z" fill="#AD1457" opacity="0.45"/>
    <path d="M6 22 L21 28 L16 25 Z" fill="white" opacity="0.2"/>
  </svg>
);

export const TxReceiveIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txRecvGrad" x1="8" y1="8" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#66BB6A"/>
        <stop offset="100%" stopColor="#1B5E20"/>
      </linearGradient>
    </defs>
    <circle cx="22" cy="16" r="9" fill="url(#txRecvGrad)"/>
    <text x="22" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="serif">৳</text>
    <line x1="22" y1="25" x2="22" y2="36" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16 31 L22 37 L28 31" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TxCashOutIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txAtmGrad" x1="6" y1="8" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#43A047"/>
        <stop offset="100%" stopColor="#1B5E20"/>
      </linearGradient>
    </defs>
    <rect x="6" y="10" width="32" height="26" rx="4" fill="url(#txAtmGrad)"/>
    <rect x="10" y="14" width="18" height="10" rx="2" fill="#A5D6A7" opacity="0.7"/>
    <text x="19" y="22" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="serif">৳</text>
    <circle cx="34" cy="19" r="2" fill="#81C784"/>
    <rect x="10" y="28" width="16" height="2.5" rx="1.2" fill="#1B5E20"/>
    <rect x="10" y="32" width="12" height="2.5" rx="1.2" fill="#A5D6A7" opacity="0.8"/>
  </svg>
);

export const TxRechargeIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txPhoneGrad" x1="12" y1="6" x2="32" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#00BCD4"/>
        <stop offset="100%" stopColor="#006064"/>
      </linearGradient>
    </defs>
    <rect x="12" y="5" width="20" height="34" rx="4" fill="#37474F"/>
    <rect x="14" y="8" width="16" height="24" rx="2.5" fill="url(#txPhoneGrad)"/>
    <text x="22" y="23" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="serif">৳</text>
    <rect x="16" y="10" width="2" height="2.5" rx="0.5" fill="white" opacity="0.6"/>
    <rect x="19" y="9.5" width="2" height="3" rx="0.5" fill="white" opacity="0.8"/>
    <rect x="22" y="9" width="2" height="3.5" rx="0.5" fill="white"/>
    <circle cx="22" cy="36" r="2" fill="#455A64"/>
  </svg>
);

export const TxBillIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txBulbGrad" x1="10" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF9C4"/>
        <stop offset="100%" stopColor="#F9A825"/>
      </linearGradient>
    </defs>
    <path d="M22 6 C16 6 11 11 11 17 C11 21 13.5 24.5 16.5 26 L16.5 30 L27.5 30 L27.5 26 C30.5 24.5 33 21 33 17 C33 11 28 6 22 6 Z" fill="url(#txBulbGrad)"/>
    <rect x="17.5" y="30" width="9" height="2.5" rx="1.2" fill="#FF8F00"/>
    <rect x="18.5" y="32.5" width="7" height="2.5" rx="1.2" fill="#E65100"/>
    <path d="M23.5 13 L20 20 L22.5 20 L20 27 L26 19 L23 19 Z" fill="white" opacity="0.9"/>
    <line x1="22" y1="3" x2="22" y2="5" stroke="#FFEB3B" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="32" y1="7" x2="30.8" y2="8.2" stroke="#FFEB3B" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="7" x2="13.2" y2="8.2" stroke="#FFEB3B" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const TxBankIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txBankGrad" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#42A5F5"/>
        <stop offset="100%" stopColor="#0D47A1"/>
      </linearGradient>
    </defs>
    {/* Pediment */}
    <path d="M6 16 L22 6 L38 16 Z" fill="url(#txBankGrad)"/>
    {/* Base */}
    <rect x="6" y="16" width="32" height="3" rx="1" fill="#1565C0"/>
    {/* Columns */}
    <rect x="9" y="19" width="4" height="14" rx="1" fill="#1976D2"/>
    <rect x="16" y="19" width="4" height="14" rx="1" fill="#1976D2"/>
    <rect x="24" y="19" width="4" height="14" rx="1" fill="#1976D2"/>
    <rect x="31" y="19" width="4" height="14" rx="1" fill="#1976D2"/>
    {/* Floor */}
    <rect x="6" y="33" width="32" height="3" rx="1" fill="#1565C0"/>
    {/* Taka */}
    <text x="22" y="30" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="serif">৳</text>
  </svg>
);

export const TxBankTransferIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txBankXferGrad" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#5C6BC0"/>
        <stop offset="100%" stopColor="#283593"/>
      </linearGradient>
    </defs>
    {/* Bank building */}
    <path d="M5 18 L18 10 L31 18 Z" fill="url(#txBankXferGrad)"/>
    <rect x="5" y="18" width="26" height="2.5" rx="1" fill="#3949AB"/>
    <rect x="8" y="20.5" width="3" height="10" rx="1" fill="#5C6BC0"/>
    <rect x="14" y="20.5" width="3" height="10" rx="1" fill="#5C6BC0"/>
    <rect x="21" y="20.5" width="3" height="10" rx="1" fill="#5C6BC0"/>
    <rect x="5" y="30.5" width="26" height="2.5" rx="1" fill="#3949AB"/>
    {/* Arrow transferring */}
    <path d="M28 22 L38 22 L35 19 M38 22 L35 25" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M38 30 L28 30 L31 27 M28 30 L31 33" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Taka badge */}
    <circle cx="36" cy="14" r="6" fill="#FFC107"/>
    <text x="36" y="17" textAnchor="middle" fill="#7B3F00" fontSize="7" fontWeight="bold" fontFamily="serif">৳</text>
  </svg>
);

export const TxPaymentIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txQrGrad" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#CE93D8"/>
        <stop offset="100%" stopColor="#6A1B9A"/>
      </linearGradient>
    </defs>
    <rect x="7" y="7" width="12" height="12" rx="2" fill="none" stroke="#9C27B0" strokeWidth="2"/>
    <rect x="10" y="10" width="6" height="6" rx="1" fill="#9C27B0"/>
    <rect x="25" y="7" width="12" height="12" rx="2" fill="none" stroke="#9C27B0" strokeWidth="2"/>
    <rect x="28" y="10" width="6" height="6" rx="1" fill="#9C27B0"/>
    <rect x="7" y="25" width="12" height="12" rx="2" fill="none" stroke="#9C27B0" strokeWidth="2"/>
    <rect x="10" y="28" width="6" height="6" rx="1" fill="#9C27B0"/>
    <rect x="25" y="25" width="5" height="2" rx="1" fill="#9C27B0"/>
    <rect x="33" y="25" width="4" height="2" rx="1" fill="#9C27B0"/>
    <rect x="25" y="30" width="7" height="2" rx="1" fill="#9C27B0"/>
    <rect x="25" y="35" width="4" height="2" rx="1" fill="#9C27B0"/>
    <rect x="32" y="32" width="5" height="5" rx="1" fill="#9C27B0"/>
  </svg>
);

export const TxCashbackIcon = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <defs>
      <linearGradient id="txCashbackGrad" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F59E0B"/>
        <stop offset="100%" stopColor="#D97706"/>
      </linearGradient>
    </defs>
    {/* Coin circle */}
    <circle cx="22" cy="22" r="16" fill="url(#txCashbackGrad)"/>
    <circle cx="22" cy="22" r="13" fill="none" stroke="#FDE68A" strokeWidth="1.5" strokeDasharray="4 2"/>
    {/* Taka symbol */}
    <text x="22" y="25" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="serif">৳</text>
    {/* Return arrow */}
    <path d="M34 12 L38 8 L38 14 L32 14 Z" fill="#FDE68A"/>
    <path d="M38 11 Q 38 6, 32 6 L28 6" stroke="#FDE68A" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);
