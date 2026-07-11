import Seo from "@/components/Seo";
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
import FlowHeader from "@/components/FlowHeader";

import { useI18n, type TranslationKey } from "@/lib/i18n";

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
  { id: "all", name: "All Categories", i18n: "gcAll" as TranslationKey, icon: Layers, color: "from-slate-700 to-zinc-900", img: imgAll },
  { id: "shopping", name: "Shopping", i18n: "gcShopping" as TranslationKey, icon: ShoppingBag, color: "from-pink-500 to-rose-600", img: imgShopping },
  { id: "food", name: "Food & Dining", i18n: "gcFood" as TranslationKey, icon: Coffee, color: "from-amber-500 to-orange-600", img: imgFood },
  { id: "gaming", name: "Gaming", i18n: "gcGaming" as TranslationKey, icon: Gamepad2, color: "from-violet-500 to-purple-600", img: imgGaming },
  { id: "entertainment", name: "Entertainment", i18n: "gcEntertainment" as TranslationKey, icon: Music, color: "from-blue-500 to-indigo-600", img: imgEntertainment },
  { id: "streaming", name: "Streaming", i18n: "gcStreaming" as TranslationKey, icon: Tv, color: "from-red-500 to-rose-700", img: imgStreaming },
  { id: "travel", name: "Travel", i18n: "gcTravel" as TranslationKey, icon: Plane, color: "from-sky-500 to-cyan-600", img: imgTravel },
  { id: "health", name: "Health & Wellness", i18n: "gcHealth" as TranslationKey, icon: Heart, color: "from-emerald-500 to-green-600", img: imgHealth },
  { id: "education", name: "Education", i18n: "gcEducation" as TranslationKey, icon: GraduationCap, color: "from-indigo-500 to-blue-700", img: imgEducation },
  { id: "fashion", name: "Fashion", i18n: "gcFashion" as TranslationKey, icon: Shirt, color: "from-fuchsia-500 to-pink-600", img: imgFashion },
  { id: "fuel", name: "Fuel & Gas", i18n: "gcFuel" as TranslationKey, icon: Fuel, color: "from-slate-600 to-zinc-800", img: imgFuel },
  { id: "mobile", name: "Mobile Recharge", i18n: "gcMobile" as TranslationKey, icon: Smartphone, color: "from-teal-500 to-emerald-600", img: imgMobile },
  { id: "beauty", name: "Beauty & Spa", i18n: "gcBeauty" as TranslationKey, icon: Sparkles, color: "from-rose-400 to-pink-500", img: imgBeauty },
  { id: "books", name: "Books & Media", i18n: "gcBooks" as TranslationKey, icon: BookOpen, color: "from-yellow-600 to-amber-700", img: imgBooks },
  { id: "fitness", name: "Fitness & Sports", i18n: "gcFitness" as TranslationKey, icon: Dumbbell, color: "from-lime-600 to-green-700", img: imgFitness },
  { id: "restaurant", name: "Restaurant", i18n: "gcRestaurant" as TranslationKey, icon: Utensils, color: "from-orange-500 to-red-600", img: imgRestaurant },
  { id: "art", name: "Art & Craft", i18n: "gcArt" as TranslationKey, icon: Palette, color: "from-purple-400 to-violet-600", img: imgArt },
];

const DENOMINATIONS = [50, 100, 250, 500, 1000, 2000, 5000];

const GiftCardsPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
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
      toast.error(t("giftCardsKycRequired"));
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate, t]);

  

  const handlePurchase = async () => {
    if (!user) { toast.error(t("giftCardsSignInFirst")); return; }
    setPurchasing(true);
    const selectedBrandInfo = brand === "all" ? BRANDS[0] : BRANDS.find(b => b.id === brand)!;
    const { error } = await supabase.from("gift_cards").insert({
      purchaser_id: user.id,
      brand: selectedBrandInfo?.name || brand,
      denomination,
    } as any);

    if (error) toast.error(t("giftCardsBuyFailed"));
    else {
      toast.success(t("giftCardsBought"));
      const { data } = await supabase.from("gift_cards").select("*").eq("purchaser_id", user.id).order("created_at", { ascending: false });
      setCards(data || []);
      setTab("my");
    }
    setPurchasing(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t("giftCardsCodeCopied"));
  };

  const shareCard = (card: any) => {
    if (navigator.share) {
      navigator.share({ title: t("giftCardsShareTitle"), text: `${t("giftCardsShareTextPrefix")} ৳${card.denomination} ${card.brand} ${t("giftCardsShareTextSuffix")} ${card.code}` });
    } else copyCode(card.code);
  };

  const redeemCard = async (card: any) => {
    const { data, error } = await supabase.rpc("redeem_gift_card", { p_code: card.code });
    if (error) { toast.error(error.message); return; }
    const res = data as { success: boolean; error?: string; credited_amount?: number; brand?: string };
    if (!res?.success) { toast.error(res?.error || t("giftCardsRedemptionFailed")); return; }
    toast.success(`৳${res.credited_amount} ${res.brand} ${t("giftCardsCreditedPrefix")}`);
    if (user) {
      const { data: refreshed } = await supabase.from("gift_cards").select("*").eq("purchaser_id", user.id).order("created_at", { ascending: false });
      setCards(refreshed || []);
    }
  };

  const isExpired = (card: any) => card.status === "expired" || (card.expires_at && new Date(card.expires_at) < new Date());

  const selectedBrand = BRANDS.find(b => b.id === brand) || BRANDS[0];

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Gift Cards – EasyPay"
        description="Buy and send digital gift cards across 17 categories – fashion, food, gaming, travel and more – instantly with EasyPay."
        path="/giftcards"
      />
      <FlowHeader
        title={t("giftCardsTitle")}
        tagline={t("giftCardsTagline")}
        icon={Gift}
      />


      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1.5 bg-muted/40 backdrop-blur rounded-2xl p-1 ring-1 ring-border/20">
          {[
            { key: "buy" as const, label: t("giftCardsBuyCard"), icon: Gift },
            { key: "my" as const, label: t("giftCardsMyCards"), icon: Layers },
          ].map(tb => (
            <motion.button key={tb.key} whileTap={{ scale: 0.97 }} onClick={() => setTab(tb.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === tb.key ? "bg-background shadow-md text-foreground ring-1 ring-border/30" : "text-muted-foreground"
              }`}>
              <tb.icon className="w-3.5 h-3.5" />{tb.label}
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
                <p className="text-sm font-bold text-foreground tracking-tight mb-2">{t("giftCardsSelectCategory")}</p>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger className="w-full rounded-2xl h-12 bg-muted/30 ring-1 ring-border/30 text-sm font-semibold backdrop-blur">
                    <SelectValue placeholder={t("giftCardsChooseCategory")} />
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
                            <span className="text-sm font-medium">{t(b.i18n)}</span>
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
                    <p className="text-xs font-bold text-foreground">{t("giftCardsUniversal")}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{t("giftCardsUniversalDescPrefix")} {BRANDS.length - 1} {t("giftCardsUniversalDescSuffix")}</p>
                  </div>
                </motion.div>
              )}

              {/* Amount Dropdown */}
              <div>
                <p className="text-sm font-bold text-foreground tracking-tight mb-2">{t("giftCardsSelectAmount")}</p>
                <Select value={String(denomination)} onValueChange={v => setDenomination(Number(v))}>
                  <SelectTrigger className="w-full rounded-2xl h-12 bg-muted/30 ring-1 ring-border/30 text-sm font-bold backdrop-blur">
                    <SelectValue placeholder={t("giftCardsChooseAmount")} />
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

              {/* Preview Card — modern premium */}
              <motion.div layout className="relative overflow-hidden rounded-[22px] h-[220px] shadow-2xl ring-1 ring-black/5">
                {/* Background image */}
                <img src={selectedBrand.img} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
                {/* Unified professional overlay — consistent across all categories */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-slate-950/90" />
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-primary/10 mix-blend-overlay" />
                {/* Soft top sheen */}
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                {/* Brand primary glow */}
                <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/40 opacity-50 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />


                <div className="relative z-10 p-5 h-full flex flex-col text-white">
                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur-md ring-1 ring-white/20 flex items-center justify-center">
                        <selectedBrand.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="leading-tight">
                        <p className="text-[9px] font-bold tracking-[0.25em] uppercase opacity-70">{t("giftCardsLabel")}</p>
                        <p className="text-[11px] font-semibold tracking-tight">{t(selectedBrand.i18n)}</p>
                      </div>
                    </div>
                    <img src="/icons/easypay-logo.webp" alt="EasyPay" className="h-6 object-contain brightness-0 invert opacity-90" />
                  </div>

                  {/* Denomination — hero */}
                  <div className="mt-auto">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-60">{t("giftCardsValue")}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[22px] font-light opacity-80">৳</span>
                      <span className="text-5xl font-bold tracking-tight drop-shadow-lg tabular-nums">{denomination.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="mt-3 flex items-end justify-between border-t border-white/15 pt-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] opacity-55">{t("giftCardsValidThru")}</p>
                      <p className="text-[11px] font-semibold tabular-nums tracking-wider">12 / 27</p>
                    </div>
                    {brand === "all" ? (
                      <span className="text-[9px] font-bold bg-white/15 backdrop-blur-md px-2 py-1 rounded-md ring-1 ring-white/20 uppercase tracking-wider">{t("giftCardsUniversalChip")}</span>
                    ) : (
                      <p className="text-[10px] font-medium opacity-70 tracking-wider uppercase">{t("giftCardsPremium")}</p>
                    )}
                  </div>
                </div>
              </motion.div>


              {/* Purchase */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button onClick={handlePurchase} disabled={purchasing} className="w-full rounded-2xl h-13 font-bold text-base shadow-lg shadow-primary/20">
                  {purchasing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><Gift className="w-4 h-4 mr-2" />{t("giftCardsPurchase")} ৳{denomination.toLocaleString()} {brand === "all" ? t("giftCardsUniversalChip") : t(selectedBrand.i18n)} {t("giftCardsCard")}</>
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
                  <p className="text-sm font-semibold text-foreground">{t("giftCardsNoCards")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("giftCardsNoCardsDesc")}</p>
                  <Button variant="outline" size="sm" onClick={() => setTab("buy")} className="rounded-xl">{t("giftCardsBuyACard")}</Button>
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
                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">{t("giftCardsLabel")}</span>
                                {(() => {
                                  const expired = isExpired(card);
                                  const labelKey: TranslationKey = expired ? "giftCardsStatusExpired" : card.status === "active" ? "giftCardsStatusActive" : "giftCardsStatusRedeemed";
                                  const tone = expired
                                    ? "bg-red-500/30 text-white border-red-300/40"
                                    : card.status === "active"
                                      ? "bg-white/20 text-white border-white/30"
                                      : "bg-white/10 text-white/80 border-white/20";
                                  return (
                                    <Badge variant="secondary" className={`text-[9px] h-4 px-1.5 backdrop-blur-sm ${tone}`}>
                                      {t(labelKey)}
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
                                    {t("giftCardsRedeem")}
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
