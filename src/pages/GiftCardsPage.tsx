import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, Copy, Share2, Loader2, ShoppingBag, Coffee, Gamepad2, Music } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAiRewards } from "@/hooks/use-ai-rewards";
import AiRewardBanner from "@/components/AiRewardBanner";

const BRANDS = [
  { id: "shopping", name: "Shopping", icon: ShoppingBag, color: "from-pink-500 to-rose-600" },
  { id: "food", name: "Food & Dining", icon: Coffee, color: "from-amber-500 to-orange-600" },
  { id: "gaming", name: "Gaming", icon: Gamepad2, color: "from-violet-500 to-purple-600" },
  { id: "entertainment", name: "Entertainment", icon: Music, color: "from-blue-500 to-indigo-600" },
];

const DENOMINATIONS = [100, 250, 500, 1000, 2000];

const GiftCardsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const [brand, setBrand] = useState("shopping");
  const [denomination, setDenomination] = useState(500);
  const [purchasing, setPurchasing] = useState(false);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"buy" | "my">("buy");
  const { rewards: aiGiftRewards, claimReward } = useAiRewards("gift_card");

  useEffect(() => {
    if (!user) return;
    supabase.from("gift_cards").select("*").eq("purchaser_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setCards(data || []); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!kycLoading && kycStatus !== "verified") {
      toast.error("Please complete KYC verification to use this feature.");
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate]);

  if (kycLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const handlePurchase = async () => {
    if (!user) { toast.error("Please sign in first"); return; }
    setPurchasing(true);
    const brandInfo = BRANDS.find(b => b.id === brand);
    const { error } = await supabase.from("gift_cards").insert({
      purchaser_id: user.id,
      brand: brandInfo?.name || brand,
      denomination,
    } as any);

    if (error) toast.error("Failed to purchase gift card");
    else {
      toast.success("Gift card purchased!");
      const { data } = await supabase.from("gift_cards").select("*").eq("purchaser_id", user.id).order("created_at", { ascending: false });
      setCards(data || []);
      setTab("my");
    }
    setPurchasing(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied!");
  };

  const shareCard = (card: any) => {
    if (navigator.share) {
      navigator.share({ title: "EasyPay Gift Card", text: `Here's a ৳${card.denomination} ${card.brand} gift card! Code: ${card.code}` });
    } else copyCode(card.code);
  };

  const selectedBrand = BRANDS.find(b => b.id === brand)!;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold text-foreground">Gift Cards</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 bg-muted/50 rounded-xl p-1">
          <button onClick={() => setTab("buy")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "buy" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Buy Card</button>
          <button onClick={() => setTab("my")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "my" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>My Cards</button>
        </div>

        {/* AI Recommended Gift Cards */}
        {aiGiftRewards.length > 0 && (
          <AiRewardBanner rewards={aiGiftRewards} onClaim={claimReward} />
        )}

        {tab === "buy" ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Brand Selection */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Select Category</p>
              <div className="grid grid-cols-2 gap-2">
                {BRANDS.map(b => (
                  <button key={b.id} onClick={() => setBrand(b.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm font-semibold transition-all ${brand === b.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"}`}>
                    <b.icon className="w-4 h-4" />{b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Denomination */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Select Amount</p>
              <div className="flex flex-wrap gap-2">
                {DENOMINATIONS.map(d => (
                  <button key={d} onClick={() => setDenomination(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${denomination === d ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"}`}>
                    ৳{d.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Card - Credit Card Style */}
            <div className={`relative overflow-hidden rounded-[19px] h-[210px] bg-gradient-to-br ${selectedBrand.color} p-5 text-white shadow-xl`}>
              {/* Glossy overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />

              {/* Top row */}
              <div className="relative flex items-start justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">GIFT CARD</span>
                <img src="/icons/easypay-logo.webp" alt="EasyPay" className="h-7 object-contain brightness-0 invert" />
              </div>

              {/* EMV Chip */}
              <div className="relative mt-5 mb-4">
                <svg width="45" height="34" viewBox="0 0 45 34" fill="none">
                  <rect x="0.5" y="0.5" width="44" height="33" rx="5" fill="#d4a853" stroke="#c4963f" />
                  <line x1="0" y1="12" x2="45" y2="12" stroke="#c4963f" strokeWidth="0.7" />
                  <line x1="0" y1="22" x2="45" y2="22" stroke="#c4963f" strokeWidth="0.7" />
                  <line x1="15" y1="0" x2="15" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                  <line x1="30" y1="0" x2="30" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                </svg>
              </div>

              {/* Masked card number */}
              <p className="relative text-[15px] font-mono tracking-[0.25em] opacity-90">•••• •••• •••• ••••</p>

              {/* Bottom row */}
              <div className="relative flex items-end justify-between mt-auto pt-2">
                <p className="text-2xl font-bold">৳{denomination.toLocaleString()}</p>
                <p className="text-xs font-semibold opacity-80">{selectedBrand.name}</p>
              </div>
            </div>

            <Button onClick={handlePurchase} disabled={purchasing} className="w-full rounded-xl h-12 font-bold">
              {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Purchase ৳${denomination} Card`}
            </Button>
          </motion.div>
        ) : (
          /* My Cards */
          loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : cards.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No gift cards yet</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {cards.map((card, i) => {
                const brandMatch = BRANDS.find(b => b.name === card.brand);
                const cardColor = brandMatch?.color || "from-gray-600 to-gray-800";
                const codeFormatted = card.code ? `•••• •••• ${card.code.slice(-4).padStart(4, '•')}` : "•••• •••• •••• ••••";
                return (
                  <motion.div key={card.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className={`relative overflow-hidden rounded-[19px] h-[200px] bg-gradient-to-br ${cardColor} p-5 text-white shadow-lg`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

                      {/* Top */}
                      <div className="relative flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">GIFT CARD</span>
                          <Badge variant={card.status === "active" ? "default" : "secondary"} className="text-[9px] h-4 px-1.5">{card.status}</Badge>
                        </div>
                        <img src="/icons/easypay-logo.webp" alt="EasyPay" className="h-6 object-contain brightness-0 invert" />
                      </div>

                      {/* Chip */}
                      <div className="relative mt-4 mb-3">
                        <svg width="36" height="28" viewBox="0 0 45 34" fill="none">
                          <rect x="0.5" y="0.5" width="44" height="33" rx="5" fill="#d4a853" stroke="#c4963f" />
                          <line x1="0" y1="12" x2="45" y2="12" stroke="#c4963f" strokeWidth="0.7" />
                          <line x1="0" y1="22" x2="45" y2="22" stroke="#c4963f" strokeWidth="0.7" />
                          <line x1="15" y1="0" x2="15" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                          <line x1="30" y1="0" x2="30" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                        </svg>
                      </div>

                      {/* Code as card number */}
                      <p className="relative text-[13px] font-mono tracking-[0.2em] opacity-90">{codeFormatted}</p>

                      {/* Bottom */}
                      <div className="relative flex items-end justify-between mt-auto pt-2">
                        <div>
                          <p className="text-xl font-bold">৳{Number(card.denomination).toLocaleString()}</p>
                          <p className="text-[10px] opacity-60">{new Date(card.purchased_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => copyCode(card.code)} className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => shareCard(card)} className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"><Share2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default GiftCardsPage;
