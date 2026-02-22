import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  content: string;
  sender_role: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
}

interface SupportChatProps {
  userId: string;
}

const SupportChat = ({ userId }: SupportChatProps) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
  }, []);

  // Load or create conversation
  useEffect(() => {
    if (!userId) return;
    const init = async () => {
      setLoading(true);
      const { data: convs } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);

      let convId: string;
      if (convs && convs.length > 0) {
        convId = convs[0].id;
      } else {
        const { data: newConv } = await supabase
          .from("support_conversations")
          .insert({ user_id: userId, subject: "Agent Support" })
          .select("id")
          .single();
        convId = newConv!.id;
      }
      setConversationId(convId);

      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      setMessages(msgs ?? []);
      setLoading(false);
      scrollToBottom();

      // Mark admin messages as read
      await supabase
        .from("support_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", convId)
        .eq("sender_role", "admin")
        .is("read_at", null);
    };
    init();
  }, [userId, scrollToBottom]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`support-chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
        // Auto-read admin messages
        if (msg.sender_role === "admin") {
          supabase.from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then();
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read_at: updated.read_at } : m));
      })
      .subscribe();

    // Typing presence
    const presenceChannel = supabase.channel(`typing-${conversationId}`, {
      config: { presence: { key: userId } },
    });
    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const others = Object.entries(state).filter(([key]) => key !== userId);
      const someoneTyping = others.some(([, presences]) =>
        (presences as any[]).some((p: any) => p.typing && p.role === "admin")
      );
      setRemoteTyping(someoneTyping);
    });
    presenceChannel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [conversationId, userId, scrollToBottom]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (!conversationId) return;
    const ch = supabase.channel(`typing-${conversationId}`, {
      config: { presence: { key: userId } },
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ typing: true, role: "user" });
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(async () => {
          await ch.track({ typing: false, role: "user" });
        }, 2000);
      }
    });
  }, [conversationId, userId]);

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      content: text,
      sender_role: "user",
      sender_id: userId,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    const { error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        sender_role: "user",
        content: text,
      });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setInput(text);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[50vh]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
        {/* Welcome message */}
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={14} className="text-primary" />
          </div>
          <div className="bg-muted/60 rounded-2xl rounded-tl-md px-3 py-2 max-w-[80%]">
            <p className="text-xs text-foreground leading-relaxed">
              👋 Welcome to Agent Support! Send a message and our team will respond shortly. We're here to help with any issues.
            </p>
            <p className="text-[9px] text-muted-foreground mt-1">Support Team</p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.sender_id === userId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2 items-end ${isMe ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isMe ? "bg-primary/15" : "bg-primary/10"}`}>
                  {isMe ? <User size={12} className="text-primary" /> : <Bot size={12} className="text-primary" />}
                </div>
                <div className={`rounded-2xl px-3 py-2 max-w-[75%] ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/60 text-foreground rounded-bl-md"}`}>
                  <p className="text-xs leading-relaxed break-words">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : ""}`}>
                    <p className={`text-[9px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {isMe && (
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

        {/* Typing indicator */}
        {remoteTyping && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 items-end"
          >
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot size={12} className="text-primary" />
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

        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[10px] text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex gap-2 pt-3 border-t border-border/50">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            sendTypingIndicator();
          }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message..."
          className="flex-1 h-10 rounded-xl text-xs"
          disabled={sending}
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="h-10 w-10 rounded-xl gradient-primary text-primary-foreground shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
};

export default SupportChat;
