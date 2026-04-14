import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Gift, Copy, Share2, Loader2,
  ShoppingBag, Coffee, Gamepad2, Music, Tv, Plane,
  Heart, BookOpen, Shirt, Fuel, Smartphone, Sparkles,
  Palette, Dumbbell, GraduationCap, Utensils, Layers,
  ChevronDown, ChevronUp,
} from "lucide-react";
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
  { id: "all", name: "All Categories", icon: Layers, color: "from-slate-700 to-zinc-900" },
  { id: "shopping", name: "Shopping", icon: ShoppingBag, color: "from-pink-500 to-rose-600" },
  { id: "food", name: "Food & Dining", icon: Coffee, color: "from-amber-500 to-orange-600" },
  { id: "gaming", name: "Gaming", icon: Gamepad2, color: "from-violet-500 to-purple-600" },
  { id: "entertainment", name: "Entertainment", icon: Music, color: "from-blue-500 to-indigo-600" },
  { id: "streaming", name: "Streaming", icon: Tv, color: "from-red-500 to-rose-700" },
  { id: "travel", name: "Travel", icon: Plane, color: "from-sky-500 to-cyan-600" },
  { id: "health", name: "Health & Wellness", icon: Heart, color: "from-emerald-500 to-green-600" },
  { id: "education", name: "Education", icon: GraduationCap, color: "from-indigo-500 to-blue-700" },
  { id: "fashion", name: "Fashion", icon: Shirt, color: "from-fuchsia-500 to-pink-600" },
  { id: "fuel", name: "Fuel & Gas", icon: Fuel, color: "from-slate-600 to-zinc-800" },
  { id: "mobile", name: "Mobile Recharge", icon: Smartphone, color: "from-teal-500 to-emerald-600" },
  { id: "beauty", name: "Beauty & Spa", icon: Sparkles, color: "from-rose-400 to-pink-500" },
  { id: "books", name: "Books & Media", icon: BookOpen, color: "from-yellow-600 to-amber-700" },
  { id: "fitness", name: "Fitness & Sports", icon: Dumbbell, color: "from-lime-600 to-green-700" },
  { id: "restaurant", name: "Restaurant", icon: Utensils, color: "from-orange-500 to-red-600" },
  { id: "art", name: "Art & Craft", icon: Palette, color: "from-purple-400 to-violet-600" },
];

const DENOMINATIONS = [50, 100, 250, 500, 1000, 2000, 5000];

const GiftCardsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const [brand, setBrand] = useState("all");
  const [denomination, setDenomination] = useState(500);
  const [purchasing, setPurchasing] = useState(false);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"buy" | "my">("buy");
  const [showAllCategories, setShowAllCategories] = useState(false);
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

    const purchaseBrands = brand === "all"
      ? BRANDS.filter(b => b.id !== "all")
      : [BRANDS.find(b => b.id === brand)!];

    const selectedBrandInfo = purchaseBrands[0];
    const { error } = await supabase.from("gift_cards").insert({
      purchaser_id: user.id,
      brand: selectedBrandInfo?.name || brand,
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

  const selectedBrand = BRANDS.find(b => b.id === brand) || BRANDS[0];
  const visibleBrands = showAllCategories ? BRANDS : BRANDS.slice(0, 9);

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted/60 backdrop-blur flex items-center justify-center ring-1 ring-border/30"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground tracking-tight">Gift Cards</h1>
            <p className="text-[10px] text-muted-foreground">Send joy, share happiness</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Gift className="w-4 h-4 text-primary" />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Premium Tabs */}
        <div className="flex gap-1.5 bg-muted/40 backdrop-blur rounded-2xl p-1 ring-1 ring-border/20">
          {[
            { key: "buy" as const, label: "Buy Card", icon: Gift },
            { key: "my" as const, label: "My Cards", icon: Layers },
          ].map(t => (
            <motion.button
              key={t.key}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === t.key
                  ? "bg-background shadow-md text-foreground ring-1 ring-border/30"
                  : "text-muted-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </motion.button>
          ))}
        </div>

        {/* AI Recommended Gift Cards */}
        {aiGiftRewards.length > 0 && (
          <AiRewardBanner rewards={aiGiftRewards} onClaim={claimReward} />
        )}

        <AnimatePresence mode="wait">
          {tab === "buy" ? (
            <motion.div
              key="buy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-5"
            >
              {/* Category Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-foreground tracking-tight">Select Category</p>
                  <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 bg-primary/5 text-primary border-primary/20">
                    {BRANDS.length - 1} categories
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {visibleBrands.map((b, idx) => {
                    const isSelected = brand === b.id;
                    const isAll = b.id === "all";
                    return (
                      <motion.button
                        key={b.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setBrand(b.id)}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl text-xs font-semibold transition-all overflow-hidden ${
                          isSelected
                            ? "ring-2 ring-primary shadow-lg shadow-primary/20"
                            : "ring-1 ring-border/30 hover:ring-border/60"
                        }`}
                      >
                        {/* Gradient background for selected */}
                        <div className={`absolute inset-0 transition-opacity duration-300 ${
                          isSelected ? "opacity-100" : "opacity-0"
                        } bg-gradient-to-br ${b.color}`} />
                        {/* Glass overlay for non-selected */}
                        <div className={`absolute inset-0 transition-opacity duration-300 ${
                          isSelected ? "opacity-0" : "opacity-100"
                        } bg-muted/50 backdrop-blur-sm`} />

                        <div className={`relative z-10 w-8 h-8 rounded-xl flex items-center justify-center ${
                          isSelected ? "bg-white/20" : `bg-gradient-to-br ${b.color} shadow-sm`
                        }`}>
                          <b.icon className={`w-4 h-4 ${isSelected ? "text-white" : "text-white"}`} />
                        </div>
                        <span className={`relative z-10 truncate w-full text-center leading-tight text-[11px] ${
                          isSelected ? "text-white font-bold" : "text-foreground"
                        }`}>
                          {isAll ? "All" : b.name}
                        </span>

                        {/* Shine effect on selected */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Show more/less */}
                {BRANDS.length > 9 && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 bg-muted/30 ring-1 ring-border/20"
                  >
                    {showAllCategories ? (
                      <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                    ) : (
                      <>Show All {BRANDS.length - 1} Categories <ChevronDown className="w-3.5 h-3.5" /></>
                    )}
                  </motion.button>
                )}
              </div>

              {/* "All Categories" info */}
              {brand === "all" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-2xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 ring-1 ring-primary/15 p-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Universal Gift Card</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Redeemable across all {BRANDS.length - 1} categories — Shopping, Food, Gaming, Travel & more!
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Denomination */}
              <div>
                <p className="text-sm font-bold text-foreground tracking-tight mb-3">Select Amount</p>
                <div className="flex flex-wrap gap-2">
                  {DENOMINATIONS.map(d => {
                    const isSelected = denomination === d;
                    return (
                      <motion.button
                        key={d}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setDenomination(d)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/30"
                            : "bg-muted/50 text-muted-foreground ring-1 ring-border/30 hover:ring-border/60"
                        }`}
                      >
                        ৳{d.toLocaleString()}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Preview Card */}
              <motion.div
                layout
                className={`relative overflow-hidden rounded-[19px] h-[210px] bg-gradient-to-br ${selectedBrand.color} p-5 text-white shadow-xl`}
              >
                {/* Glossy overlays */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />

                {/* Top row */}
                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">GIFT CARD</span>
                    {brand === "all" && (
                      <span className="text-[8px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">UNIVERSAL</span>
                    )}
                  </div>
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
                  <div className="text-right">
                    <p className="text-xs font-semibold opacity-80">{selectedBrand.name}</p>
                    {brand === "all" && (
                      <p className="text-[9px] opacity-60">{BRANDS.length - 1} categories</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Purchase Button */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full rounded-2xl h-13 font-bold text-base shadow-lg shadow-primary/20"
                >
                  {purchasing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Purchase ৳{denomination.toLocaleString()} {brand === "all" ? "Universal" : selectedBrand.name} Card
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            /* My Cards */
            <motion.div
              key="my"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                    <Gift className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No gift cards yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Purchase your first gift card to get started</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setTab("buy")} className="rounded-xl">
                    Buy a Card
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cards.map((card, i) => {
                    const brandMatch = BRANDS.find(b => b.name === card.brand);
                    const cardColor = brandMatch?.color || "from-gray-600 to-gray-800";
                    const codeFormatted = card.code ? `•••• •••• ${card.code.slice(-4).padStart(4, '•')}` : "•••• •••• •••• ••••";
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 28 }}
                      >
                        <div className={`relative overflow-hidden rounded-[19px] h-[200px] bg-gradient-to-br ${cardColor} p-5 text-white shadow-lg`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

                          <div className="relative flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">GIFT CARD</span>
                              <Badge
                                variant={card.status === "active" ? "default" : "secondary"}
                                className={`text-[9px] h-4 px-1.5 ${card.status === "active" ? "bg-white/20 text-white border-white/30" : ""}`}
                              >
                                {card.status}
                              </Badge>
                            </div>
                            <img src="/icons/easypay-logo.webp" alt="EasyPay" className="h-6 object-contain brightness-0 invert" />
                          </div>

                          <div className="relative mt-4 mb-3">
                            <svg width="36" height="28" viewBox="0 0 45 34" fill="none">
                              <rect x="0.5" y="0.5" width="44" height="33" rx="5" fill="#d4a853" stroke="#c4963f" />
                              <line x1="0" y1="12" x2="45" y2="12" stroke="#c4963f" strokeWidth="0.7" />
                              <line x1="0" y1="22" x2="45" y2="22" stroke="#c4963f" strokeWidth="0.7" />
                              <line x1="15" y1="0" x2="15" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                              <line x1="30" y1="0" x2="30" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                            </svg>
                          </div>

                          <p className="relative text-[13px] font-mono tracking-[0.2em] opacity-90">{codeFormatted}</p>

                          <div className="relative flex items-end justify-between mt-auto pt-2">
                            <div>
                              <p className="text-xl font-bold">৳{Number(card.denomination).toLocaleString()}</p>
                              <p className="text-[10px] opacity-60">{new Date(card.purchased_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <motion.button whileTap={{ scale: 0.85 }} onClick={() => copyCode(card.code)} className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors backdrop-blur-sm">
                                <Copy className="w-3.5 h-3.5" />
                              </motion.button>
                              <motion.button whileTap={{ scale: 0.85 }} onClick={() => shareCard(card)} className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors backdrop-blur-sm">
                                <Share2 className="w-3.5 h-3.5" />
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GiftCardsPage;
