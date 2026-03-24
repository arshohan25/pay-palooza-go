import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, MessageCircle, ArrowLeft, CheckCheck, Check, Zap, ChevronDown, ChevronUp, Plus, Trash2, Edit2, Save, X, UserPlus, Star, RotateCcw, CheckCircle2, Mail, AlertTriangle, Circle } from "lucide-react";
import { useAgentRouting } from "@/components/admin/SupportAgentRouter";
import { playChatNotification, playChatRequestSound } from "@/lib/sounds";
import { haptics } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface Conversation {
  id: string;
  user_id: string;
  status: string;
  subject: string;
  created_at: string;
  updated_at: string;
  admin_last_read_at: string | null;
  user_last_read_at: string | null;
  assigned_agent_id?: string | null;
  rating?: number | null;
  complaint_number?: string | null;
  // joined
  user_name?: string;
  user_phone?: string;
  user_email?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  assigned_agent_name?: string;
}

interface Message {
  id: string;
  content: string;
  sender_role: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
}

const DEFAULT_CANNED_REPLIES = [
  { label: "Greeting", text: "Hello! Thank you for contacting EasyPay Support. How can I help you today?" },
  { label: "Processing", text: "I'm looking into your issue right now. Please give me a moment." },
  { label: "Transaction Issue", text: "I can see your transaction. Let me check the details and get back to you shortly." },
  { label: "Resolved", text: "Your issue has been resolved. Is there anything else I can help you with?" },
  { label: "Escalate", text: "I'm escalating this to our senior team for further investigation. You'll receive an update soon." },
  { label: "PIN Reset", text: "For security, please use the PIN reset option in Settings → Change PIN. Let me know if you need further help." },
  { label: "Balance Query", text: "I've checked your account. Your current balance is reflected in your app. If you see a discrepancy, please share the transaction ID." },
  { label: "Closing", text: "Thank you for reaching out! If you need any further assistance, don't hesitate to contact us. Have a great day!" },
];

interface CannedReply {
  id?: string;
  label: string;
  text: string;
  isDefault?: boolean;
}

type StatusFilter = "all" | "open" | "resolved" | "closed";

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={8} className={i <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"} />
    ))}
  </div>
);

