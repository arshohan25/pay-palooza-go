import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onNavigate: (path: string) => void;
}

interface Suggestion {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image_url: string | null;
  category: string;
}

export default function SearchAutocomplete({ value, onChange, onNavigate }: SearchAutocompleteProps) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("merchant_products")
      .select("id, name, price, emoji, image_url, category")
      .eq("is_active", true)
      .ilike("name", `%${query}%`)
      .limit(8);
    if (data) setSuggestions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value.trim());
      setShowDropdown(true);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search products, brands, stores..."
        className="pl-9 pr-8 h-9 text-sm rounded-full border-border/40 bg-muted/30 focus-visible:ring-primary/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.trim().length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
      />
      {value && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => { onChange(""); setSuggestions([]); setShowDropdown(false); }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden max-h-[320px] overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
              onClick={() => {
                setShowDropdown(false);
                onNavigate(`/product/${s.id}`);
              }}
            >
              <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{s.emoji}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">{s.category}</p>
              </div>
              <p className="text-sm font-bold text-primary shrink-0">৳{s.price.toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
