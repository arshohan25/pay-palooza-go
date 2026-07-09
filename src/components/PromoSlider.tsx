import { useState, useEffect, useCallback, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { icons } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useI18n } from "@/lib/i18n";

interface PromoBanner {
  id: string;
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  icon: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  link_url: string | null;
  media_url: string | null;
  media_type: string | null;
  sort_order: number;
}

interface PromoSliderProps {
  onFeatureOpen?: (feature: string) => void;
}

const FALLBACK_BANNERS: PromoBanner[] = [
  {
    id: "fallback-1",
    title: "Invite Friends & Earn ৳50",
    subtitle: "Share your referral code and earn rewards when friends join EasyPay",
    badge_text: "Limited Offer",
    icon: "Gift",
    gradient_from: "#0ea5e9",
    gradient_to: "#06b6d4",
    link_url: "feature:refer",
    media_url: null,
    media_type: null,
    sort_order: 0,
  },
];

export default function PromoSlider({ onFeatureOpen }: PromoSliderProps) {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigate = useNavigate();
  const { isDisabled } = useGlobalToggles();
  const { t } = useI18n();

  // Filter out banners linked to disabled features
  const visibleBanners = useMemo(() => {
    return banners.filter((b) => {
      if (!b.link_url?.startsWith("feature:")) return true;
      const featureKey = b.link_url.replace("feature:", "");
      return !isDisabled(featureKey);
    });
  }, [banners, isDisabled]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("promo_banners")
        .select("id, title, subtitle, badge_text, icon, gradient_from, gradient_to, link_url, media_url, media_type, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      setBanners(data && data.length > 0 ? (data as PromoBanner[]) : FALLBACK_BANNERS);
    };
    load();
  }, []);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIdx(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  // Auto-play
  useEffect(() => {
    if (!emblaApi || visibleBanners.length <= 1) return;
    const iv = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(iv);
  }, [emblaApi, visibleBanners.length]);

  const handleClick = (b: PromoBanner) => {
    if (!b.link_url) return;

    if (b.link_url.startsWith("feature:")) {
      const feature = b.link_url.replace("feature:", "");
      if (onFeatureOpen) {
        onFeatureOpen(feature);
      }
    } else if (b.link_url.startsWith("/")) {
      navigate(b.link_url);
    } else if (b.link_url.startsWith("http")) {
      window.open(b.link_url, "_blank", "noopener");
    }
  };

  if (visibleBanners.length === 0) return null;

  return (
    <div className="relative">
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex">
          {visibleBanners.map((b) => {
            const IconComp = (icons as any)[b.icon || "Gift"] || icons.Gift;
            const hasMedia = !!b.media_url;
            const isFallback = b.id === "fallback-1";
            const title = isFallback ? t("psFallbackTitle") : b.title;
            const subtitle = isFallback ? t("psFallbackSubtitle") : b.subtitle;
            const badge = isFallback ? t("psFallbackBadge") : b.badge_text;
            return (
              <div key={b.id} className="min-w-0 shrink-0 grow-0 basis-full">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "relative overflow-hidden rounded-2xl p-4 h-[120px]",
                    b.link_url ? "cursor-pointer" : ""
                  )}
                  style={{
                    background: hasMedia
                      ? undefined
                      : `linear-gradient(135deg, ${b.gradient_from || "#0ea5e9"}, ${b.gradient_to || "#06b6d4"})`,
                  }}
                  onClick={() => handleClick(b)}
                >
                  {/* Media background */}
                  {hasMedia && b.media_type === "video" ? (
                    <video
                      src={b.media_url!}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : hasMedia ? (
                    <img
                      src={b.media_url!}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : null}

                  {/* Dark overlay for media backgrounds */}
                  {hasMedia && (
                    <div className="absolute inset-0 bg-black/40" />
                  )}

                  <div className="relative z-10 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      {badge && (
                        <span className="inline-block bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 backdrop-blur-sm">
                          {badge}
                        </span>
                      )}
                      {title && <h3 className="text-white text-sm font-bold leading-tight">{title}</h3>}
                      {subtitle && (
                        <p className="text-white/80 text-xs mt-1 leading-snug line-clamp-2">{subtitle}</p>
                      )}
                    </div>
                    {!hasMedia && (
                      <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                        <IconComp className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  {/* Decorative circles (only for gradient banners) */}
                  {!hasMedia && (
                    <>
                      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
                      <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />
                    </>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators overlaid on banner */}
      {visibleBanners.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
          <div className="flex gap-1.5 rounded-full bg-black/20 px-2 py-1 backdrop-blur-sm">
            {visibleBanners.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === selectedIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
