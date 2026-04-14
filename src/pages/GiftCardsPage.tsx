import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Gift, Copy, Share2, Loader2,
  ShoppingBag, Coffee, Gamepad2, Music, Tv, Plane,
  Heart, BookOpen, Shirt, Fuel, Smartphone, Sparkles,
  Palette, Dumbbell, GraduationCap, Utensils, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAiRewards } from "@/hooks/use-ai-rewards";
import AiRewardBanner from "@/components/AiRewardBanner";

import imgAll from "@/assets/giftcard/all.jpg";
import imgShopping from "@/assets/giftcard/shopping.jpg";
import imgFood from "@/assets/giftcard/food.jpg";
import imgGaming from "@/assets/giftcard/gaming.jpg";
import imgEntertainment from "@/assets/giftcard/entertainment.jpg";
import imgStreaming from "@/assets/giftcard/streaming.jpg";
import imgTravel from "@/assets/giftcard/travel.jpg";
import imgHealth from "@/assets/giftcard/health.jpg";
import imgEducation from "@/assets/giftcard/education.jpg";
import imgFashion from "@/assets/giftcard/fashion.jpg";
import imgFuel from "@/assets/giftcard/fuel.jpg";
import imgMobile from "@/assets/giftcard/mobile.jpg";
import imgBeauty from "@/assets/giftcard/beauty.jpg";
import imgBooks from "@/assets/giftcard/books.jpg";
import imgFitness from "@/assets/giftcard/fitness.jpg";
import imgRestaurant from "@/assets/giftcard/restaurant.jpg";
import imgArt from "@/assets/giftcard/art.jpg";

