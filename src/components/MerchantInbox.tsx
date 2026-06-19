import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Search, MessageCircle, Package, User, Clock,
  CheckCheck, Check, Store, ShoppingBag, MoreVertical, Smile,
  ChevronLeft, X, Loader2, Users, Star, Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChat, type ChatConversation, type ChatMessage } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

// ── Helpers ──────────────────────────────────────────────────────────────
const getInitials = (name: string) =>
  name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

const useFormatTime = () => {
  const { t, lang } = useI18n();
  return (ts: number): string => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t("miJustNow");
    if (mins < 60) return t("miMinAgo").replace("{n}", String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("miHourAgo").replace("{n}", String(hours));
    const days = Math.floor(hours / 24);
    if (days === 1) return t("miYesterday");
    return t("miDayAgo").replace("{n}", String(days));
  };
};

const formatMsgTime = (dateStr: string, lang: string) =>
  new Date(dateStr).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", { hour: "2-digit", minute: "2-digit" });

interface CustomerChat {
  id: string;
  conversationId: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  lastMsg: string;
  lastTime: string;
  lastTimestamp: number;
  unread: number;
  productContext?: { name: string; price?: number; emoji?: string };
  isOnline: boolean;
}

interface UIMsg {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  status: "sent" | "delivered" | "read";
  senderId?: string;
  isProduct?: boolean;
  productName?: string;
  productPrice?: number;
  productEmoji?: string;
}

type FilterType = "all" | "unread" | "product";

