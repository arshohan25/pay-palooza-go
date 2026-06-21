import { useState, useEffect } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  is_verified_purchase: boolean;
  created_at: string;
  user_name?: string;
}

interface ProductReviewsProps {
  productId: string;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("product_reviews")
        .select("id, rating, title, body, images, is_verified_purchase, created_at, user_id")
        .eq("product_id", productId)
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        // Fetch reviewer names
        const userIds = data.map((r: any) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", userIds);

        const nameMap = new Map(profiles?.map((p) => [p.user_id, p.name]) ?? []);

        setReviews(data.map((r: any) => ({
          ...r,
          user_name: nameMap.get(r.user_id) || "Anonymous",
        })));
      }
      setLoading(false);
    };
    load();
  }, [productId]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No reviews yet. Be the first to review this product!
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {reviews.map((review) => (
        <div key={review.id} className="bg-muted/30 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">{review.user_name}</span>
              {review.is_verified_purchase && (
                <span className="text-[10px] text-primary font-medium">✓ Verified</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < review.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
          {review.title && <p className="text-sm font-medium text-foreground">{review.title}</p>}
          {review.body && <p className="text-xs text-muted-foreground">{review.body}</p>}
          {review.images && review.images.length > 0 && (
            <div className="flex gap-2 mt-1">
              {review.images.map((img, i) => (
                <img key={i} src={img} alt="" className="w-12 h-12 rounded object-cover" />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