const statusColor = (status: string) => {
  switch (status) {
    case "open": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "resolved": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "closed": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const generateComplaintNumber = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `CMP-${date}-${suffix}`;
};

interface AdminSupportDashboardProps {
  mode?: "live_chat" | "tickets" | "all";
}

export default function AdminSupportDashboard({ mode = "all" }: AdminSupportDashboardProps) {
  const { user } = useAuth();
  const { visible, flash } = useRealtimeIndicator();
  const { routing, assignConversation, autoAssignNewConversation, getAvailableAgents } = useAgentRouting();
  const [onlineAgents, setOnlineAgents] = useState<{ user_id: string; display_name: string; open_count: number }[]>([]);
  const [agentsExpanded, setAgentsExpanded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(mode === "live_chat" ? "open" : "all");
  const [highlightedConvId, setHighlightedConvId] = useState<string | null>(null);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [showAddReply, setShowAddReply] = useState(false);
  const [newReplyLabel, setNewReplyLabel] = useState("");
  const [newReplyText, setNewReplyText] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editText, setEditText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escalation dialog state
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [escalateSubject, setEscalateSubject] = useState("");
  const [escalateDesc, setEscalateDesc] = useState("");
  const [escalatePriority, setEscalatePriority] = useState("medium");
  const [escalating, setEscalating] = useState(false);

  // Load canned replies from DB + defaults
  const loadCannedReplies = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("admin_canned_replies")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    const dbReplies: CannedReply[] = (data ?? []).map(r => ({
      id: r.id,
      label: r.label,
      text: r.content,
    }));

    const defaultReplies: CannedReply[] = DEFAULT_CANNED_REPLIES.map(r => ({ ...r, isDefault: true }));
    setCannedReplies([...dbReplies, ...defaultReplies]);
  }, [user]);

  useEffect(() => { loadCannedReplies(); }, [loadCannedReplies]);

  // Poll online agents every 30s
  const fetchOnlineAgents = useCallback(async () => {
    const agents = await getAvailableAgents();
    setOnlineAgents(agents);
  }, [getAvailableAgents]);

  useEffect(() => {
    fetchOnlineAgents();
    const ch = supabase.channel("online-agents-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => fetchOnlineAgents())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => fetchOnlineAgents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOnlineAgents]);

  const addCannedReply = async () => {
    if (!newReplyLabel.trim() || !newReplyText.trim() || !user) return;
    const { error } = await supabase.from("admin_canned_replies").insert({
      user_id: user.id,
      label: newReplyLabel.trim(),
      content: newReplyText.trim(),
      sort_order: cannedReplies.filter(r => r.id).length,
    });
    if (error) { toast.error("Failed to save template"); return; }
    toast.success("Template saved");
    setNewReplyLabel("");
    setNewReplyText("");
    setShowAddReply(false);
    loadCannedReplies();
  };

  const updateCannedReply = async (id: string) => {
    if (!editLabel.trim() || !editText.trim()) return;
    const { error } = await supabase.from("admin_canned_replies")
      .update({ label: editLabel.trim(), content: editText.trim() })
      .eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Template updated");
    setEditingReplyId(null);
    loadCannedReplies();
  };

  const deleteCannedReply = async (id: string) => {
    const { error } = await supabase.from("admin_canned_replies").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Template deleted");
    loadCannedReplies();
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
  }, []);

  // Load all conversations with user info
  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data: convs } = await supabase
      .from("support_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!convs) { setLoading(false); return; }

    const userIds = [...new Set(convs.map(c => c.user_id))];
    const agentIds = [...new Set(convs.map((c: any) => c.assigned_agent_id).filter(Boolean))];

    const [profilesRes, agentProfilesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, name, phone, email").in("user_id", userIds),
      agentIds.length > 0
        ? supabase.from("team_members").select("user_id, display_name").in("user_id", agentIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) ?? []);
    const agentMap = new Map((agentProfilesRes.data ?? []).map((a: any) => [a.user_id, a.display_name]));

    const enriched: Conversation[] = await Promise.all(
      convs.map(async (c) => {
        const profile = profileMap.get(c.user_id);
        const { data: lastMsg } = await supabase
          .from("support_messages")
          .select("content, created_at")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);

        let unreadCount = 0;
        const { count } = await supabase
          .from("support_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .eq("sender_role", "user")
          .is("read_at", null);
        unreadCount = count ?? 0;

        return {
          ...c,
          assigned_agent_id: (c as any).assigned_agent_id || null,
          rating: (c as any).rating || null,
          complaint_number: (c as any).complaint_number || null,
          user_name: profile?.name || "Unknown",
          user_phone: profile?.phone || "",
          user_email: (profile as any)?.email || "",
          last_message: lastMsg?.[0]?.content || "",
          last_message_at: lastMsg?.[0]?.created_at || c.created_at,
          unread_count: unreadCount,
          assigned_agent_name: (c as any).assigned_agent_id ? agentMap.get((c as any).assigned_agent_id) || null : null,
        };
      })
    );

    setConversations(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime: new conversations or updates — auto-assign unassigned open tickets
  useEffect(() => {
    const channel = supabase
      .channel("admin-support-convs")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, (payload) => {
        // Auto-assign new open tickets without an agent
        if (payload.eventType === "INSERT") {
          const newConv = payload.new as any;
          if (newConv.status === "open" && !newConv.assigned_agent_id) {
            autoAssignNewConversation(newConv.id);
          }
          // Sound + visual alert for new conversation
          playChatRequestSound();
          haptics.notify();
          toast.info("New support conversation received");
          setHighlightedConvId(newConv.id);
          setTimeout(() => setHighlightedConvId(null), 2000);
        }
        loadConversations();
        flash();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const msg = payload.new as any;
        // Only alert for user messages (not admin's own)
        if (msg.sender_role === "user") {
          playChatNotification();
          haptics.notify();
          setHighlightedConvId(msg.conversation_id);
          setTimeout(() => setHighlightedConvId(null), 2000);
        }
        loadConversations();
        flash();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadConversations, autoAssignNewConversation]);

  // Load messages for selected conversation
  const selectConversation = useCallback(async (conv: Conversation) => {
    setSelectedConv(conv);
    setMsgLoading(true);
    setMessages([]);

    const { data: msgs } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    setMessages(msgs ?? []);
    setMsgLoading(false);
    scrollToBottom();

    await supabase
      .from("support_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conv.id)
      .eq("sender_role", "user")
      .is("read_at", null);

    await supabase
      .from("support_conversations")
      .update({ admin_last_read_at: new Date().toISOString() })
      .eq("id", conv.id);

    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
  }, [scrollToBottom]);

  // Realtime messages for selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    const channel = supabase
      .channel(`admin-chat-${selectedConv.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${selectedConv.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
        if (msg.sender_role === "user") {
          supabase.from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then();
        }
      })
      .subscribe();

    const presenceChannel = supabase.channel(`typing-${selectedConv.id}`, {
      config: { presence: { key: user?.id || "admin" } },
    });
    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const others = Object.entries(state).filter(([key]) => key !== user?.id);
      const someoneTyping = others.some(([, presences]) =>
        (presences as any[]).some((p: any) => p.typing && p.role === "user")
      );
      setRemoteTyping(someoneTyping);
    });
    presenceChannel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [selectedConv, user?.id, scrollToBottom]);

  const sendTypingIndicator = useCallback((convId: string) => {
    const ch = supabase.channel(`typing-${convId}`, {
      config: { presence: { key: user?.id || "admin" } },
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ typing: true, role: "admin" });
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(async () => {
          await ch.track({ typing: false, role: "admin" });
        }, 2000);
      }
    });
  }, [user?.id]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedConv || !user || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      content: text,
      sender_role: "admin",
      sender_id: user.id,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();

    const { error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: selectedConv.id,
        sender_id: user.id,
        sender_role: "admin",
        content: text,
      });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(text);
    }

    await supabase
      .from("support_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", selectedConv.id);

    setSending(false);
    inputRef.current?.focus();
  };

  const updateConversationStatus = async (convId: string, newStatus: string) => {
    await supabase
      .from("support_conversations")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", convId);
    
    setSelectedConv(prev => prev ? { ...prev, status: newStatus } : null);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, status: newStatus } : c));
    toast.success(`Ticket ${newStatus}`);
  };

  // Escalate to technical team
  const handleEscalate = async () => {
    if (!selectedConv || !user || !escalateSubject.trim()) return;
    setEscalating(true);

    const complaintNumber = generateComplaintNumber();

    try {
      // Insert complaint record
      const { error: complaintError } = await supabase
        .from("support_complaints" as any)
        .insert({
          complaint_number: complaintNumber,
          conversation_id: selectedConv.id,
          raised_by: user.id,
          subject: escalateSubject.trim(),
          description: escalateDesc.trim(),
          priority: escalatePriority,
          status: "open",
        });

      if (complaintError) throw complaintError;

      // Update conversation with complaint number
      await supabase
        .from("support_conversations")
        .update({ complaint_number: complaintNumber, updated_at: new Date().toISOString() } as any)
        .eq("id", selectedConv.id);

      // Send system message in chat
      await supabase
        .from("support_messages")
        .insert({
          conversation_id: selectedConv.id,
          sender_id: user.id,
          sender_role: "admin",
          content: `⚠️ Complaint ${complaintNumber} has been raised to the technical team.\n\nPriority: ${escalatePriority.toUpperCase()}\nSubject: ${escalateSubject.trim()}\n\nOur technical team will investigate and update you soon.`,
        });

      // Update local state
      setSelectedConv(prev => prev ? { ...prev, complaint_number: complaintNumber } : null);
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, complaint_number: complaintNumber } : c));

      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action: "support_complaint_raised",
        entity_type: "support_complaint",
        entity_id: selectedConv.id,
        details: { complaint_number: complaintNumber, priority: escalatePriority, subject: escalateSubject.trim() },
      });

      toast.success(`Complaint ${complaintNumber} raised successfully`);
      setShowEscalateDialog(false);
      setEscalateSubject("");
      setEscalateDesc("");
      setEscalatePriority("medium");
    } catch (e: any) {
      toast.error(e.message || "Failed to raise complaint");
    } finally {
      setEscalating(false);
    }
  };

  const openEscalateDialog = () => {
    if (selectedConv) {
      setEscalateSubject(selectedConv.subject || "");
      setEscalateDesc("");
      setEscalatePriority("medium");
      setShowEscalateDialog(true);
    }
  };

  // Filter conversations by status and mode
  const filteredConversations = conversations.filter(c => {
    // In live_chat mode, only show open conversations
    if (mode === "live_chat") return c.status === "open";
    if (statusFilter === "all") return true;
    return c.status === statusFilter;
  });

  const statusCounts = {
    all: conversations.length,
    open: conversations.filter(c => c.status === "open").length,
    resolved: conversations.filter(c => c.status === "resolved").length,
    closed: conversations.filter(c => c.status === "closed").length,
  };

  // Can reply if not closed
  const canReply = selectedConv && selectedConv.status !== "closed";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const showChat = !!selectedConv;

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[400px] rounded-2xl border border-border overflow-hidden bg-card" style={{ height: "calc(100dvh - 12rem)" }}>
      {/* Conversation List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col ${showChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MessageCircle size={16} className="text-primary" />
            {mode === "live_chat" ? "Live Chat" : mode === "tickets" ? "Tickets" : "Support Tickets"}
          </h3>
          <RealtimeUpdateIndicator visible={visible} />
          {/* Status filter tabs — hidden in live_chat mode */}
          {mode !== "live_chat" && (
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="mt-2">
            <TabsList className="h-7 w-full grid grid-cols-4 p-0.5">
              <TabsTrigger value="all" className="text-[9px] h-6 px-1 data-[state=active]:text-xs">
                All {statusCounts.all > 0 && <span className="ml-0.5 opacity-60">({statusCounts.all})</span>}
              </TabsTrigger>
              <TabsTrigger value="open" className="text-[9px] h-6 px-1">
                Open {statusCounts.open > 0 && <span className="ml-0.5 opacity-60">({statusCounts.open})</span>}
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-[9px] h-6 px-1">
                Resolved {statusCounts.resolved > 0 && <span className="ml-0.5 opacity-60">({statusCounts.resolved})</span>}
              </TabsTrigger>
              <TabsTrigger value="closed" className="text-[9px] h-6 px-1">
                Closed {statusCounts.closed > 0 && <span className="ml-0.5 opacity-60">({statusCounts.closed})</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          )}
        </div>

        {/* Online Agents Strip */}
        <div className="px-3 py-2 border-b border-border bg-muted/20">
          <button
            onClick={() => setAgentsExpanded(prev => !prev)}
            className="w-full flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              {onlineAgents.length > 0 ? (
                <Circle size={8} className="fill-green-500 text-green-500" />
              ) : (
                <Circle size={8} className="fill-yellow-500 text-yellow-500" />
              )}
              {onlineAgents.length > 0
                ? `${onlineAgents.length} agent${onlineAgents.length > 1 ? "s" : ""} online`
                : "No agents online"}
            </span>
            {agentsExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
          {agentsExpanded && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {onlineAgents.length === 0 ? (
                <span className="text-[10px] text-muted-foreground">No support agents are currently available.</span>
              ) : (
                onlineAgents.map(agent => (
                  <span key={agent.user_id} className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-medium text-foreground">
                    <Circle size={6} className="fill-green-500 text-green-500 shrink-0" />
                    {agent.display_name}
                    <span className="text-muted-foreground">({agent.open_count})</span>
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <MessageCircle size={32} className="mb-2 opacity-30" />
              <p className="text-xs">No {statusFilter !== "all" ? statusFilter : ""} tickets</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-all ${
                    selectedConv?.id === conv.id ? "bg-primary/5" : ""
                  } ${highlightedConvId === conv.id ? "ring-2 ring-primary animate-pulse" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground truncate">{conv.user_name}</p>
                        <span className="text-[9px] text-muted-foreground shrink-0 ml-2">
                          {fmt(conv.last_message_at || conv.created_at)}
                        </span>
                      </div>
                      {/* Subject line */}
                      {conv.subject && conv.subject !== "General Support" && (
                        <p className="text-[10px] font-medium text-foreground/70 truncate mt-0.5">
                          📋 {conv.subject}
                        </p>
                      )}
                      {/* Complaint number badge */}
                      {conv.complaint_number && (
                        <p className="text-[9px] font-semibold text-amber-600 mt-0.5">
                          🔧 {conv.complaint_number}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-muted-foreground truncate max-w-[60%]">
                          {conv.last_message || "No messages"}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={`text-[7px] px-1 py-0 border ${statusColor(conv.status)}`}>
                            {conv.status}
                          </Badge>
                          {(conv.unread_count ?? 0) > 0 && (
                            <span className="min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[9px] text-muted-foreground/60">{conv.user_phone}</p>
                        {conv.user_email && (
                          <span className="text-[8px] text-muted-foreground/50 flex items-center gap-0.5">
                            <Mail size={8} /> {conv.user_email}
                          </span>
                        )}
                        {/* Rating stars for resolved/closed with rating */}
                        {conv.rating && conv.rating > 0 && (
                          <span className="ml-auto">
                            <StarRating rating={conv.rating} />
                          </span>
                        )}
                        {conv.assigned_agent_name && (
                          <Badge variant="outline" className="text-[7px] px-1 py-0 ml-auto">👤 {conv.assigned_agent_name}</Badge>
                        )}
                        {!conv.assigned_agent_id && conv.status === "open" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); assignConversation(conv.id); }}
                            disabled={routing}
                            className="ml-auto text-[8px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            <UserPlus size={10} /> Assign
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Panel */}
      <div className={`flex-1 flex flex-col ${!showChat ? "hidden md:flex" : "flex"}`}>
        {selectedConv ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <button onClick={() => setSelectedConv(null)} className="md:hidden text-muted-foreground">
                <ArrowLeft size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-foreground">{selectedConv.user_name}</p>
                  <Badge variant="outline" className={`text-[7px] px-1 py-0 border ${statusColor(selectedConv.status)}`}>
                    {selectedConv.status}
                  </Badge>
                  {selectedConv.rating && selectedConv.rating > 0 && (
                    <StarRating rating={selectedConv.rating} />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {remoteTyping ? (
                    <span className="text-primary font-semibold animate-pulse">typing...</span>
                  ) : (
                    <>
                      {selectedConv.user_phone}
                      {selectedConv.user_email && (
                        <span className="ml-2 text-muted-foreground/60">
                          <Mail size={8} className="inline mr-0.5" />{selectedConv.user_email}
                        </span>
                      )}
                    </>
                  )}
                </p>
                {selectedConv.subject && selectedConv.subject !== "General Support" && (
                  <p className="text-[9px] text-primary/70 font-medium mt-0.5">📋 {selectedConv.subject}</p>
                )}
                {selectedConv.complaint_number && (
                  <p className="text-[9px] text-amber-600 font-semibold mt-0.5">🔧 {selectedConv.complaint_number}</p>
                )}
              </div>
              {/* Action buttons based on status */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Escalate button — available for open/resolved tickets without a complaint */}
                {(selectedConv.status === "open" || selectedConv.status === "resolved") && !selectedConv.complaint_number && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-7 rounded-lg gap-1 border-amber-500/30 text-amber-600 hover:bg-amber-50"
                    onClick={openEscalateDialog}
                  >
                    <AlertTriangle size={12} /> Escalate
                  </Button>
                )}
                {selectedConv.status === "open" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg gap-1 border-blue-500/30 text-blue-600 hover:bg-blue-50"
                      onClick={() => updateConversationStatus(selectedConv.id, "resolved")}
                    >
                      <CheckCircle2 size={12} /> Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg"
                      onClick={() => updateConversationStatus(selectedConv.id, "closed")}
                    >
                      Close
                    </Button>
                  </>
                )}
                {selectedConv.status === "resolved" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50"
                      onClick={() => updateConversationStatus(selectedConv.id, "open")}
                    >
                      <RotateCcw size={12} /> Reopen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg"
                      onClick={() => updateConversationStatus(selectedConv.id, "closed")}
                    >
                      Close
                    </Button>
                  </>
                )}
                {selectedConv.status === "closed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-7 rounded-lg gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50"
                    onClick={() => updateConversationStatus(selectedConv.id, "open")}
                  >
                    <RotateCcw size={12} /> Reopen
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const isAdmin = msg.sender_role === "admin";
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`flex gap-2 items-end ${isAdmin ? "flex-row-reverse" : ""}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isAdmin ? "bg-primary/15" : "bg-muted"}`}>
                          {isAdmin ? <Bot size={12} className="text-primary" /> : <User size={12} className="text-muted-foreground" />}
                        </div>
                        <div className={`rounded-2xl px-3 py-2 max-w-[70%] ${isAdmin ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/60 text-foreground rounded-bl-md"}`}>
                          <p className="text-xs leading-relaxed break-words whitespace-pre-line">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-0.5 ${isAdmin ? "justify-end" : ""}`}>
                            <p className={`text-[9px] ${isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                              {new Date(msg.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {isAdmin && (
                              msg.read_at ? (
                                <CheckCheck size={10} className="text-primary-foreground/80" />
                              ) : (
                                <Check size={10} className="text-primary-foreground/40" />
                              )
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              {remoteTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 items-end"
                >
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User size={12} className="text-muted-foreground" />
                  </div>
                  <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {messages.length === 0 && !msgLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-xs">No messages in this conversation</p>
                </div>
              )}
            </div>

            {/* Input — show for open & resolved, hide for closed */}
            {canReply && (
              <div className="border-t border-border">
                {/* Canned replies */}
                <div className="px-4 pt-2 pb-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground gap-1 px-2 hover:text-primary">
                        <Zap size={12} />
                        Quick Replies
                        <ChevronDown size={10} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-2" align="start" side="top">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold text-foreground">Quick Reply Templates</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 px-1.5 text-primary"
                          onClick={() => setShowAddReply(!showAddReply)}
                        >
                          {showAddReply ? <X size={10} /> : <Plus size={10} />}
                          {showAddReply ? "Cancel" : "Add"}
                        </Button>
                      </div>

                      {showAddReply && (
                        <div className="mb-2 p-2 bg-muted/40 rounded-lg space-y-1.5">
                          <Input
                            value={newReplyLabel}
                            onChange={e => setNewReplyLabel(e.target.value)}
                            placeholder="Label (e.g. Refund)"
                            className="h-7 text-[10px] rounded-md"
                          />
                          <Input
                            value={newReplyText}
                            onChange={e => setNewReplyText(e.target.value)}
                            placeholder="Reply text..."
                            className="h-7 text-[10px] rounded-md"
                          />
                          <Button
                            size="sm"
                            className="h-6 text-[10px] w-full"
                            onClick={addCannedReply}
                            disabled={!newReplyLabel.trim() || !newReplyText.trim()}
                          >
                            <Save size={10} className="mr-1" /> Save Template
                          </Button>
                        </div>
                      )}

                      <ScrollArea className="max-h-52">
                        <div className="space-y-0.5">
                          {cannedReplies.map((reply, i) => (
                            <div key={reply.id || `default-${i}`} className="group">
                              {editingReplyId === reply.id ? (
                                <div className="p-2 bg-muted/40 rounded-lg space-y-1.5">
                                  <Input
                                    value={editLabel}
                                    onChange={e => setEditLabel(e.target.value)}
                                    className="h-7 text-[10px] rounded-md"
                                  />
                                  <Input
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    className="h-7 text-[10px] rounded-md"
                                  />
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => updateCannedReply(reply.id!)}>
                                      <Save size={10} className="mr-1" /> Save
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingReplyId(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setInput(reply.text);
                                    inputRef.current?.focus();
                                  }}
                                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted/60 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-semibold text-primary/80 group-hover:text-primary">
                                      {reply.label}
                                      {reply.isDefault && <span className="text-muted-foreground/50 font-normal ml-1">(default)</span>}
                                    </p>
                                    {reply.id && (
                                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingReplyId(reply.id!);
                                            setEditLabel(reply.label);
                                            setEditText(reply.text);
                                          }}
                                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                        >
                                          <Edit2 size={10} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteCannedReply(reply.id!);
                                          }}
                                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{reply.text}</p>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      if (selectedConv) sendTypingIndicator(selectedConv.id);
                    }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Reply to user..."
                    className="flex-1 h-10 rounded-xl text-xs"
                    disabled={sending}
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shrink-0"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </Button>
                </div>
              </div>
            )}

            {/* Closed ticket notice */}
            {selectedConv.status === "closed" && (
              <div className="border-t border-border px-4 py-3 text-center">
                <p className="text-[10px] text-muted-foreground">This ticket is closed. Reopen to reply.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1">Choose from the list to start responding</p>
          </div>
        )}
      </div>

      {/* Escalation Dialog */}
      <AlertDialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-amber-500" />
              Escalate to Technical Team
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Raise a complaint for technical investigation. The user will receive a complaint number to track progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subject</Label>
              <Input
                value={escalateSubject}
                onChange={e => setEscalateSubject(e.target.value)}
                placeholder="Complaint subject..."
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={escalateDesc}
                onChange={e => setEscalateDesc(e.target.value)}
                placeholder="Describe the technical issue for the team..."
                rows={3}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority</Label>
              <RadioGroup value={escalatePriority} onValueChange={setEscalatePriority} className="flex gap-3">
                {["low", "medium", "high", "critical"].map(p => (
                  <div key={p} className="flex items-center gap-1.5">
                    <RadioGroupItem value={p} id={`priority-${p}`} />
                    <Label htmlFor={`priority-${p}`} className="text-xs capitalize cursor-pointer">{p}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <Button
              size="sm"
              className="h-8 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!escalateSubject.trim() || escalating}
              onClick={handleEscalate}
            >
              {escalating ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
              Raise Complaint
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
