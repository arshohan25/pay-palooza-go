import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  imageUrl?: string | null;
  emoji: string;
  alt?: string;
  className?: string;
  emojiSize?: string;
}

const ProductImage = ({ imageUrl, emoji, alt = "Product", className, emojiSize = "text-5xl" }: ProductImageProps) => {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
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
