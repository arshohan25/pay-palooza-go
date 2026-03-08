import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, MessageCircle, ArrowLeft, CheckCheck, Check, Zap, ChevronDown, Plus, Trash2, Edit2, Save, X, UserPlus } from "lucide-react";
import { useAgentRouting } from "@/components/admin/SupportAgentRouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  // joined
  user_name?: string;
  user_phone?: string;
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

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AdminSupportDashboard() {
  const { user } = useAuth();
  const { visible, flash } = useRealtimeIndicator();
  const { routing, assignConversation } = useAgentRouting();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
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

    // Merge: DB replies first, then defaults
    const defaultReplies: CannedReply[] = DEFAULT_CANNED_REPLIES.map(r => ({ ...r, isDefault: true }));
    setCannedReplies([...dbReplies, ...defaultReplies]);
  }, [user]);

  useEffect(() => { loadCannedReplies(); }, [loadCannedReplies]);

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

  // Load all open conversations with user info
  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data: convs } = await supabase
      .from("support_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!convs) { setLoading(false); return; }

    // Get user profiles for each conversation
    const userIds = [...new Set(convs.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, phone")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);

    // Get last message per conversation
    const enriched: Conversation[] = await Promise.all(
      convs.map(async (c) => {
        const profile = profileMap.get(c.user_id);
        const { data: lastMsg } = await supabase
          .from("support_messages")
          .select("content, created_at")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);

        // Count unread (messages from user after admin_last_read_at)
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
          user_name: profile?.name || "Unknown",
          user_phone: profile?.phone || "",
          last_message: lastMsg?.[0]?.content || "",
          last_message_at: lastMsg?.[0]?.created_at || c.created_at,
          unread_count: unreadCount,
        };
      })
    );

    setConversations(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime: new conversations or updates
  useEffect(() => {
    const channel = supabase
      .channel("admin-support-convs")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => {
        loadConversations();
        flash();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => {
        loadConversations();
        flash();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

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

    // Mark user messages as read
    await supabase
      .from("support_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conv.id)
      .eq("sender_role", "user")
      .is("read_at", null);

    // Update admin_last_read_at
    await supabase
      .from("support_conversations")
      .update({ admin_last_read_at: new Date().toISOString() })
      .eq("id", conv.id);

    // Update local state
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
        // Auto-read if from user
        if (msg.sender_role === "user") {
          supabase.from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then();
        }
      })
      .subscribe();

    // Typing presence
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

  // Send typing indicator
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

    // Update conversation timestamp
    await supabase
      .from("support_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", selectedConv.id);

    setSending(false);
    inputRef.current?.focus();
  };

  const closeConversation = async (convId: string) => {
    await supabase
      .from("support_conversations")
      .update({ status: "closed" })
      .eq("id", convId);
    setSelectedConv(null);
    loadConversations();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  // Mobile: show either list or chat
  const showChat = !!selectedConv;

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[400px] rounded-2xl border border-border overflow-hidden bg-card" style={{ height: "calc(100dvh - 12rem)" }}>
      {/* Conversation List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col ${showChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MessageCircle size={16} className="text-primary" />
            Support Conversations
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {conversations.filter(c => c.status === "open").length} open
          </p>
          <RealtimeUpdateIndicator visible={visible} />
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <MessageCircle size={32} className="mb-2 opacity-30" />
              <p className="text-xs">No support conversations</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${
                    selectedConv?.id === conv.id ? "bg-primary/5" : ""
                  }`}
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
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-muted-foreground truncate max-w-[70%]">
                          {conv.last_message || "No messages"}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conv.status === "closed" && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0">Closed</Badge>
                          )}
                          {(conv.unread_count ?? 0) > 0 && (
                            <span className="min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{conv.user_phone}</p>
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
                <p className="text-xs font-bold text-foreground">{selectedConv.user_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {remoteTyping ? (
                    <span className="text-primary font-semibold animate-pulse">typing...</span>
                  ) : (
                    selectedConv.user_phone
                  )}
                </p>
              </div>
              {selectedConv.status === "open" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 rounded-lg"
                  onClick={() => closeConversation(selectedConv.id)}
                >
                  Close
                </Button>
              )}
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
                          <p className="text-xs leading-relaxed break-words">{msg.content}</p>
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

              {/* Typing indicator */}
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

            {/* Input */}
            {selectedConv.status === "open" && (
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

                      {/* Add new reply form */}
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
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1">Choose from the list to start responding</p>
          </div>
        )}
      </div>
    </div>
  );
}
