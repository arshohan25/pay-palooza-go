import { useState } from "react";
import { Star, Loader2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WriteReviewFormProps {
  productId: string;
  orderId?: string;
  onSuccess?: () => void;
}

export default function WriteReviewForm({ productId, orderId, onSuccess }: WriteReviewFormProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    if (images.length + files.length > 3) {
      toast.error("Maximum 3 images allowed");
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `reviews/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("review-images").upload(path, file);
      if (error) {
        toast.error("Upload failed");
        continue;
      }
      const { data: urlData } = supabase.storage.from("review-images").getPublicUrl(path);
      newUrls.push(urlData.publicUrl);
    }

    setImages((prev) => [...prev, ...newUrls]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("Please sign in"); return; }
    if (rating === 0) { toast.error("Please select a rating"); return; }

    setSubmitting(true);
    const { error } = await (supabase as any).from("product_reviews").insert({
      product_id: productId,
      user_id: user.id,
      rating,
      title: title.trim() || null,
      body: body.trim() || null,
      images: images.length > 0 ? images : null,
      order_id: orderId || null,
      is_verified_purchase: !!orderId,
    });

    if (error) {
      toast.error(error.message || "Failed to submit review");
    } else {
      toast.success("Review submitted!");
      setRating(0); setTitle(""); setBody(""); setImages([]);
      onSuccess?.();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
      <h3 className="text-sm font-bold text-foreground">Write a Review</h3>

      {/* Star Rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(star)}
          >
            <Star
              className={cn(
                "w-7 h-7 transition-colors",
                (hoverRating || rating) >= star
                  ? "fill-accent text-accent"
                  : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-xs text-muted-foreground ml-2">
            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
          </span>
        )}
      </div>

      <Input
        placeholder="Review title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
      />

      <Textarea
        placeholder="Tell others about your experience..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1000}
      />

      {/* Image Upload */}
      <div className="flex items-center gap-2 flex-wrap">
        {images.map((url, i) => (
          <div key={i} className="relative w-14 h-14">
            <img src={url} alt="" className="w-full h-full rounded-lg object-cover" />
            <button
              onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < 3 && (
          <label className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4 text-muted-foreground" />}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={submitting || rating === 0} className="w-full">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Submit Review
      </Button>
    </div>
  );
}
