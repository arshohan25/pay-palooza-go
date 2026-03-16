import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare } from "lucide-react";

interface Feedback {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  screen: string | null;
  created_at: string;
}

export default function AdminUserFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setFeedback((data as any[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const avgRating = feedback.length > 0 ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : "—";
  const distribution = [5, 4, 3, 2, 1].map(r => ({ rating: r, count: feedback.filter(f => f.rating === r).length }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{avgRating}</p>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(Number(avgRating)) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average Rating</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{feedback.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Responses</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Distribution</p>
            {distribution.map(d => (
              <div key={d.rating} className="flex items-center gap-2 mb-1">
                <span className="text-xs w-4 text-right text-foreground">{d.rating}</span>
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-6">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Feedback List */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="w-5 h-5" /> Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>
          ) : feedback.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No feedback received yet</p>
          ) : (
            <div className="space-y-3">
              {feedback.map(f => (
                <div key={f.id} className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= f.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />)}
                    </div>
                    <div className="flex items-center gap-2">
                      {f.screen && <Badge variant="outline" className="text-[10px]">{f.screen}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {f.comment && <p className="text-sm text-foreground mt-1">{f.comment}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">{f.user_id.slice(0, 8)}…</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
