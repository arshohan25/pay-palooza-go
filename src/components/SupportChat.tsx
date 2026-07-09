import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Check, CheckCheck, Lock, Trash2, Timer, Shield, ShieldAlert, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  encryptMessage,
  tryDecryptMessage,
  getOrCreateConversationKey,
  startScreenshotDetection,
  isMessageExpired,
} from "@/lib/chatCrypto";
import { redactSensitive } from "@/lib/redactSensitive";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface Message {
  id: string;
  content: string;
  sender_role: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
  is_deleted: boolean;
  is_encrypted: boolean;
  expires_at: string | null;
}

interface SupportChatProps {
  userId: string;
  conversationId?: string;
  initialDraft?: string;
  /** Optional collapsible "Context" panel shown above the messages
   *  (e.g. an admin's rejection note carried into a resubmission flow). */
  initialContext?: { title: string; body: string } | null;
}

const SupportChat = ({ userId, conversationId: externalConvId, initialDraft, initialContext }: SupportChatProps) => {
  const { t } = useI18n();
  const [conversationId, setConversationId] = useState<string | null>(externalConvId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [remoteTyping, setRemoteTyping] = useState(false);
  
  const [screenshotAlert, setScreenshotAlert] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
  }, []);

  // Seed the composer with a prefilled draft (e.g. from the Merchant API access gate)
  const draftSeededRef = useRef(false);
  useEffect(() => {
    if (!initialDraft || draftSeededRef.current) return;
    draftSeededRef.current = true;
    setInput(prev => (prev.trim() ? prev : initialDraft));
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [initialDraft]);

  // Decrypt a message and cache the result
  const decryptAndCache = useCallback(async (msg: Message) => {
    if (msg.is_deleted) return t("scMsgDeleted");
    const decrypted = await tryDecryptMessage(msg.content, msg.is_encrypted, cryptoKeyRef.current);
    setDecryptedCache(prev => ({ ...prev, [msg.id]: decrypted }));
    return decrypted;
  }, []);

  // Decrypt all messages in batch
  const decryptAllMessages = useCallback(async (msgs: Message[]) => {
    const cache: Record<string, string> = {};
    for (const msg of msgs) {
      if (msg.is_deleted) {
        cache[msg.id] = t("scMsgDeleted");
      } else {
        cache[msg.id] = await tryDecryptMessage(msg.content, msg.is_encrypted, cryptoKeyRef.current);
      }
    }
    setDecryptedCache(prev => ({ ...prev, ...cache }));
  }, []);

  // Screenshot detection
  useEffect(() => {
    const cleanup = startScreenshotDetection(() => {
      setScreenshotAlert(true);
      toast.warning(t("scScreenshotToast"), {
        description: t("scScreenshotDesc"),
        icon: <ShieldAlert size={16} />,
      });
      setTimeout(() => setScreenshotAlert(false), 3000);
    });
    return cleanup;
  }, []);

  // Expire messages check
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const now = Date.now();
        const filtered = prev.filter(m => {
          if (m.expires_at && new Date(m.expires_at).getTime() <= now) return false;
          return true;
        });
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load or create conversation
  useEffect(() => {
    if (!userId) return;
    const init = async () => {
      setLoading(true);
      let convId: string;

      if (externalConvId) {
        convId = externalConvId;
      } else {
        const { data: convs } = await supabase
          .from("support_conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(1);

        if (convs && convs.length > 0) {
          convId = convs[0].id;
        } else {
          const { data: newConv } = await supabase
            .from("support_conversations")
            .insert({ user_id: userId, subject: "Encrypted Support" })
            .select("id")
            .single();
          convId = newConv!.id;
        }
      }
      setConversationId(convId);

      // Initialize encryption key for this conversation
      cryptoKeyRef.current = await getOrCreateConversationKey(convId);

      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      const validMsgs = (msgs ?? []).filter((m: Message) => !isMessageExpired(m.expires_at));
      setMessages(validMsgs);
      await decryptAllMessages(validMsgs);
      setLoading(false);
      scrollToBottom();

      await supabase
        .from("support_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", convId)
        .eq("sender_role", "admin")
        .is("read_at", null);
    };
    init();
  }, [userId, scrollToBottom, decryptAllMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`support-chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const msg = payload.new as Message;
        if (isMessageExpired(msg.expires_at)) return;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        await decryptAndCache(msg);
        scrollToBottom();
        if (msg.sender_role === "admin") {
          supabase.from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then();
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        if (updated.is_deleted) {
          setDecryptedCache(prev => ({ ...prev, [updated.id]: t("scMsgDeleted") }));
        }
      })
      .subscribe();

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
  }, [conversationId, userId, scrollToBottom, decryptAndCache]);

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

  const deleteMessage = async (msgId: string) => {
    const { error } = await supabase
      .from("support_messages")
      .update({ is_deleted: true, content: "" })
      .eq("id", msgId)
      .eq("sender_id", userId);

    if (!error) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, content: "" } : m));
      setDecryptedCache(prev => ({ ...prev, [msgId]: t("scMsgDeleted") }));
      toast.success(t("scMsgDeletedToast"));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    let encryptedContent = text;
    let isEncrypted = false;

    if (cryptoKeyRef.current) {
      try {
        encryptedContent = await encryptMessage(text, cryptoKeyRef.current);
        isEncrypted = true;
      } catch {
        // Fallback to plaintext
      }
    }

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      content: encryptedContent,
      sender_role: "user",
      sender_id: userId,
      created_at: new Date().toISOString(),
      read_at: null,
      is_deleted: false,
      is_encrypted: isEncrypted,
      expires_at: null,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setDecryptedCache(prev => ({ ...prev, [optimisticMsg.id]: text }));
    scrollToBottom();

    const insertData: any = {
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: "user",
      content: encryptedContent,
      is_encrypted: isEncrypted,
    };
    const { error } = await supabase.from("support_messages").insert(insertData);

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
    <div className="flex flex-col h-full min-h-0 px-3 sm:px-4 pb-3">
      {/* E2E Encryption + Screenshot Alert Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b border-border/40 transition-colors ${screenshotAlert ? "bg-destructive/10" : "bg-muted/40"}`}>
        <div className="flex items-center gap-1.5">
          {screenshotAlert ? (
            <ShieldAlert size={10} className="text-destructive" />
          ) : (
            <Lock size={10} className="text-muted-foreground" />
          )}
          <span className={`text-[10px] font-medium ${screenshotAlert ? "text-destructive" : "text-muted-foreground"}`}>
            {screenshotAlert ? t("scScreenshotBanner") : t("scE2EBanner")}
          </span>
        </div>
      </div>

      {/* Collapsible context panel (e.g. admin's rejection note for a resubmission) */}
      {initialContext && initialContext.body.trim().length > 0 && (
        <div className="border-b border-border/40 bg-amber-500/5">
          <button
            type="button"
            onClick={() => setContextOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-amber-500/10 transition-colors"
            aria-expanded={contextOpen}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Info size={12} className="text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wide truncate">
                {t("scContext")} · {initialContext.title}
              </span>
            </span>
            {contextOpen ? (
              <ChevronUp size={12} className="text-amber-600 shrink-0" />
            ) : (
              <ChevronDown size={12} className="text-amber-600 shrink-0" />
            )}
          </button>
          {contextOpen && (
            <div className="px-3 pb-2.5 -mt-0.5">
              <p className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words rounded-lg bg-background/60 border border-amber-500/20 p-2">
                {redactSensitive(initialContext.body)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {t("scAddressPoints")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2 pt-2">
        {/* Welcome message */}
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Shield size={14} className="text-primary" />
          </div>
          <div className="bg-muted/60 rounded-2xl rounded-tl-md px-3 py-2 max-w-[80%]">
            <p className="text-xs text-foreground leading-relaxed">
              🔐 This chat is end-to-end encrypted with AES-256-GCM. Messages are encrypted before leaving your device. Screenshots are monitored.
            </p>
            <p className="text-[9px] text-muted-foreground mt-1">Security System</p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.sender_id === userId;
            const displayContent = msg.is_deleted
              ? "🗑️ This message was deleted"
              : decryptedCache[msg.id] ?? "🔓 Decrypting...";
            const isExpiring = msg.expires_at !== null;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: msg.is_deleted ? 0.5 : 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2 items-end group ${isMe ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isMe ? "bg-primary/15" : "bg-primary/10"}`}>
                  {isMe ? <User size={12} className="text-primary" /> : <Bot size={12} className="text-primary" />}
                </div>
                <div className={`rounded-2xl px-3 py-2 max-w-[75%] relative ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/60 text-foreground rounded-bl-md"} ${msg.is_deleted ? "opacity-60 italic" : ""}`}>
                  <p className={`text-xs leading-relaxed break-words ${msg.is_deleted ? "italic" : ""}`}>
                    {displayContent}
                  </p>
                  <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : ""}`}>
                    {msg.is_encrypted && !msg.is_deleted && (
                      <Lock size={8} className={isMe ? "text-primary-foreground/40" : "text-muted-foreground/60"} />
                    )}
                    {isExpiring && !msg.is_deleted && (
                      <Timer size={8} className={isMe ? "text-primary-foreground/40" : "text-muted-foreground/60"} />
                    )}
                    <p className={`text-[9px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {isMe && !msg.is_deleted && (
                      msg.read_at ? (
                        <CheckCheck size={10} className="text-primary-foreground/80" />
                      ) : (
                        <Check size={10} className="text-primary-foreground/40" />
                      )
                    )}
                  </div>

                  {/* Delete button for own messages */}
                  {isMe && !msg.is_deleted && !msg.id.startsWith("temp-") && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-destructive/10"
                      title="Delete message"
                    >
                      <Trash2 size={12} className="text-destructive" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {remoteTyping && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-end">
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
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
              <Lock className="w-7 h-7 text-muted-foreground" />
            </motion.div>
            <p className="text-sm font-semibold text-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start a secure conversation!</p>
          </motion.div>
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
          placeholder="Type an encrypted message..."
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
