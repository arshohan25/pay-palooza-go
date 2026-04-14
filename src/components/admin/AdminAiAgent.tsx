import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Bot, Sparkles, Send, Users, TrendingUp, TrendingDown, Gift, CreditCard,
  AlertTriangle, CheckCircle, Info, Zap, RefreshCw, ChevronDown, ChevronUp,
  Tag, Award, Wallet, UserPlus, RotateCcw, Target, MessageCircle, Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AiInsight {
  category: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical" | "success";
}

interface AiRecommendation {
  type: string;
  target_segment: string;
  title: string;
  description: string;
  details: Record<string, any>;
  priority: "high" | "medium" | "low";
  expected_impact: string;
}

interface UserHighlight {
  user_name: string;
  phone: string;
  reason: string;
  suggested_action: string;
  action_type: string;
}

interface AgentResponse {
  summary: string;
  insights: AiInsight[];
  recommendations: AiRecommendation[];
  user_highlights: UserHighlight[];
  segments: Record<string, number>;
  generated_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const segmentIcons: Record<string, any> = {
  power_users: Zap,
  active_users: TrendingUp,
  declining_users: TrendingDown,
  inactive_users: RotateCcw,
  new_users: UserPlus,
  comeback_users: RotateCcw,
};

const segmentColors: Record<string, string> = {
  power_users: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  active_users: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  declining_users: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  inactive_users: "bg-red-500/10 text-red-600 border-red-500/20",
  new_users: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  comeback_users: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const severityStyles: Record<string, { icon: any; color: string }> = {
  info: { icon: Info, color: "text-blue-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  critical: { icon: AlertTriangle, color: "text-red-500" },
  success: { icon: CheckCircle, color: "text-emerald-500" },
};

const typeIcons: Record<string, any> = {
  coupon: Tag,
  offer: Gift,
  loan: Wallet,
  gift_card: Gift,
  notification: MessageCircle,
  feature_unlock: Zap,
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

export default function AdminAiAgent() {
  const [analysisData, setAnalysisData] = useState<AgentResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("recommendations");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-user-agent", {
        body: { action: "analyze_all" },
      });
      if (error) throw error;
      setAnalysisData(data);
      toast.success("AI analysis complete");
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const runAutoRewards = async () => {
    setAutoApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-user-rewards", { body: {} });
      if (error) throw error;
      toast.success(`Auto-applied ${data.rewards_generated} rewards to ${data.users_analyzed} users`);
    } catch (e: any) {
      toast.error(e.message || "Auto-reward failed");
    } finally {
      setAutoApplying(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: msg, timestamp: new Date().toISOString() },
    ]);
    setChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-user-agent", {
        body: { action: "chat", message: msg },
      });
      if (error) throw error;
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, timestamp: new Date().toISOString() },
      ]);
    } catch (e: any) {
      toast.error(e.message || "Chat failed");
    } finally {
      setChatLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">AI User Agent</h2>
              <p className="text-sm text-white/70">
                Smart monitoring & automated engagement recommendations
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              {showChat ? "Dashboard" : "Chat"}
            </Button>
            <Button
              size="sm"
              onClick={runAutoRewards}
              disabled={autoApplying}
              className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm"
            >
              {autoApplying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Target className="h-3.5 w-3.5 mr-1.5" />
              )}
              {autoApplying ? "Applying…" : "Auto Rewards"}
            </Button>
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={analyzing}
              className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm"
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              {analyzing ? "Analyzing…" : "Run Analysis"}
            </Button>
          </div>
        </div>

        {/* Segment Stats */}
        {analysisData?.segments && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 grid grid-cols-3 md:grid-cols-6 gap-2"
          >
            {Object.entries(analysisData.segments)
              .filter(([k]) => k !== "total_users" && k !== "active_coupons" && k !== "total_loans")
              .map(([key, value]) => {
                const Icon = segmentIcons[key] || Users;
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2.5 text-center"
                  >
                    <Icon className="h-4 w-4 mx-auto mb-1 text-white/80" />
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-[10px] text-white/60 capitalize">
                      {key.replace(/_/g, " ")}
                    </p>
                  </div>
                );
              })}
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showChat ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Chat with AI Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px] px-4">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Bot className="h-12 w-12 text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Ask me about user engagement, campaign ideas, loan eligibility, or risk patterns.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-4 max-w-sm justify-center">
                        {[
                          "Which users need re-engagement?",
                          "Suggest coupon campaign for inactive users",
                          "Who qualifies for loan increase?",
                          "Risk overview this month",
                        ].map((q) => (
                          <button
                            key={q}
                            className="text-xs px-3 py-1.5 rounded-full bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => {
                              setChatInput(q);
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        ) : (
                          m.content
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="mb-3 flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                          <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                          <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </ScrollArea>
                <Separator />
                <div className="flex gap-2 p-3">
                  <Input
                    placeholder="Ask the AI agent…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    className="text-sm"
                  />
                  <Button size="icon" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {!analysisData && !analyzing && (
              <Card className="border-dashed border-2 border-primary/20">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    AI-Powered User Intelligence
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-5">
                    Analyze user behavior patterns, identify engagement opportunities, and get
                    smart recommendations for coupons, offers, loans, and gift cards.
                  </p>
                  <Button onClick={runAnalysis} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Start Analysis
                  </Button>
                </CardContent>
              </Card>
            )}

            {analyzing && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing user data & generating recommendations…
                  </p>
                </CardContent>
              </Card>
            )}

            {analysisData && !analyzing && (
              <>
                {/* Summary */}
                {analysisData.summary && (
                  <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-transparent">
                    <CardContent className="p-4">
                      <p className="text-sm text-foreground leading-relaxed">
                        {analysisData.summary}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Generated {new Date(analysisData.generated_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Insights */}
                {analysisData.insights?.length > 0 && (
                  <Card className="border-0 shadow-sm">
                    <button
                      className="w-full"
                      onClick={() => toggleSection("insights")}
                    >
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Info className="h-4 w-4 text-primary" />
                          Key Insights
                          <Badge variant="secondary" className="text-[9px]">
                            {analysisData.insights.length}
                          </Badge>
                        </CardTitle>
                        {expandedSection === "insights" ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </CardHeader>
                    </button>
                    <AnimatePresence>
                      {expandedSection === "insights" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <CardContent className="pt-0 space-y-2">
                            {analysisData.insights.map((insight, i) => {
                              const style = severityStyles[insight.severity] || severityStyles.info;
                              const SevIcon = style.icon;
                              return (
                                <div
                                  key={i}
                                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/30"
                                >
                                  <SevIcon className={`h-4 w-4 mt-0.5 shrink-0 ${style.color}`} />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                      {insight.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {insight.description}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] shrink-0 ${segmentColors[insight.category] || ""}`}
                                  >
                                    {insight.category?.replace(/_/g, " ")}
                                  </Badge>
                                </div>
                              );
                            })}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                )}

                {/* Recommendations */}
                {analysisData.recommendations?.length > 0 && (
                  <Card className="border-0 shadow-sm">
                    <button
                      className="w-full"
                      onClick={() => toggleSection("recommendations")}
                    >
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Smart Recommendations
                          <Badge variant="secondary" className="text-[9px]">
                            {analysisData.recommendations.length}
                          </Badge>
                        </CardTitle>
                        {expandedSection === "recommendations" ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </CardHeader>
                    </button>
                    <AnimatePresence>
                      {expandedSection === "recommendations" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <CardContent className="pt-0 space-y-3">
                            {analysisData.recommendations.map((rec, i) => {
                              const TypeIcon = typeIcons[rec.type] || Gift;
                              return (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="rounded-xl border border-border/50 p-4 space-y-2 hover:bg-muted/20 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <TypeIcon className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">
                                          {rec.title}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <Badge
                                            variant="outline"
                                            className={`text-[9px] ${priorityColors[rec.priority] || ""}`}
                                          >
                                            {rec.priority}
                                          </Badge>
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] capitalize"
                                          >
                                            {rec.type.replace(/_/g, " ")}
                                          </Badge>
                                          <Badge
                                            variant="outline"
                                            className={`text-[9px] ${segmentColors[rec.target_segment] || ""}`}
                                          >
                                            {rec.target_segment?.replace(/_/g, " ")}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground pl-10">
                                    {rec.description}
                                  </p>
                                  {rec.details && Object.keys(rec.details).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pl-10">
                                      {Object.entries(rec.details).map(([k, v]) => (
                                        <span
                                          key={k}
                                          className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                                        >
                                          {k}: <strong>{String(v)}</strong>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {rec.expected_impact && (
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 pl-10 flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      {rec.expected_impact}
                                    </p>
                                  )}
                                </motion.div>
                              );
                            })}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                )}

                {/* User Highlights */}
                {analysisData.user_highlights?.length > 0 && (
                  <Card className="border-0 shadow-sm">
                    <button
                      className="w-full"
                      onClick={() => toggleSection("highlights")}
                    >
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          User Highlights
                          <Badge variant="secondary" className="text-[9px]">
                            {analysisData.user_highlights.length}
                          </Badge>
                        </CardTitle>
                        {expandedSection === "highlights" ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </CardHeader>
                    </button>
                    <AnimatePresence>
                      {expandedSection === "highlights" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <CardContent className="pt-0 space-y-2">
                            {analysisData.user_highlights.map((uh, i) => {
                              const AIcon = typeIcons[uh.action_type] || Gift;
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                                >
                                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <AIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {uh.user_name}
                                      </p>
                                      {uh.phone && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {uh.phone}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {uh.reason}
                                    </p>
                                    <p className="text-[10px] text-primary mt-0.5">
                                      → {uh.suggested_action}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
