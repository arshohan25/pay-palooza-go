// Illustrated SVG icons for Quick Actions — with micro-animation support
import { motion } from "framer-motion";

interface IconProps {
  isHovered?: boolean;
}

export const SendMoneyIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    {/* Paper plane body */}
    <motion.g
      animate={isHovered ? { x: [0, 4, -1, 3, 0], y: [0, -3, 1, -2, 0] } : { x: 0, y: 0 }}
      transition={isHovered ? { duration: 0.55, ease: "easeInOut" } : { duration: 0.3 }}
    >
      {/* Main plane body */}
      <path d="M10 28 L46 12 L34 46 L26 34 Z" fill="#E91E8C"/>
      <path d="M10 28 L46 12 L34 46 L26 34 Z" fill="url(#planeGrad)"/>
      <defs>
        <linearGradient id="planeGrad" x1="10" y1="12" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F06292"/>
          <stop offset="100%" stopColor="#AD1457"/>
        </linearGradient>
      </defs>
      {/* Fold crease */}
      <path d="M26 34 L46 12 L34 36 Z" fill="#AD1457" opacity="0.5"/>
      {/* Wing highlight */}
      <path d="M10 28 L26 34 L20 30 Z" fill="white" opacity="0.2"/>
      {/* Taka badge */}
      <circle cx="42" cy="40" r="7" fill="#FFC107"/>
      <text x="42" y="43.5" textAnchor="middle" fill="#7B3F00" fontSize="8" fontWeight="bold" fontFamily="serif">৳</text>
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

// Savings / Piggy bank icon — teal
export const SavingsIcon = ({ isHovered }: IconProps) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" overflow="visible">
    <defs>
      <linearGradient id="piggyGrad" x1="8" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4DB6AC"/>
        <stop offset="100%" stopColor="#00695C"/>
      </linearGradient>
    </defs>
    {/* Piggy body */}
    <ellipse cx="27" cy="32" rx="17" ry="14" fill="url(#piggyGrad)"/>
    {/* Snout */}
    <ellipse cx="43" cy="34" rx="5" ry="4" fill="#80CBC4"/>
    <circle cx="42" cy="33" r="1" fill="#00695C"/>
    <circle cx="44" cy="33" r="1" fill="#00695C"/>
    {/* Ear */}
    <ellipse cx="23" cy="18" rx="5" ry="4" fill="#80CBC4"/>
    <ellipse cx="23" cy="18" rx="3" ry="2.5" fill="#4DB6AC"/>
    {/* Eye */}
    <circle cx="36" cy="26" r="2" fill="white"/>
    <circle cx="36.5" cy="26.5" r="1" fill="#004D40"/>
    {/* Coin slot */}
    <rect x="22" y="17" width="10" height="2.5" rx="1.25" fill="#00695C"/>
    {/* Legs */}
    <rect x="18" y="44" width="5" height="5" rx="2" fill="#26A69A"/>
    <rect x="25" y="44" width="5" height="5" rx="2" fill="#26A69A"/>
    <rect x="32" y="44" width="5" height="5" rx="2" fill="#26A69A"/>
    {/* Coin badge — bounces on hover */}
    <motion.g
      animate={isHovered ? { y: [0, -4, 0], rotate: [0, 15, -10, 0] } : { y: 0, rotate: 0 }}
      transition={isHovered ? { duration: 0.55, ease: "easeInOut", repeat: Infinity } : { duration: 0.3 }}
      style={{ transformBox: "fill-box", transformOrigin: "12px 18px" }}
    >
      <circle cx="12" cy="18" r="8" fill="#FFC107"/>
      <text x="12" y="21.5" textAnchor="middle" fill="#7B3F00" fontSize="8" fontWeight="bold" fontFamily="serif">৳</text>
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
