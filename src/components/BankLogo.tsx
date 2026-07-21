import { BankInfo } from "@/lib/bangladeshBanks";

interface Props {
  bank: Pick<BankInfo, "name" | "short" | "color" | "logo_url">;
  size?: number;
  className?: string;
  rounded?: string;
}

export function BankLogo({ bank, size = 32, className = "", rounded = "rounded-lg" }: Props) {
  const dim = { width: size, height: size };
  if (bank.logo_url) {
    return (
      <div
        className={`${rounded} bg-white shrink-0 overflow-hidden flex items-center justify-center border border-border/40 ${className}`}
        style={dim}
      >
        <img
          src={bank.logo_url}
          alt={bank.name}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    );
  }
  return (
    <div
      className={`${rounded} flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{ ...dim, backgroundColor: bank.color, fontSize: Math.max(9, Math.round(size * 0.32)) }}
    >
      {bank.short.slice(0, 2)}
    </div>
  );
}