const BRANDS = [
  { id: "all", name: "All Categories", icon: Layers, color: "from-slate-700 to-zinc-900", img: imgAll },
  { id: "shopping", name: "Shopping", icon: ShoppingBag, color: "from-pink-500 to-rose-600", img: imgShopping },
  { id: "food", name: "Food & Dining", icon: Coffee, color: "from-amber-500 to-orange-600", img: imgFood },
  { id: "gaming", name: "Gaming", icon: Gamepad2, color: "from-violet-500 to-purple-600", img: imgGaming },
  { id: "entertainment", name: "Entertainment", icon: Music, color: "from-blue-500 to-indigo-600", img: imgEntertainment },
  { id: "streaming", name: "Streaming", icon: Tv, color: "from-red-500 to-rose-700", img: imgStreaming },
  { id: "travel", name: "Travel", icon: Plane, color: "from-sky-500 to-cyan-600", img: imgTravel },
  { id: "health", name: "Health & Wellness", icon: Heart, color: "from-emerald-500 to-green-600", img: imgHealth },
  { id: "education", name: "Education", icon: GraduationCap, color: "from-indigo-500 to-blue-700", img: imgEducation },
  { id: "fashion", name: "Fashion", icon: Shirt, color: "from-fuchsia-500 to-pink-600", img: imgFashion },
  { id: "fuel", name: "Fuel & Gas", icon: Fuel, color: "from-slate-600 to-zinc-800", img: imgFuel },
  { id: "mobile", name: "Mobile Recharge", icon: Smartphone, color: "from-teal-500 to-emerald-600", img: imgMobile },
  { id: "beauty", name: "Beauty & Spa", icon: Sparkles, color: "from-rose-400 to-pink-500", img: imgBeauty },
  { id: "books", name: "Books & Media", icon: BookOpen, color: "from-yellow-600 to-amber-700", img: imgBooks },
  { id: "fitness", name: "Fitness & Sports", icon: Dumbbell, color: "from-lime-600 to-green-700", img: imgFitness },
  { id: "restaurant", name: "Restaurant", icon: Utensils, color: "from-orange-500 to-red-600", img: imgRestaurant },
  { id: "art", name: "Art & Craft", icon: Palette, color: "from-purple-400 to-violet-600", img: imgArt },
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
    const selectedBrandInfo = brand === "all" ? BRANDS[0] : BRANDS.find(b => b.id === brand)!;
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted/60 backdrop-blur flex items-center justify-center ring-1 ring-border/30">
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
        {/* Tabs */}
        <div className="flex gap-1.5 bg-muted/40 backdrop-blur rounded-2xl p-1 ring-1 ring-border/20">
          {[
            { key: "buy" as const, label: "Buy Card", icon: Gift },
            { key: "my" as const, label: "My Cards", icon: Layers },
          ].map(t => (
            <motion.button key={t.key} whileTap={{ scale: 0.97 }} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === t.key ? "bg-background shadow-md text-foreground ring-1 ring-border/30" : "text-muted-foreground"
              }`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </motion.button>
          ))}
        </div>

        {aiGiftRewards.length > 0 && <AiRewardBanner rewards={aiGiftRewards} onClaim={claimReward} />}

        <AnimatePresence mode="wait">
          {tab === "buy" ? (
            <motion.div key="buy" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }} className="space-y-5">

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
                    return (
                      <motion.button key={b.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.02 }} whileTap={{ scale: 0.95 }} onClick={() => setBrand(b.id)}
                        className={`relative flex flex-col items-center gap-1 p-2 pb-2.5 rounded-2xl text-xs font-semibold transition-all overflow-hidden h-[88px] ${
                          isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/20" : "ring-1 ring-border/30 hover:ring-border/60"
                        }`}>
                        {/* Background image */}
                        <img src={b.img} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                        {/* Dark overlay for text readability */}
                        <div className={`absolute inset-0 ${isSelected ? "bg-black/30" : "bg-black/50"} transition-all`} />

                        <div className={`relative z-10 w-7 h-7 rounded-lg flex items-center justify-center mt-1 ${
                          isSelected ? "bg-white/30 backdrop-blur-sm" : "bg-white/20 backdrop-blur-sm"
                        }`}>
                          <b.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="relative z-10 truncate w-full text-center leading-tight text-[10px] text-white font-bold drop-shadow-md">
                          {b.id === "all" ? "All" : b.name}
                        </span>

                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent pointer-events-none z-[5]" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {BRANDS.length > 9 && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAllCategories(!showAllCategories)}
                    className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 bg-muted/30 ring-1 ring-border/20">
                    {showAllCategories ? <>Show Less <ChevronUp className="w-3.5 h-3.5" /></> : <>Show All {BRANDS.length - 1} Categories <ChevronDown className="w-3.5 h-3.5" /></>}
                  </motion.button>
                )}
              </div>

              {/* Universal info */}
              {brand === "all" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="rounded-2xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 ring-1 ring-primary/15 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Universal Gift Card</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Redeemable across all {BRANDS.length - 1} categories</p>
                  </div>
                </motion.div>
              )}

              {/* Denomination */}
              <div>
                <p className="text-sm font-bold text-foreground tracking-tight mb-3">Select Amount</p>
                <div className="flex flex-wrap gap-2">
                  {DENOMINATIONS.map(d => (
                    <motion.button key={d} whileTap={{ scale: 0.93 }} onClick={() => setDenomination(d)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        denomination === d
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/30"
                          : "bg-muted/50 text-muted-foreground ring-1 ring-border/30 hover:ring-border/60"
                      }`}>
                      ৳{d.toLocaleString()}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Preview Card with real image */}
              <motion.div layout className="relative overflow-hidden rounded-[19px] h-[210px] shadow-xl">
                {/* Real category image background */}
                <img src={selectedBrand.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                {/* Dark gradient overlay for text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
                {/* Glossy shine */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />

                <div className="relative z-10 p-5 h-full flex flex-col text-white">
                  {/* Top */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">GIFT CARD</span>
                      {brand === "all" && (
                        <span className="text-[8px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">UNIVERSAL</span>
                      )}
                    </div>
                    <img src="/icons/easypay-logo.webp" alt="EasyPay" className="h-7 object-contain brightness-0 invert" />
                  </div>

                  {/* Chip */}
                  <div className="mt-5 mb-4">
                    <svg width="45" height="34" viewBox="0 0 45 34" fill="none">
                      <rect x="0.5" y="0.5" width="44" height="33" rx="5" fill="#d4a853" stroke="#c4963f" />
                      <line x1="0" y1="12" x2="45" y2="12" stroke="#c4963f" strokeWidth="0.7" />
                      <line x1="0" y1="22" x2="45" y2="22" stroke="#c4963f" strokeWidth="0.7" />
                      <line x1="15" y1="0" x2="15" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                      <line x1="30" y1="0" x2="30" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                    </svg>
                  </div>

                  {/* Card number */}
                  <p className="text-[15px] font-mono tracking-[0.25em] opacity-90">•••• •••• •••• ••••</p>

                  {/* Bottom */}
                  <div className="flex items-end justify-between mt-auto pt-2">
                    <p className="text-2xl font-bold drop-shadow-lg">৳{denomination.toLocaleString()}</p>
                    <div className="text-right">
                      <p className="text-xs font-semibold opacity-90 drop-shadow">{selectedBrand.name}</p>
                      {brand === "all" && <p className="text-[9px] opacity-60">{BRANDS.length - 1} categories</p>}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Purchase */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button onClick={handlePurchase} disabled={purchasing} className="w-full rounded-2xl h-13 font-bold text-base shadow-lg shadow-primary/20">
                  {purchasing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><Gift className="w-4 h-4 mr-2" />Purchase ৳{denomination.toLocaleString()} {brand === "all" ? "Universal" : selectedBrand.name} Card</>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="my" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : cards.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                    <Gift className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No gift cards yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Purchase your first gift card to get started</p>
                  <Button variant="outline" size="sm" onClick={() => setTab("buy")} className="rounded-xl">Buy a Card</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cards.map((card, i) => {
                    const brandMatch = BRANDS.find(b => b.name === card.brand);
                    const cardImg = brandMatch?.img || imgAll;
                    const codeFormatted = card.code ? `•••• •••• ${card.code.slice(-4).padStart(4, '•')}` : "•••• •••• •••• ••••";
                    return (
                      <motion.div key={card.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 28 }}>
                        <div className="relative overflow-hidden rounded-[19px] h-[200px] shadow-lg">
                          {/* Real image background */}
                          <img src={cardImg} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/15" />
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

                          <div className="relative z-10 p-5 h-full flex flex-col text-white">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">GIFT CARD</span>
                                <Badge variant={card.status === "active" ? "default" : "secondary"}
                                  className={`text-[9px] h-4 px-1.5 ${card.status === "active" ? "bg-white/20 text-white border-white/30 backdrop-blur-sm" : ""}`}>
                                  {card.status}
                                </Badge>
                              </div>
                              <img src="/icons/easypay-logo.webp" alt="EasyPay" className="h-6 object-contain brightness-0 invert" />
                            </div>

                            <div className="mt-4 mb-3">
                              <svg width="36" height="28" viewBox="0 0 45 34" fill="none">
                                <rect x="0.5" y="0.5" width="44" height="33" rx="5" fill="#d4a853" stroke="#c4963f" />
                                <line x1="0" y1="12" x2="45" y2="12" stroke="#c4963f" strokeWidth="0.7" />
                                <line x1="0" y1="22" x2="45" y2="22" stroke="#c4963f" strokeWidth="0.7" />
                                <line x1="15" y1="0" x2="15" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                                <line x1="30" y1="0" x2="30" y2="34" stroke="#c4963f" strokeWidth="0.7" />
                              </svg>
                            </div>

                            <p className="text-[13px] font-mono tracking-[0.2em] opacity-90">{codeFormatted}</p>

                            <div className="flex items-end justify-between mt-auto pt-2">
                              <div>
                                <p className="text-xl font-bold drop-shadow-lg">৳{Number(card.denomination).toLocaleString()}</p>
                                <p className="text-[10px] opacity-60">{new Date(card.purchased_at).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => copyCode(card.code)}
                                  className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors backdrop-blur-sm">
                                  <Copy className="w-3.5 h-3.5" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => shareCard(card)}
                                  className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors backdrop-blur-sm">
                                  <Share2 className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>
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
