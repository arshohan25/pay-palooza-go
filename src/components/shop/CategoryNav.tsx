import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LayoutGrid, Shirt, Smartphone, Home, Utensils, Dumbbell, BookOpen, Gem, Baby, Sparkles } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  All: <LayoutGrid className="w-5 h-5" />,
  Fashion: <Shirt className="w-5 h-5" />,
  Electronics: <Smartphone className="w-5 h-5" />,
  Home: <Home className="w-5 h-5" />,
  Food: <Utensils className="w-5 h-5" />,
  Sports: <Dumbbell className="w-5 h-5" />,
  Books: <BookOpen className="w-5 h-5" />,
  Beauty: <Gem className="w-5 h-5" />,
  Kids: <Baby className="w-5 h-5" />,
};

const FALLBACK_ICON = <Sparkles className="w-5 h-5" />;

interface CategoryNavProps {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
}

export default function CategoryNav({ categories, selected, onSelect }: CategoryNavProps) {
  const allCats = ["All", ...categories];

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 px-4 py-3">
        {allCats.map((cat) => {
          const isActive = selected === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className="flex flex-col items-center gap-1.5 min-w-[56px] shrink-0 group"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                    : "bg-muted/70 text-muted-foreground group-hover:bg-muted group-hover:scale-105"
                )}
              >
                {CATEGORY_ICONS[cat] || FALLBACK_ICON}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight text-center truncate max-w-[56px] transition-colors",
                  isActive ? "text-primary font-semibold" : "text-muted-foreground"
                )}
              >
                {cat}
              </span>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
