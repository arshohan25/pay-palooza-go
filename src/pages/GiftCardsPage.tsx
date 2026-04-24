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
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"buy" | "my">("buy");
  const { rewards: aiGiftRewards, claimReward } = useAiRewards("gift_card");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from("gift_cards").select("*").eq("purchaser_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setCards(data || []); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!kycLoading && kycStatus !== "verified") {
      toast.error("Please complete KYC verification to use this feature.");
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate]);

  

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

  const redeemCard = async (card: any) => {
    const { data, error } = await supabase.rpc("redeem_gift_card", { p_code: card.code });
    if (error) { toast.error(error.message); return; }
    const res = data as { success: boolean; error?: string; credited_amount?: number; brand?: string };
    if (!res?.success) { toast.error(res?.error || "Redemption failed"); return; }
    toast.success(`৳${res.credited_amount} ${res.brand} credited to your wallet!`);
    if (user) {
      const { data: refreshed } = await supabase.from("gift_cards").select("*").eq("purchaser_id", user.id).order("created_at", { ascending: false });
      setCards(refreshed || []);
    }
  };

  const isExpired = (card: any) => card.status === "expired" || (card.expires_at && new Date(card.expires_at) < new Date());

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

              {/* Category Dropdown */}
              <div>
                <p className="text-sm font-bold text-foreground tracking-tight mb-2">Select Category</p>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger className="w-full rounded-2xl h-12 bg-muted/30 ring-1 ring-border/30 text-sm font-semibold backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 ring-1 ring-border/20">
                        <img src={selectedBrand.img} alt="" className="w-full h-full object-cover" />
                      </div>
                      <SelectValue placeholder="Choose a category" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl max-h-[320px]">
                    {BRANDS.map(b => (
                      <SelectItem key={b.id} value={b.id} className="rounded-xl py-2.5 px-3 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/20">
                            <img src={b.img} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center gap-2">
                            <b.icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{b.name}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Amount Dropdown */}
              <div>
                <p className="text-sm font-bold text-foreground tracking-tight mb-2">Select Amount</p>
                <Select value={String(denomination)} onValueChange={v => setDenomination(Number(v))}>
                  <SelectTrigger className="w-full rounded-2xl h-12 bg-muted/30 ring-1 ring-border/30 text-sm font-bold backdrop-blur">
                    <SelectValue placeholder="Choose amount" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {DENOMINATIONS.map(d => (
                      <SelectItem key={d} value={String(d)} className="rounded-xl py-2.5 px-3 cursor-pointer text-sm font-semibold">
                        ৳{d.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                                {(() => {
                                  const expired = isExpired(card);
                                  const label = expired ? "expired" : card.status;
                                  const tone = expired
                                    ? "bg-red-500/30 text-white border-red-300/40"
                                    : card.status === "active"
                                      ? "bg-white/20 text-white border-white/30"
                                      : "bg-white/10 text-white/80 border-white/20";
                                  return (
                                    <Badge variant="secondary" className={`text-[9px] h-4 px-1.5 backdrop-blur-sm ${tone}`}>
                                      {label}
                                    </Badge>
                                  );
                                })()}
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
                                {card.status === "active" && !isExpired(card) && (
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => redeemCard(card)}
                                    className="px-3 h-7 rounded-full bg-white text-foreground text-[11px] font-bold hover:bg-white/90 transition-colors shadow">
                                    Redeem
                                  </motion.button>
                                )}
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
