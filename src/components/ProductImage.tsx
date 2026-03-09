import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  imageUrl?: string | null;
  images?: string[];
  emoji: string;
  alt?: string;
  className?: string;
  emojiSize?: string;
}

const ProductImage = ({ imageUrl, images, emoji, alt = "Product", className, emojiSize = "text-5xl" }: ProductImageProps) => {
  const [failed, setFailed] = useState(false);

  // Prefer first item from images array, fallback to legacy imageUrl
  const primaryUrl = (images && images.length > 0) ? images[0] : imageUrl;

  if (primaryUrl && !failed) {
    return (
      <img
        src={primaryUrl}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn("w-full h-full object-cover", className)}
        loading="lazy"
      />
    );
  }

  return <span className={cn(emojiSize, "group-hover:scale-110 transition-transform duration-200")}>{emoji}</span>;
};

export default ProductImage;