// ── Main Component ───────────────────────────────────────────────────────
const MerchantInbox = ({ onBack }: { onBack: () => void }) => {
  const { t, lang } = useI18n();
  const formatTime = useFormatTime();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { conversations, loading, loadConversations, openConversation, messages, sendMessage, messagesLoading } = useChat();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build customer chat list from conversations
  // Filter to merchant inquiry conversations only
  const merchantConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const meta = conv.metadata as Record<string, unknown> | null;
      return meta?.context === "merchant_inquiry";
    });
  }, [conversations]);

  const customerChats: CustomerChat[] = useMemo(() => {
    return merchantConversations
      .map((conv) => {
        const others = conv.participants.filter(p => p.user_id !== userId);
        if (others.length === 0) return null;
        const other = others[0];
        const name = other.profile?.name || other.profile?.phone || "Customer";
        const phone = other.profile?.phone ?? "";

        const rawMsg = conv.lastMessage?.decryptedContent || conv.lastMessage?.content || "No messages yet";
        const meta = conv.lastMessage?.metadata as Record<string, unknown> | undefined;
        const hasProduct = meta?.isProductInquiry === true;

        return {
          id: conv.id,
          conversationId: conv.id,
          name,
          phone,
          avatarUrl: other.profile?.avatar_url ?? undefined,
          lastMsg: rawMsg.length > 50 ? rawMsg.slice(0, 50) + "…" : rawMsg,
          lastTime: formatTime(conv.lastMessage ? new Date(conv.lastMessage.created_at).getTime() : new Date(conv.created_at).getTime()),
          lastTimestamp: conv.lastMessage ? new Date(conv.lastMessage.created_at).getTime() : new Date(conv.created_at).getTime(),
          unread: conv.unreadCount,
          productContext: hasProduct ? {
            name: (meta?.productName as string) || "Product",
            price: meta?.productPrice as number | undefined,
            emoji: (meta?.productEmoji as string) || "📦",
          } : undefined,
          isOnline: false,
        } as CustomerChat;
      })
      .filter(Boolean)
      .sort((a, b) => (b as CustomerChat).lastTimestamp - (a as CustomerChat).lastTimestamp) as CustomerChat[];
  }, [merchantConversations, userId]);

  // Filtered chats
  const filteredChats = useMemo(() => {
    let list = customerChats;
    if (filter === "unread") list = list.filter(c => c.unread > 0);
    if (filter === "product") list = list.filter(c => c.productContext);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  }, [customerChats, filter, search]);

  const totalUnread = useMemo(() => customerChats.reduce((s, c) => s + c.unread, 0), [customerChats]);

  // Active chat data
  const activeChatData = useMemo(() => customerChats.find(c => c.conversationId === activeChat), [customerChats, activeChat]);

  // Open a conversation
  const handleOpenChat = useCallback((convId: string) => {
    setActiveChat(convId);
    openConversation(convId);
  }, [openConversation]);

  // Convert messages to UI format
  const uiMessages: UIMsg[] = useMemo(() => {
    return messages.map(msg => {
      const meta = msg.metadata as Record<string, unknown>;
      const isProduct = meta?.isProductInquiry === true;
      const othersReadTimes = conversations
        .find(c => c.id === activeChat)
        ?.participants
        .filter(p => p.user_id !== userId)
        .map(p => p.last_read_at)
        .filter(Boolean) as string[] ?? [];

      let status: UIMsg["status"] = "delivered";
      if (msg.sender_id === userId && othersReadTimes.length > 0) {
        const msgTime = new Date(msg.created_at).getTime();
        status = othersReadTimes.every(r => new Date(r).getTime() >= msgTime) ? "read" : "delivered";
      }

      return {
        id: msg.id,
        text: msg.decryptedContent || msg.content,
        time: formatMsgTime(msg.created_at, lang),
        sent: msg.sender_id === userId,
        status,
        senderId: msg.sender_id,
        isProduct,
        productName: meta?.productName as string | undefined,
        productPrice: meta?.productPrice as number | undefined,
        productEmoji: meta?.productEmoji as string | undefined,
      };
    });
  }, [messages, userId, activeChat, conversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeChat && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 80);
    }
  }, [uiMessages.length, activeChat]);

  // Typing indicator
  const { typingUsers, setTyping } = useTypingIndicator(activeChat, userId, "Merchant");
  const remoteTyping = typingUsers.length > 0;
  const sendTyping = () => setTyping(true);

  // Send handler
  const handleSend = async () => {
    if (!input.trim() || !activeChat || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    await sendMessage(activeChat, text);
    setSending(false);
    inputRef.current?.focus();
  };

  // Quick replies for merchants
  const MERCHANT_QUICK_REPLIES = [t("miQrThanks"), t("miQrPreparing"), t("miQrGetBack"), t("miQrOutOfStock"), t("miQrShipped")];

  // ── Chat Detail View ──────────────────────────────────────────────────
  if (activeChat && activeChatData) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setActiveChat(null)}>
            <ChevronLeft size={18} />
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {activeChatData.avatarUrl ? (
              <img src={activeChatData.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-border/50" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-border/50">
                {getInitials(activeChatData.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{activeChatData.name}</p>
              <div className="flex items-center gap-1.5">
                <User size={10} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{activeChatData.phone || t("miCustomer")}</span>
                {activeChatData.productContext && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[10px] text-primary font-medium">
                      {activeChatData.productContext.emoji} {activeChatData.productContext.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Product context banner */}
        {activeChatData.productContext && (
          <div className="px-4 py-2 bg-primary/5 border-b border-border/30 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">
              {activeChatData.productContext.emoji || "📦"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">
                {t("miInquiry")} {activeChatData.productContext.name}
              </p>
              {activeChatData.productContext.price && (
                <p className="text-[10px] text-primary font-bold">৳{activeChatData.productContext.price}</p>
              )}
            </div>
            <Badge variant="secondary" className="text-[9px]">
              <Package size={10} className="mr-0.5" /> {t("miProductChat")}
            </Badge>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messagesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : uiMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <MessageCircle size={24} className="text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">{t("miNoMessagesYet")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("miStartConversation")}</p>
            </div>
          ) : (
            uiMessages.map((msg) => {
              // Product inquiry bubble
              if (msg.isProduct && !msg.sent) {
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-end max-w-[85%]">
                    <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-3 py-2.5 shadow-sm">
                      {msg.productName && (
                        <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-border/30">
                          <span className="text-sm">{msg.productEmoji || "📦"}</span>
                          <div>
                            <p className="text-[11px] font-bold text-foreground">{msg.productName}</p>
                            {msg.productPrice && <p className="text-[10px] text-primary font-bold">৳{msg.productPrice}</p>}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-foreground leading-relaxed">{msg.text}</p>
                      <p className="text-[9px] text-muted-foreground mt-1">{msg.time}</p>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 items-end ${msg.sent ? "flex-row-reverse" : ""}`}
                >
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                    msg.sent
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-br-md"
                      : "bg-card border border-border/60 text-foreground rounded-bl-md"
                  }`}>
                    <p className="text-xs leading-relaxed break-words">{msg.text}</p>
                    <div className={`flex items-center gap-1 mt-0.5 ${msg.sent ? "justify-end" : ""}`}>
                      <span className={`text-[9px] ${msg.sent ? "text-white/60" : "text-muted-foreground"}`}>{msg.time}</span>
                      {msg.sent && (
                        msg.status === "read"
                          ? <CheckCheck size={10} className="text-white/80" />
                          : <Check size={10} className="text-white/50" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}

          {/* Typing indicator */}
          {remoteTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-end">
              <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-3 py-2.5">
                <div className="flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Quick replies */}
        <div className="px-4 pb-1">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
            {MERCHANT_QUICK_REPLIES.map(r => (
              <button
                key={r}
                onClick={() => setInput(r)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-border/30"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="flex gap-2 px-4 py-3 border-t border-border/50 bg-card/50">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); sendTyping(); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Reply to customer..."
            className="flex-1 h-10 rounded-xl text-xs bg-muted/30 border-border/40"
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shrink-0 shadow-md hover:shadow-lg transition-shadow"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </div>
    );
  }

  // ── Chat List View ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Store size={16} className="text-primary" />
              Customer Messages
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? "s" : ""}` : "All caught up ✓"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="pl-9 h-9 rounded-xl text-xs bg-muted/30 border-border/40"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mt-2.5">
          {([
            { key: "all" as FilterType, label: "All", count: customerChats.length },
            { key: "unread" as FilterType, label: "Unread", count: customerChats.filter(c => c.unread > 0).length },
            { key: "product" as FilterType, label: "Product", count: customerChats.filter(c => c.productContext).length },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                filter === f.key
                  ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label} {f.count > 0 && `(${f.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredChats.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 flex items-center justify-center mb-3">
              <MessageCircle size={28} className="text-primary" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {search ? "No customers found" : filter === "unread" ? "No unread messages" : "No customer chats yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Try a different search" : "Customer inquiries will appear here"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence>
              {filteredChats.map((chat, i) => (
                <motion.button
                  key={chat.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleOpenChat(chat.conversationId)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40 hover:border-primary/20 hover:shadow-card transition-all text-left group"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {chat.avatarUrl ? (
                      <img src={chat.avatarUrl} alt="" className="w-11 h-11 rounded-xl object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/80 to-orange-600/80 flex items-center justify-center text-white text-xs font-bold">
                        {getInitials(chat.name)}
                      </div>
                    )}
                    {chat.unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                        {chat.unread}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-[13px] font-bold truncate ${chat.unread > 0 ? "text-foreground" : "text-foreground/80"}`}>
                        {chat.name}
                      </p>
                      <span className={`text-[9px] shrink-0 ml-2 ${chat.unread > 0 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {chat.lastTime}
                      </span>
                    </div>

                    {/* Product tag */}
                    {chat.productContext && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                          {chat.productContext.emoji} {chat.productContext.name}
                        </Badge>
                      </div>
                    )}

                    <p className={`text-[11px] truncate ${chat.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {chat.lastMsg}
                    </p>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantInbox;
