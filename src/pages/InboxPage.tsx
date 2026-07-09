import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Send, MoreVertical, Plus,
  Smile, CheckCheck, Check, Wallet, CheckCircle2, Package,
  Mic, Play, Pause, X, UserPlus, ImagePlus,
  Download, Loader2,
  Clock, UserCheck, Hourglass, Users, ArrowLeft,
  Shield, UserMinus, Edit3, Info, Lock, Search,
  Pin, PinOff, Copy, Forward, Trash2, MessageSquare,
  Paperclip, Camera, FileText, MapPin,
} from "lucide-react";
import { clearInboxCount } from "@/lib/inboxStore";
import { toast } from "@/components/ui/sonner";
import { useChat, type ChatConversation, type ChatMessage } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useProfile } from "@/hooks/use-profile";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Reaction { emoji: string; count: number; reacted: boolean; }

interface UIMessage {
  id: string; text: string; time: string; sent: boolean;
  status: "sent" | "delivered" | "read"; seenAt?: string;
  type?: "text" | "money" | "order" | "voice" | "image" | "product";
  amount?: number; txnId?: string; orderId?: string;
  orderStatus?: "Pending" | "Shipped" | "Delivered"; itemCount?: number;
  voiceDuration?: number; imageUrl?: string; reactions?: Reaction[];
  senderId?: string;
  productName?: string; productPrice?: number; productImage?: string | null;
  productId?: string; productEmoji?: string;
}

interface UIContact {
  id: string; name: string; phone: string; initials: string; gradient: string;
  lastMsg: string; lastTime: string; lastTimestamp: number; unread: number;
  online: boolean; avatarUrl?: string; pending?: boolean; isGroup?: boolean;
  members?: string[]; groupIcon?: string; adminId?: string; conversationId: string;
  lastSenderId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const QUICK_REPLIES = ["👍", "Thanks!", "OK!", "Send ৳500", "Got it 😊", "Sure!"];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏", "😍", "🎉"];
const GROUP_ICONS = ["💚", "🏠", "🎯", "⚽", "💼", "🎉", "🌟", "🔥", "🎵", "❤️"];

const GRADIENT_OPTIONS = [
  "gradient-send", "gradient-payment", "gradient-cashout",
  "gradient-accent", "gradient-addmoney", "gradient-primary",
];
const pickGradient = (name: string) =>
  GRADIENT_OPTIONS[name.charCodeAt(0) % GRADIENT_OPTIONS.length];

const getInitials = (name: string) =>
  name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

const formatRelativeTime = (ts: number, t: (k: string) => string): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("ipNow");
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return t("ipYesterday");
  return `${days}d`;
};

const getWaveBars = (seed: string) => {
  const n = 28;
  return Array.from({ length: n }, (_, i) => {
    const h = 3 + ((seed.charCodeAt(i % seed.length) * (i + 7)) % 22);
    return h;
  });
};

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Shipped: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

// ── Pinned conversations (localStorage) ───────────────────────────────────────
const PINS_KEY = "easypay_pinned_chats";
const getPinnedIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(PINS_KEY) || "[]"); } catch { return []; }
};
const setPinnedIds = (ids: string[]) => localStorage.setItem(PINS_KEY, JSON.stringify(ids));
const togglePin = (id: string): string[] => {
  const pins = getPinnedIds();
  const next = pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id];
  setPinnedIds(next);
  return next;
};

// ── Convert DB conversation to UI contact ─────────────────────────────────────
function convToUIContact(conv: ChatConversation, userId: string, isOnline: ((uid: string) => boolean) | undefined, t: (k: string) => string): UIContact {
  const otherParticipants = conv.participants.filter((p) => p.user_id !== userId);
  const isGroup = conv.type === "group";

  let name = conv.name ?? "Unknown";
  let phone = "";
  let avatarUrl: string | undefined;
  let otherUserId: string | undefined;

  if (!isGroup && otherParticipants.length > 0) {
    const other = otherParticipants[0];
    name = other.profile?.name || other.profile?.phone || "Unknown";
    phone = other.profile?.phone ?? "";
    avatarUrl = other.profile?.avatar_url ?? undefined;
    otherUserId = other.user_id;
  }

  const rawLastMsg = conv.lastMessage
    ? conv.lastMessage.decryptedContent || conv.lastMessage.content
    : t("ipNoMessagesYet");
  const lastMsg = rawLastMsg?.includes("[Old message]") ? t("ipPreviousMessage") : rawLastMsg;

  const lastTimestamp = conv.lastMessage
    ? new Date(conv.lastMessage.created_at).getTime()
    : new Date(conv.created_at).getTime();

  return {
    id: conv.id,
    conversationId: conv.id,
    name, phone,
    initials: getInitials(name),
    gradient: pickGradient(name),
    lastMsg, lastTime: formatRelativeTime(lastTimestamp, t), lastTimestamp,
    unread: conv.unreadCount,
    online: !isGroup && !!otherUserId && !!isOnline && isOnline(otherUserId),
    avatarUrl,
    pending: conv.status === "pending",
    isGroup,
    groupIcon: conv.group_icon ?? undefined,
    adminId: conv.admin_id === userId ? "self" : conv.admin_id ?? undefined,
    members: otherParticipants.map((p) => p.user_id),
    lastSenderId: conv.lastMessage?.sender_id,
  };
}

// ── Compute per-message read status ───────────────────────────────────────────
function computeMessageStatus(
  msg: ChatMessage, userId: string, othersReadTimes: string[]
): "sent" | "delivered" | "read" {
  if (msg.sender_id !== userId) return "read";
  if (othersReadTimes.length === 0) return "delivered";
  const msgTime = new Date(msg.created_at).getTime();
  const allRead = othersReadTimes.every((readAt) => new Date(readAt).getTime() >= msgTime);
  return allRead ? "read" : "delivered";
}

// ── Convert DB message to UI message ──────────────────────────────────────────
function msgToUIMessage(msg: ChatMessage, userId: string, othersReadTimes?: string[]): UIMessage {
  const meta = msg.metadata as Record<string, unknown>;
  const status = computeMessageStatus(msg, userId, othersReadTimes ?? []);
  const isProduct = meta?.isProductInquiry === true;
  return {
    id: msg.id,
    text: msg.decryptedContent || msg.content,
    time: new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    sent: msg.sender_id === userId,
    status,
    type: isProduct ? "product" : msg.message_type,
    amount: meta?.amount as number | undefined,
    txnId: meta?.txnId as string | undefined,
    orderId: meta?.orderId as string | undefined,
    orderStatus: meta?.orderStatus as UIMessage["orderStatus"],
    itemCount: meta?.itemCount as number | undefined,
    voiceDuration: meta?.voiceDuration as number | undefined,
    imageUrl: meta?.imageUrl as string | undefined,
    reactions: [],
    senderId: msg.sender_id,
    productId: meta?.productId as string | undefined,
    productName: meta?.productName as string | undefined,
    productPrice: meta?.productPrice as number | undefined,
    productImage: meta?.productImage as string | null | undefined,
    productEmoji: meta?.productEmoji as string | undefined,
  };
}

// ── Emoji Picker ──────────────────────────────────────────────────────────────
const EmojiPicker = ({ onPick, onClose, alignRight }: { onPick: (e: string) => void; onClose: () => void; alignRight?: boolean }) => (
  <>
    <div className="fixed inset-0 z-[70]" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`absolute bottom-full mb-2 z-[80] bg-card border border-border rounded-2xl shadow-elevated px-2 py-2 flex gap-1 ${alignRight ? "right-0" : "left-0"}`}
    >
      {REACTION_EMOJIS.map((e) => (
        <motion.button key={e} whileTap={{ scale: 0.8 }} whileHover={{ scale: 1.25, y: -4 }}
          onClick={() => { onPick(e); onClose(); }}
          className="text-xl w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >{e}</motion.button>
      ))}
    </motion.div>
  </>
);

// ── Voice Bubble ──────────────────────────────────────────────────────────────
const VoiceBubble = ({ msg }: { msg: UIMessage }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dur = msg.voiceDuration ?? 5;
  const bars = getWaveBars(msg.id);

  const togglePlay = () => {
    if (playing) {
      clearInterval(timerRef.current!);
      setPlaying(false);
      setProgress(0);
    } else {
      setPlaying(true);
      const step = 100 / (dur * 20);
      timerRef.current = setInterval(() => {
        setProgress((p) => {
          if (p + step >= 100) { clearInterval(timerRef.current!); setPlaying(false); return 0; }
          return p + step;
        });
      }, 50);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  const fillIndex = Math.floor((progress / 100) * bars.length);

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[180px] ${
      msg.sent ? "gradient-primary text-primary-foreground rounded-br-md shadow-glow" : "bg-card border border-border text-foreground rounded-bl-md shadow-card"
    }`}>
      <motion.button whileTap={{ scale: 0.88 }} onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sent ? "bg-white/25" : "bg-primary/10"}`}>
        {playing ? <Pause size={14} className={msg.sent ? "text-white" : "text-primary"} /> : <Play size={14} className={msg.sent ? "text-white" : "text-primary"} />}
      </motion.button>
      <div className="flex items-center gap-[2px] flex-1 h-8">
        {bars.map((h, i) => (
          <div key={i} style={{ height: h }}
            className={`w-[2.5px] rounded-full transition-colors ${
              i < fillIndex ? (msg.sent ? "bg-white" : "bg-primary") : (msg.sent ? "bg-white/40" : "bg-muted-foreground/30")
            }`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-semibold shrink-0 ${msg.sent ? "text-white/80" : "text-muted-foreground"}`}>
        {playing ? `${Math.ceil(dur - (progress / 100) * dur)}s` : `${dur}s`}
      </span>
    </div>
  );
};

// ── Image Bubble ──────────────────────────────────────────────────────────────
const ImageBubble = ({ msg }: { msg: UIMessage }) => {
  const { t } = useI18n();
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = msg.imageUrl!;
    a.download = `chat-image-${msg.id}.jpg`;
    a.target = "_blank";
    a.click();
  };
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-card max-w-[220px] ${msg.sent ? "rounded-br-md" : "rounded-bl-md"}`}>
      <img src={msg.imageUrl} alt={t("ipSharedImage")} className="w-full object-cover" />
      <button onClick={handleDownload}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        title={t("ipDownloadImage")}>
        <Download size={13} />
      </button>
    </div>
  );
};

// ── Read Receipt ──────────────────────────────────────────────────────────────
const ReadReceipt = ({ msg }: { msg: UIMessage }) => {
  if (!msg.sent) return null;
  return (
    <span className="inline-flex items-center">
      {msg.status === "read" ? <CheckCheck size={13} className="text-primary" />
        : msg.status === "delivered" ? <CheckCheck size={13} className="text-muted-foreground" />
        : <Check size={13} className="text-muted-foreground" />}
    </span>
  );
};

// ── Long Press Context Menu ───────────────────────────────────────────────────
interface MessageMenuProps {
  msg: UIMessage;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReact: () => void;
  alignRight: boolean;
}

const MessageMenu = ({ msg, onClose, onCopy, onDelete, onForward, onReact, alignRight }: MessageMenuProps) => {
  const { t } = useI18n();
  return (
  <>
    <div className="fixed inset-0 z-[70]" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`absolute bottom-full mb-1 z-[80] bg-card border border-border rounded-2xl shadow-elevated overflow-hidden min-w-[160px] ${alignRight ? "right-0" : "left-0"}`}
    >
      <button onClick={() => { onReact(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
        <Smile size={15} className="text-muted-foreground" /> React
      </button>
      <button onClick={() => { onCopy(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
        <Copy size={15} className="text-muted-foreground" /> Copy
      </button>
      <button onClick={() => { onForward(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
        <Forward size={15} className="text-muted-foreground" /> Forward
      </button>
      <button onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-destructive hover:bg-destructive/10 transition-colors">
        <Trash2 size={15} /> Delete for me
      </button>
    </motion.div>
  </>
  );
};

// ── Forward Sheet ─────────────────────────────────────────────────────────────
interface ForwardSheetProps {
  contacts: UIContact[];
  onForward: (contactId: string) => void;
  onClose: () => void;
}

const ForwardSheet = ({ contacts, onForward, onClose }: ForwardSheetProps) => {
  const { t } = useI18n();
  return (
  <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed bottom-0 left-0 right-0 z-[80] max-w-md mx-auto bg-card rounded-t-3xl px-5 pt-3 pb-8 shadow-elevated"
      style={{ maxHeight: "70vh", display: "flex", flexDirection: "column" }}
    >
      <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4 shrink-0" />
      <h3 className="text-base font-bold text-foreground mb-3 shrink-0">{t("ipForwardTo")}</h3>
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {contacts.map((c) => (
          <motion.button key={c.id} whileTap={{ scale: 0.98 }}
            onClick={() => { onForward(c.conversationId); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
            <div className={`w-10 h-10 rounded-full ${c.gradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0`}>
              {c.isGroup ? <span className="text-base">{c.groupIcon ?? "👥"}</span>
                : c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" /> : c.initials}
            </div>
            <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  </>
  );
};

// ── Message Bubble ────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: UIMessage; contactName: string;
  onReact: (msgId: string, emoji: string) => void;
  onCopy: (text: string) => void;
  onDelete: (msgId: string) => void;
  onForward: (msgId: string) => void;
  isGroup?: boolean;
}

const MessageBubble = ({ msg, contactName, onReact, onCopy, onDelete, onForward, isGroup }: BubbleProps) => {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMoney = msg.type === "money";
  const isOrder = msg.type === "order";
  const isVoice = msg.type === "voice";
  const isImage = msg.type === "image";
  const isProduct = msg.type === "product";

  const startLongPress = () => { longPressTimer.current = setTimeout(() => setShowMenu(true), 480); };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  const pressHandlers = { onMouseDown: startLongPress, onMouseUp: cancelLongPress, onMouseLeave: cancelLongPress, onTouchStart: startLongPress, onTouchEnd: cancelLongPress };

  const hasReactions = msg.reactions && msg.reactions.length > 0;

  return (
    <div className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col max-w-[80%] ${msg.sent ? "items-end" : "items-start"} relative`}>
        {isGroup && !msg.sent && (
          <span className="text-[10px] font-semibold text-primary mb-0.5 ml-1">{contactName}</span>
        )}

        {isMoney && (
          <div {...pressHandlers} className="rounded-2xl rounded-br-md border border-primary/30 bg-primary/5 shadow-card overflow-hidden min-w-[200px] select-none">
            <div className="gradient-send px-4 py-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary-foreground/90" />
              <span className="text-[12px] font-bold text-primary-foreground">{t("ipMoneySent")}</span>
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-xl font-extrabold text-foreground">৳{(msg.amount ?? 0).toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">To: {contactName}</p>
              <div className="flex items-center justify-between pt-1 border-t border-border mt-1">
                <span className="text-[10px] text-muted-foreground font-mono">{msg.txnId}</span>
                <span className="text-[10px] text-primary font-semibold">{t("ipViewReceipt")}</span>
              </div>
            </div>
          </div>
        )}

        {isOrder && (
          <div {...pressHandlers} className={`rounded-2xl border border-border bg-card shadow-card overflow-hidden min-w-[210px] select-none ${msg.sent ? "rounded-br-md" : "rounded-bl-md"}`}>
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-muted/40">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground leading-tight">{t("ipOrderTracking")}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{msg.orderId}</p>
              </div>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[msg.orderStatus ?? "Pending"]}`}>{msg.orderStatus}</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground"><span className="font-semibold text-foreground">{msg.itemCount}</span> {(msg.itemCount ?? 0) > 1 ? t("ipItemPlural") : t("ipItemSingular")}</p>
                <span className="text-[11px] text-primary font-semibold">{t("ipTrackArrow")}</span>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {["Pending", "Shipped", "Delivered"].map((step, i) => {
                  const statusIndex = ["Pending", "Shipped", "Delivered"].indexOf(msg.orderStatus ?? "Pending");
                  const active = i <= statusIndex;
                  return (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? "bg-primary" : "bg-border"}`} />
                      {i < 2 && <div className={`flex-1 h-0.5 rounded-full ${i < statusIndex ? "bg-primary" : "bg-border"}`} />}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                {([["Pending", t("ipStatusPending")], ["Shipped", t("ipStatusShipped")], ["Delivered", t("ipStatusDelivered")]] as [string,string][]).map(([step, label]) => (
                  <p key={step} className="text-[9px] text-muted-foreground">{label}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {isProduct && (
          <div {...pressHandlers} className={`rounded-2xl border border-border bg-card shadow-card overflow-hidden min-w-[220px] max-w-[260px] select-none ${msg.sent ? "rounded-br-md" : "rounded-bl-md"}`}>
            {msg.productImage ? (
              <div className="h-28 bg-muted/30 overflow-hidden">
                <img src={msg.productImage} alt={msg.productName || "Product"} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-20 bg-muted/30 flex items-center justify-center">
                <span className="text-3xl">{msg.productEmoji || "📦"}</span>
              </div>
            )}
            <div className="px-3.5 py-2.5 space-y-1">
              <p className="text-[12px] font-bold text-foreground leading-tight truncate">{msg.productName || "Product"}</p>
              {msg.productPrice != null && (
                <p className="text-sm font-extrabold text-primary">৳{msg.productPrice.toLocaleString()}</p>
              )}
              <p className="text-[10px] text-muted-foreground">{t("ipProductInquiry")}</p>
            </div>
          </div>
        )}

        {isVoice && <div {...pressHandlers} className="select-none"><VoiceBubble msg={msg} /></div>}
        {isImage && <div {...pressHandlers} className="select-none"><ImageBubble msg={msg} /></div>}

        {!isMoney && !isOrder && !isVoice && !isImage && !isProduct && (
          msg.text?.includes("[Old message]") ? (
            <div className={`flex ${msg.sent ? "justify-end" : "justify-start"} py-0.5`}>
              <span className="text-[10px] italic text-muted-foreground/50 px-3">{t("ipPrevMsgUnavailable")}</span>
            </div>
          ) : (
            <div {...pressHandlers}
              className={`px-4 py-3 rounded-2xl text-sm leading-relaxed font-medium select-none ${
                msg.sent
                  ? "gradient-primary text-primary-foreground rounded-br-md shadow-glow"
                  : "bg-card border border-border text-foreground rounded-bl-md shadow-card"
              }`}
            >
              {msg.text}
            </div>
          )
        )}

        {/* Context menu */}
        <AnimatePresence>
          {showMenu && (
            <MessageMenu
              msg={msg}
              alignRight={msg.sent}
              onClose={() => setShowMenu(false)}
              onCopy={() => onCopy(msg.text)}
              onDelete={() => onDelete(msg.id)}
              onForward={() => onForward(msg.id)}
              onReact={() => setShowPicker(true)}
            />
          )}
        </AnimatePresence>

        {/* Emoji picker */}
        <AnimatePresence>
          {showPicker && (
            <EmojiPicker alignRight={msg.sent} onPick={(emoji) => onReact(msg.id, emoji)} onClose={() => setShowPicker(false)} />
          )}
        </AnimatePresence>

        {hasReactions && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-1 mt-1 flex-wrap">
            {msg.reactions!.map((r) => (
              <motion.button key={r.emoji} whileTap={{ scale: 0.85 }}
                onClick={() => onReact(msg.id, r.emoji)}
                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[12px] border transition-colors ${r.reacted ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-foreground"}`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-[10px] font-semibold">{r.count}</span>}
              </motion.button>
            ))}
          </motion.div>
        )}

        <div className={`flex items-center gap-1 mt-1 ${msg.sent ? "flex-row-reverse" : ""}`}>
          <span className="text-[11px] text-muted-foreground">{msg.time}</span>
          <ReadReceipt msg={msg} />
        </div>
      </div>
    </div>
  );
};

// ── New Contact Sheet ─────────────────────────────────────────────────────────
interface NewContactSheetProps { onClose: () => void; onCreate: (phone: string) => Promise<boolean>; findUser: (phone: string) => Promise<{ user_id: string; name: string | null; phone: string; avatar_url: string | null } | null>; }

const NewContactSheet = ({ onClose, onCreate, findUser }: NewContactSheetProps) => {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const [foundUser, setFoundUser] = useState<{ user_id: string; name: string | null; phone: string; avatar_url: string | null } | null>(null);

  const phoneValid = phone.length === 11 && phone.startsWith("01");

  const handleSearch = async () => {
    if (!phoneValid) { setError(t("ipErrValidPhone")); return; }
    setIsLoading(true); setError("");
    const result = await findUser(phone.trim());
    setIsLoading(false);
    if (!result) { setError(t("ipErrNoAccount")); return; }
    setFoundUser(result);
    setStep("preview");
  };

  const handleSend = async () => {
    if (!foundUser) return;
    setIsLoading(true);
    const success = await onCreate(phone.trim());
    setIsLoading(false);
    if (success) {
      setSent(true);
      setTimeout(() => { onClose(); }, 1800);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-[80] max-w-md mx-auto bg-card rounded-t-3xl px-5 pt-3 pb-8 shadow-elevated">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {step === "preview" && !sent && (
              <button onClick={() => { setStep("input"); setFoundUser(null); setError(""); }}
                className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-lg font-extrabold text-foreground">{t("ipAddByPhone")}</h2>
              <p className="text-xs text-muted-foreground">{step === "input" ? t("ipSearchEasyPayUser") : t("ipSendChatRequest")}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-center mb-6">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="sent" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow">
                  <UserCheck size={34} className="text-primary-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground">{t("ipRequestSentTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("ipTheyReceiveRequest")}</p>
                </div>
              </motion.div>
            ) : step === "preview" && foundUser ? (
              <motion.div key="preview" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3 w-full">
                <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
                  {foundUser.avatar_url
                    ? <img src={foundUser.avatar_url} alt={foundUser.name || "User"} className="w-full h-full object-cover" />
                    : getInitials(foundUser.name || foundUser.phone)}
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground text-base">{foundUser.name || t("ipEasyPayUser")}</p>
                  <p className="text-sm text-muted-foreground">+88 {foundUser.phone}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <UserPlus size={28} className="text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!sent && step === "input" && (
          <>
            <div className="mb-6">
              <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">{t("ipPhoneNumber")}</label>
              <input type="tel" inputMode="numeric" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); setError(""); }}
                placeholder={t("ipPhonePlaceholder")}
                className={`w-full h-12 px-4 bg-background border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${error ? "border-destructive" : "border-border"}`} />
              {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
              {phone.length > 0 && phone.length < 11 && !error && (
                <p className="text-[11px] text-muted-foreground mt-1">{11 - phone.length} {t("ipMoreDigitsNeeded")}</p>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSearch} disabled={isLoading || !phoneValid}
              className="w-full h-13 gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4 disabled:opacity-60">
              {isLoading ? <><Loader2 size={18} className="animate-spin" /> {t("ipSearching")}</> : <><Search size={18} /> {t("ipFindUser")}</>}
            </motion.button>
          </>
        )}
        {!sent && step === "preview" && foundUser && (
          <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }} onClick={handleSend} disabled={isLoading}
            className="w-full h-13 gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4 disabled:opacity-60">
            {isLoading ? <><Loader2 size={18} className="animate-spin" /> {t("ipSendingRequest")}</> : <><UserPlus size={18} /> {t("ipSendChatRequestBtn")}</>}
          </motion.button>
        )}
      </motion.div>
    </>
  );
};

// ── New Group Sheet ───────────────────────────────────────────────────────────
interface NewGroupSheetProps { contacts: UIContact[]; onClose: () => void; onCreate: (name: string, icon: string, memberIds: string[]) => void; }

const NewGroupSheet = ({ contacts, onClose, onCreate }: NewGroupSheetProps) => {
  const { t } = useI18n();
  const [step, setStep] = useState<"pick" | "name">("pick");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupIcon, setGroupIcon] = useState("💚");
  const [error, setError] = useState("");

  const regularContacts = contacts.filter((c) => !c.isGroup);
  const toggleSelect = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  const handleNext = () => { if (selected.length < 2) { setError(t("ipErrSelectTwo")); return; } setError(""); setStep("name"); };
  const handleCreate = () => { if (!groupName.trim()) { setError(t("ipErrGroupNameRequired")); return; } onCreate(groupName.trim(), groupIcon, selected); onClose(); };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-[80] max-w-md mx-auto bg-card rounded-t-3xl px-5 pt-3 pb-8 shadow-elevated"
        style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4 shrink-0" />
        <div className="flex items-center gap-3 mb-5 shrink-0">
          {step === "name" && (
            <button onClick={() => setStep("pick")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-foreground">{step === "pick" ? t("ipNewGroup") : t("ipGroupDetails")}</h2>
            <p className="text-xs text-muted-foreground">{step === "pick" ? `${t("ipSelectMembers")} (${selected.length} ${t("ipSelected")})` : t("ipGroupNameAndIcon")}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
            <X size={18} />
          </button>
        </div>
        {step === "pick" ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-0">
              {regularContacts.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Users className="w-7 h-7 text-muted-foreground" />
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">No contacts available</p>
                  <p className="text-xs text-muted-foreground mt-1">Add contacts to get started</p>
                </motion.div>
              )}
              {regularContacts.map((c) => {
                const isSelected = selected.includes(c.id);
                return (
                  <motion.button key={c.id} whileTap={{ scale: 0.98 }} onClick={() => toggleSelect(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${isSelected ? "bg-primary/10 border-primary/40" : "bg-background border-border hover:bg-muted/50"}`}>
                    <div className={`w-11 h-11 rounded-2xl ${c.gradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0`}>
                      {c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" /> : c.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.phone}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                      {isSelected && <Check size={11} className="text-primary-foreground" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
            {error && <p className="text-[11px] text-destructive text-center mb-2">{error}</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleNext}
              className="w-full h-13 gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4 shrink-0">
              {t("ipNext")} <ArrowLeft size={16} className="rotate-180" />
            </motion.button>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="flex justify-center mb-5">
                <div className="flex gap-2 flex-wrap justify-center">
                  {GROUP_ICONS.map((icon) => (
                    <motion.button key={icon} whileTap={{ scale: 0.85 }} onClick={() => setGroupIcon(icon)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl border-2 transition-all ${groupIcon === icon ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card"}`}>
                      {icon}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">{t("ipGroupNameLabel")}</label>
                <input type="text" value={groupName} onChange={(e) => { setGroupName(e.target.value); setError(""); }}
                  placeholder={t("ipGroupNamePlaceholder")}
                  className={`w-full h-12 px-4 bg-background border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${error ? "border-destructive" : "border-border"}`} />
                {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
              </div>
              <div className="mb-4">
                <p className="text-[12px] font-semibold text-muted-foreground mb-2">{t("ipMembersLabel")} ({selected.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selected.map((id) => {
                    const c = regularContacts.find((rc) => rc.id === id);
                    return c ? (
                      <span key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[12px] font-semibold">
                        {c.name}
                        <button onClick={() => toggleSelect(id)} className="hover:text-destructive"><X size={12} /></button>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate}
              className="w-full h-13 gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4 shrink-0">
              <Users size={18} /> {t("ipCreateGroup")}
            </motion.button>
          </>
        )}
      </motion.div>
    </>
  );
};

// ── Chat View ─────────────────────────────────────────────────────────────────
interface ChatViewProps {
  contact: UIContact; messages: UIMessage[];
  onBack: () => void; onSend: (text: string) => void;
  onSendVoice: (dur: number) => void; onSendImage: (url: string) => void;
  onReact: (msgId: string, emoji: string) => void;
  onCopy: (text: string) => void;
  onDelete: (msgId: string) => void;
  onForward: (msgId: string) => void;
  conversationId: string | null;
  userId: string | null; userName: string;
  isPending?: boolean; isInitiator?: boolean;
  onAccept?: () => void; onDecline?: () => void;
  onBlockReport?: (reason?: string) => void;
  onSendMoney: (phone: string) => void;
}

const ChatView = ({
  contact, messages, onBack, onSend, onSendVoice, onSendImage,
  onReact, onCopy, onDelete, onForward,
  conversationId, userId, userName,
  isPending, isInitiator, onAccept, onDecline, onBlockReport, onSendMoney,
}: ChatViewProps) => {
  const [text, setText] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const micPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showChatMenu, setShowChatMenu] = useState(false);

  const { typingUsers, setTyping } = useTypingIndicator(conversationId, userId, userName);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    setTyping(false);
  };

  const startMicPress = () => {
    micPressTimer.current = setTimeout(() => {
      setRecording(true);
      setRecordSeconds(0);
      recordTimer.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    }, 300);
  };

  const endMicPress = () => {
    if (micPressTimer.current) clearTimeout(micPressTimer.current);
    if (recording) {
      clearInterval(recordTimer.current!);
      const dur = Math.max(1, recordSeconds);
      setRecording(false); setRecordSeconds(0);
      onSendVoice(dur);
    }
  };

  useEffect(() => () => { clearInterval(recordTimer.current!); clearTimeout(micPressTimer.current!); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!userId || !conversationId) {
      toast.error(t("ipCannotUpload"));
      e.target.value = "";
      return;
    }
    // Path convention: <user_id>/<conversation_id>/<filename> — required by storage RLS
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from('chat_attachments')
      .upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(t("ipFailedUpload"));
      e.target.value = "";
      return;
    }
    // Bucket is private — issue a long-lived signed URL for chat display
    const { data: signed, error: signErr } = await supabase.storage
      .from('chat_attachments')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) {
      toast.error(t("ipFailedPrepare"));
      e.target.value = "";
      return;
    }
    onSendImage(signed.signedUrl);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header — frosted glass style */}
      <motion.div
        initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 pt-[env(safe-area-inset-top,12px)] pb-3 shrink-0"
      >
        <div className="flex items-center gap-3 pt-2">
          <button onClick={onBack}
            className="w-9 h-9 rounded-full bg-muted/80 flex items-center justify-center active:scale-95 transition-transform shrink-0 text-foreground">
            <ChevronLeft size={20} />
          </button>
          <div className="relative shrink-0">
            <div className={`w-10 h-10 rounded-full ${contact.gradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden`}>
              {contact.isGroup ? <span className="text-base">{contact.groupIcon ?? "👥"}</span>
                : contact.avatarUrl ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" /> : contact.initials}
            </div>
            {!contact.isGroup && (
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${contact.online ? "bg-green-500" : "bg-muted-foreground/40"}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight text-foreground truncate">{contact.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {contact.isGroup ? `${(contact.members?.length ?? 0) + 1} members`
                : contact.online ? t("ipOnline") : contact.phone}
            </p>
          </div>
          <div className="flex items-center gap-1 relative">
            <button onClick={() => setShowChatMenu((v) => !v)} className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform text-foreground">
              {contact.isGroup ? <Info size={14} /> : <MoreVertical size={14} />}
            </button>
            {/* Chat menu dropdown */}
            <AnimatePresence>
              {showChatMenu && (
                <>
                  <div className="fixed inset-0 z-[70]" onClick={() => setShowChatMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute right-3 top-full mt-1 z-[80] bg-card border border-border rounded-2xl shadow-elevated overflow-hidden min-w-[180px]"
                  >
                    {!contact.isGroup && (
                      <>
                        <button onClick={() => { setShowChatMenu(false); toast.info(t("ipNotificationsMutedChat")); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
                          <Edit3 size={15} className="text-muted-foreground" /> {t("ipMuteNotifications")}
                        </button>
                        <button onClick={() => { setShowChatMenu(false); toast.success(t("ipChatCleared")); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
                          <Trash2 size={15} className="text-muted-foreground" /> Clear Chat
                        </button>
                        <div className="h-px bg-border/40 mx-3" />
                        <button onClick={() => { setShowChatMenu(false); setShowBlockDialog(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-destructive hover:bg-destructive/10 transition-colors">
                          <UserMinus size={15} /> {t("ipBlockUser")}
                        </button>
                        <button onClick={() => { setShowChatMenu(false); setShowBlockDialog(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-destructive hover:bg-destructive/10 transition-colors">
                          <Shield size={15} /> {t("ipReportUser")}
                        </button>
                      </>
                    )}
                    {contact.isGroup && (
                      <>
                        <button onClick={() => { setShowChatMenu(false); toast.info(t("ipGroupInfoToast")); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
                          <Info size={15} className="text-muted-foreground" /> {t("ipGroupInfo")}
                        </button>
                        <button onClick={() => { setShowChatMenu(false); toast.info(t("ipAddMemberSoon")); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
                          <UserPlus size={15} className="text-muted-foreground" /> {t("ipAddMember")}
                        </button>
                        <button onClick={() => { setShowChatMenu(false); toast.info(t("ipNotificationsMuted")); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
                          <Edit3 size={15} className="text-muted-foreground" /> {t("ipMuteNotifications")}
                        </button>
                        <div className="h-px bg-border/40 mx-3" />
                        <button onClick={() => { setShowChatMenu(false); toast(t("ipLeftGroup")); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-destructive hover:bg-destructive/10 transition-colors">
                          <X size={15} /> {t("ipLeaveGroup")}
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-none">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
            <Lock size={24} className="opacity-30" />
            <p className="text-sm font-medium">{t("ipStartConversation")}</p>
            <p className="text-xs">{t("ipEncrypted")}</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={msg.id}>
            {idx === 0 && <p className="text-center text-[10px] text-muted-foreground mb-2 font-medium">{t("ipToday")}</p>}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: idx * 0.03 }}
            >
              <MessageBubble msg={msg} contactName={contact.name}
                onReact={onReact} onCopy={onCopy} onDelete={onDelete} onForward={onForward} isGroup={contact.isGroup} />
            </motion.div>
          </div>
        ))}
        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="flex items-start gap-2 pl-1">
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-card flex items-center gap-2">
                <div className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-[6px] h-[6px] rounded-full bg-muted-foreground/60"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {typingUsers.length === 1 ? `${typingUsers[0]} ${t("ipIsTyping")}` : `${typingUsers.length} ${t("ipPeopleTyping")}`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <AnimatePresence>
        {showQuick && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-3 pb-1 overflow-hidden">
            <div className="flex gap-2 flex-wrap">
              {QUICK_REPLIES.map((r) => (
                <button key={r} onClick={() => { onSend(r); setShowQuick(false); }}
                  className="px-3 py-1.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors">
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment menu */}
      <AnimatePresence>
        {showAttach && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-1 overflow-hidden">
            <div className="flex gap-3 py-2">
              {[
                { icon: Camera, label: t("ipCamera"), color: "bg-blue-500", action: () => fileInputRef.current?.click() },
                { icon: ImagePlus, label: t("ipGallery"), color: "bg-purple-500", action: () => fileInputRef.current?.click() },
                { icon: FileText, label: t("ipDocument"), color: "bg-amber-500", action: () => toast.info("Coming soon") },
                { icon: MapPin, label: t("ipLocation"), color: "bg-green-500", action: () => toast.info("Coming soon") },
              ].map((item) => (
                <button key={item.label} onClick={() => { item.action(); setShowAttach(false); }}
                  className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-11 h-11 ${item.color} rounded-full flex items-center justify-center text-white`}>
                    <item.icon size={18} />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar or Accept/Decline bar */}
      {isPending && !isInitiator ? (
        <div className="px-3 pb-[env(safe-area-inset-bottom,12px)] pt-2 border-t border-border/40 bg-background shrink-0">
          {messages.length > 0 && (
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-muted/60 border border-border/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield size={12} className="text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t("ipMessagePreview")}</span>
              </div>
              <p className="text-xs text-foreground/80 line-clamp-3 italic">"{messages[0]?.text || "..."}"</p>
            </div>
          )}
          <div className="flex items-center gap-2 mb-2 px-1">
            <Shield size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{t("ipChatRequestInfo")}</p>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowBlockDialog(true)}
              className="h-11 px-3 rounded-2xl border-2 border-destructive/30 bg-destructive/10 text-destructive font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors hover:bg-destructive/20">
              <Lock size={13} /> {t("ipBlock")}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={onDecline}
              className="flex-1 h-11 rounded-2xl border-2 border-border bg-card text-foreground font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-muted">
              <X size={16} /> {t("ipDecline")}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={onAccept}
              className="flex-1 h-11 rounded-2xl gradient-primary text-primary-foreground font-bold text-sm shadow-glow flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> {t("ipAccept")}
            </motion.button>
          </div>

          {/* Block & Report Dialog */}
          <AnimatePresence>
            {showBlockDialog && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
                onClick={() => setShowBlockDialog(false)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-3xl p-5 w-full max-w-sm shadow-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                      <Shield size={18} className="text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{t("ipBlockReport")}</h3>
                      <p className="text-[11px] text-muted-foreground">{t("ipReportedToAdmins")}</p>
                    </div>
                  </div>
                  <textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder={t("ipReasonOptional")}
                    className="w-full h-20 p-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-destructive/30 mb-3" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowBlockDialog(false); setBlockReason(""); }}
                      className="flex-1 h-11 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={() => { onBlockReport?.(blockReason || undefined); setShowBlockDialog(false); setBlockReason(""); }}
                      className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:bg-destructive/90 transition-colors">Block & Report</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="px-4 pb-[max(10px,env(safe-area-inset-bottom,10px))] pt-2 border-t border-border/40 bg-background shrink-0">
          <AnimatePresence>
            {recording && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="flex items-center gap-2 mb-1.5 px-3">
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                  className="w-2.5 h-2.5 rounded-full bg-destructive" />
                <span className="text-sm text-destructive font-semibold">{t("ipRecording")} {recordSeconds}s</span>
                <span className="text-xs text-muted-foreground ml-auto">{t("ipReleaseToSend")}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-card">
            <button onClick={() => { setShowAttach(!showAttach); setShowQuick(false); }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showAttach ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Paperclip size={17} />
            </button>
            <button onClick={() => { setShowQuick(!showQuick); setShowAttach(false); }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showQuick ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Smile size={17} />
            </button>
            <input type="text" placeholder={recording ? t("ipRecording") : t("ipMessagePlaceholder")} value={text}
              onChange={(e) => { setText(e.target.value); setTyping(true); }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()} disabled={recording}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0 disabled:opacity-50" />
            {!contact.isGroup && (
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => onSendMoney(contact.phone)}
                className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0" title={`${t("ipSendMoneyTo")} ${contact.name}`}>
                <Wallet size={15} />
              </motion.button>
            )}
            {text.trim() ? (
              <motion.button whileTap={{ scale: 0.88 }} onClick={handleSend}
                className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shadow-glow transition-all">
                <Send size={17} />
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.88 }}
                onMouseDown={startMicPress} onMouseUp={endMicPress} onMouseLeave={endMicPress}
                onTouchStart={startMicPress} onTouchEnd={endMicPress}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all select-none ${recording ? "gradient-send text-primary-foreground shadow-glow scale-110" : "bg-primary/10 text-primary"}`}>
                <Mic size={17} />
              </motion.button>
            )}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Block & Report Dialog (for accepted chats) */}
      <AnimatePresence>
        {showBlockDialog && !isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowBlockDialog(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-3xl p-5 w-full max-w-sm shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <Shield size={18} className="text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Block & Report</h3>
                  <p className="text-[11px] text-muted-foreground">This user will be blocked and reported</p>
                </div>
              </div>
              <textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder={t("ipReasonOptional")}
                className="w-full h-20 p-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-destructive/30 mb-3" />
              <div className="flex gap-2">
                <button onClick={() => { setShowBlockDialog(false); setBlockReason(""); }}
                  className="flex-1 h-11 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted transition-colors">{t("ipCancel")}</button>
                <button onClick={() => { onBlockReport?.(blockReason || undefined); setShowBlockDialog(false); setBlockReason(""); }}
                  className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:bg-destructive/90 transition-colors">{t("ipBlockReport")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── InboxPage ─────────────────────────────────────────────────────────────────
interface InboxPageProps {
  onBack?: () => void;
  onSendMoney?: (phone: string, onComplete?: (amount: number) => void) => void;
  isActive?: boolean;
}

type FilterTab = "all" | "unread" | "groups" | "requests";

export default function InboxPage({ onBack, onSendMoney, isActive = false }: InboxPageProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const profileData = useProfile();
  const chat = useChat();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOnline, onlineUsers } = useOnlinePresence(user?.id ?? null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [pinnedIds, setPinnedIdsState] = useState<string[]>(getPinnedIds);
  const [forwardMsgId, setForwardMsgId] = useState<string | null>(null);

  // Reactions (client-side only)
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  useEffect(() => { clearInboxCount(); }, []);

  // Deep-link: open conversation from ?conv= query param
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    const convParam = searchParams.get("conv");
    if (convParam && !deepLinkHandled.current && chat.conversations.length > 0) {
      deepLinkHandled.current = true;
      const exists = chat.conversations.find((c) => c.id === convParam);
      if (exists) {
        setActiveContactId(convParam);
        chat.openConversation(convParam);
      }
      // Clean up the URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, chat.conversations, chat.openConversation, setSearchParams]);

  // Convert DB conversations to UI contacts — exclude merchant inquiry conversations
  const personalConversations = chat.conversations.filter((conv) => {
    const meta = conv.metadata as Record<string, unknown> | null;
    return !meta || meta.context !== "merchant_inquiry";
  });
  const uiContacts: UIContact[] = personalConversations.map((conv) =>
    convToUIContact(conv, user?.id ?? "", isOnline, t)
  );

  // Convert DB messages to UI messages with read receipt status
  const othersReadTimes: string[] = (() => {
    if (!chat.activeConversationId || !user) return [];
    const convReadMap = chat.participantReadTimes.get(chat.activeConversationId);
    if (!convReadMap) return [];
    const times: string[] = [];
    convReadMap.forEach((readAt, uid) => { if (uid !== user.id) times.push(readAt); });
    return times;
  })();

  const uiMessages: UIMessage[] = chat.messages
    .filter((msg) => !msg.is_deleted)
    .map((msg) => {
      const uiMsg = msgToUIMessage(msg, user?.id ?? "", othersReadTimes);
      uiMsg.reactions = reactions[msg.id] ?? [];
      return uiMsg;
    });

  const activeContact = activeContactId
    ? uiContacts.find((c) => c.id === activeContactId) ?? null
    : null;

  // Filter & sort: pinned first, then by filter tab, then search
  const filtered = useMemo(() => {
    let list = uiContacts;
    // Apply filter tab
    if (filterTab === "unread") list = list.filter((c) => c.unread > 0);
    else if (filterTab === "groups") list = list.filter((c) => c.isGroup);
    else if (filterTab === "requests") list = list.filter((c) => c.pending);
    else list = list.filter((c) => !c.pending); // "all" hides pending

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.lastMsg.toLowerCase().includes(q)
      );
    }

    // Sort: pinned first, then by timestamp
    const pins = new Set(pinnedIds);
    return [...list].sort((a, b) => {
      const aPin = pins.has(a.id) ? 1 : 0;
      const bPin = pins.has(b.id) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return b.lastTimestamp - a.lastTimestamp;
    });
  }, [uiContacts, filterTab, search, pinnedIds]);

  // Online users for stories-style bar
  const onlineContacts = useMemo(() =>
    uiContacts.filter((c) => c.online && !c.isGroup), [uiContacts]);


  const handleReact = useCallback((msgId: string, emoji: string) => {
    setReactions((prev) => {
      const existing = prev[msgId] ?? [];
      const found = existing.find((r) => r.emoji === emoji);
      if (found) {
        if (found.reacted) {
          const updated = { ...found, count: found.count - 1, reacted: false };
          const filtered = updated.count === 0 ? existing.filter((r) => r.emoji !== emoji) : existing.map((r) => r.emoji === emoji ? updated : r);
          return { ...prev, [msgId]: filtered };
        }
        return { ...prev, [msgId]: existing.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r) };
      }
      return { ...prev, [msgId]: [...existing, { emoji, count: 1, reacted: true }] };
    });
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!activeContactId) return;
    await chat.sendMessage(activeContactId, text, "text");
  }, [activeContactId, chat]);

  const handleSendVoice = useCallback(async (duration: number) => {
    if (!activeContactId) return;
    await chat.sendMessage(activeContactId, `🎤 Voice (${duration}s)`, "voice", { voiceDuration: duration });
  }, [activeContactId, chat]);

  const handleSendImage = useCallback(async (url: string) => {
    if (!activeContactId) return;
    await chat.sendMessage(activeContactId, "📷 Photo", "image", { imageUrl: url });
  }, [activeContactId, chat]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("ipCopiedToClipboard"));
  }, []);

  const handleDeleteMessage = useCallback(async (msgId: string) => {
    const { error } = await supabase
      .from("chat_messages")
      .update({ is_deleted: true })
      .eq("id", msgId);
    if (error) toast.error(t("ipFailedDelete"));
    else toast.success(t("ipMessageDeleted"));
  }, []);

  const handleForwardMessage = useCallback(async (targetConvId: string) => {
    if (!forwardMsgId) return;
    const msg = chat.messages.find((m) => m.id === forwardMsgId);
    if (!msg) return;
    const text = msg.decryptedContent || msg.content;
    await chat.sendMessage(targetConvId, `↗️ ${text}`, "text");
    toast.success(t("ipMessageForwarded"));
    setForwardMsgId(null);
  }, [forwardMsgId, chat]);

  const handleTogglePin = useCallback((id: string) => {
    const next = togglePin(id);
    setPinnedIdsState(next);
    toast.success(next.includes(id) ? t("ipConvPinned") : t("ipConvUnpinned"));
  }, []);

  const handleCreateContact = async (phone: string): Promise<boolean> => {
    if (!user) return false;
    const found = await chat.findUserByPhone(phone);
    if (!found) { toast.error(t("ipUserNotFound"), { description: t("ipNoAccountPhone") }); return false; }
    if (found.user_id === user.id) { toast.error(t("ipOwnNumber")); return false; }
    const convId = await chat.createDirectConversation(found.user_id);
    if (convId) {
      toast.success(t("ipConvStarted"), { description: `${t("ipCanNowChat")} ${found.name || phone}` });
      setActiveContactId(convId); chat.openConversation(convId);
      return true;
    }
    return false;
  };

  const handleCreateGroup = async (name: string, icon: string, memberConvIds: string[]) => {
    if (!user) return;
    const memberUserIds: string[] = [];
    for (const convId of memberConvIds) {
      const conv = chat.conversations.find((c) => c.id === convId);
      if (conv) {
        const otherParticipant = conv.participants.find((p) => p.user_id !== user.id);
        if (otherParticipant) memberUserIds.push(otherParticipant.user_id);
      }
    }
    const convId = await chat.createGroupConversation(name, icon, memberUserIds);
    if (convId) {
      toast.success(t("ipGroupCreated"));
      setActiveContactId(convId); chat.openConversation(convId);
    }
  };

  const openChat = (contact: UIContact) => {
    setActiveContactId(contact.conversationId);
    chat.openConversation(contact.conversationId);
  };


  const totalUnread = chat.totalUnread;
  const pendingCount = useMemo(() => uiContacts.filter((c) => c.pending).length, [uiContacts]);
  const tabCounts = useMemo(() => ({
    all: uiContacts.filter((c) => !c.pending).length,
    unread: uiContacts.filter((c) => c.unread > 0).length,
    groups: uiContacts.filter((c) => c.isGroup).length,
    requests: pendingCount,
  }), [uiContacts, pendingCount]);


  return (
    <>
      {/* ── Modern Header ── */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/30">
        <div className="flex items-center gap-3.5">
          {profileData?.avatar_url ? (
            <img src={profileData.avatar_url} alt="Me" className="w-10 h-10 rounded-full object-cover border-2 border-primary/20" />
          ) : (
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {getInitials(profileData?.name || "U")}
            </div>
          )}
          <div>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">{t("ipMessagesHeading")}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalUnread > 0 ? `${totalUnread} ${t("ipUnreadCount")}` : t("ipAllCaughtUp")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowNewGroup(true)}
            className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Users size={17} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowNewContact(true)}
            className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-primary-foreground shadow-glow">
            <Plus size={17} />
          </motion.button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder={t("ipSearchMessages")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 100)}
          className="w-full pl-10 pr-16 h-10 bg-muted/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition border-0"
        />
        {searchFocused && (
          <button onClick={() => { setSearch(""); setSearchFocused(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary px-2 py-1">
            {t("ipCancelSearch")}
          </button>
        )}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 mb-3">
        {(["all", "unread", "groups", "requests"] as FilterTab[]).map((tab) => (
          <button key={tab} onClick={() => setFilterTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all relative ${
              filterTab === tab
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}>
            {tab === "all" ? t("ipTabAll") : tab === "unread" ? `${t("ipTabUnread")}${tabCounts.unread > 0 ? ` (${tabCounts.unread})` : ""}` : tab === "groups" ? t("ipTabGroups") : t("ipTabRequests")}
            {tab === "requests" && tabCounts.requests > 0 && filterTab !== "requests" && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                {tabCounts.requests}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Online Users Stories Bar ── */}
      {onlineContacts.length > 0 && filterTab !== "groups" && (
        <div className="mb-3 -mx-1 overflow-x-auto scrollbar-none">
          <div className="flex gap-3 px-1 py-1">
            {onlineContacts.map((c) => (
              <motion.button key={c.id} whileTap={{ scale: 0.92 }} onClick={() => openChat(c)}
                className="flex flex-col items-center gap-1 shrink-0 w-14">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full p-[2.5px] bg-gradient-to-tr from-green-400 to-green-600 shadow-md">
                    <div className={`w-full h-full rounded-full ${c.gradient} flex items-center justify-center text-white font-bold text-xs overflow-hidden border-2 border-background`}>
                      {c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" /> : c.initials}
                    </div>
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                </div>
                <span className="text-[10px] text-foreground font-medium truncate w-full text-center">{c.name.split(" ")[0]}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ── Conversation List ── */}
      <div>
        <AnimatePresence>
          {filtered.map((contact, idx) => {
            const isPinned = pinnedIds.includes(contact.id);
            const isSentByMe = contact.lastSenderId === user?.id;

            return (
              <motion.div key={contact.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, type: "spring", stiffness: 400, damping: 28 }}>
                <motion.button
                  onClick={() => openChat(contact)}
                  className="w-full flex items-center gap-3.5 px-3 py-3 hover:bg-muted/50 active:bg-muted/70 rounded-xl transition-colors text-left relative"
                >
                  {/* Avatar with online ring */}
                  <div className="relative shrink-0">
                    {contact.online && !contact.isGroup ? (
                      <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-green-400 to-green-600">
                        <div className={`w-full h-full rounded-full ${contact.gradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden border-2 border-background`}>
                          {contact.avatarUrl ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" /> : contact.initials}
                        </div>
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-full ${contact.gradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden`}>
                        {contact.isGroup ? <span className="text-xl">{contact.groupIcon ?? "👥"}</span>
                          : contact.avatarUrl ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" /> : contact.initials}
                      </div>
                    )}
                    {contact.isGroup && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full border-2 border-background flex items-center justify-center">
                        <Users size={8} className="text-primary-foreground" />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        {isPinned && <Pin size={10} className="text-primary shrink-0" />}
                        <p className={`text-sm ${contact.unread > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/80"} truncate`}>{contact.name}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{contact.lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {/* Delivery status for sent messages */}
                        {isSentByMe && contact.lastMsg !== t("ipNoMessagesYet") && (
                          <span className="shrink-0">
                            <CheckCheck size={12} className="text-primary" />
                          </span>
                        )}
                        <p className={`text-[12.5px] truncate ${contact.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {isSentByMe && contact.lastMsg !== t("ipNoMessagesYet") ? `${t("ipYouPrefix")}: ${contact.lastMsg}` : contact.lastMsg}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {contact.pending && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-bold">{t("ipRequestBadge")}</span>
                        )}
                        {contact.unread > 0 && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="min-w-[18px] h-[18px] px-1 gradient-send text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {contact.unread}
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
                {/* Divider */}
                {idx < filtered.length - 1 && <div className="h-px bg-border/40 ml-[76px]" />}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty State */}
        {filtered.length === 0 && !chat.loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center"
            >
              <MessageSquare size={32} className="text-muted-foreground/40" />
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground mb-1">
                {filterTab === "unread" ? t("ipEmptyUnread") : filterTab === "groups" ? t("ipEmptyGroups") : filterTab === "requests" ? t("ipEmptyRequests") : uiContacts.length === 0 ? t("ipEmptyConvos") : t("ipNoResults")}
              </p>
              <p className="text-xs text-muted-foreground">
                {filterTab === "unread" ? t("ipEmptyUnreadSub") : filterTab === "groups" ? t("ipEmptyGroupsSub") : filterTab === "requests" ? t("ipEmptyRequestsSub") : t("ipStartNewConvo")}
              </p>
            </div>
            {uiContacts.length === 0 && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowNewContact(true)}
                className="px-5 py-2.5 gradient-primary text-primary-foreground font-semibold text-sm rounded-full shadow-glow flex items-center gap-2">
                <Plus size={16} /> {t("ipStartChatting")}
              </motion.button>
            )}
          </motion.div>
        )}
      </div>

      {/* ── New Contact Sheet ── */}
      <AnimatePresence>
        {showNewContact && <NewContactSheet onClose={() => setShowNewContact(false)} onCreate={handleCreateContact} findUser={chat.findUserByPhone} />}
      </AnimatePresence>

      {/* ── New Group Sheet ── */}
      <AnimatePresence>
        {showNewGroup && <NewGroupSheet contacts={uiContacts} onClose={() => setShowNewGroup(false)} onCreate={handleCreateGroup} />}
      </AnimatePresence>

      {/* ── Forward Sheet ── */}
      <AnimatePresence>
        {forwardMsgId && <ForwardSheet contacts={uiContacts} onForward={handleForwardMessage} onClose={() => setForwardMsgId(null)} />}
      </AnimatePresence>

      {/* ── Chat overlay ── */}
      <AnimatePresence>
        {activeContact && (
          <motion.div key="chat" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }} className="fixed inset-0 z-[60]">
            <ChatView
              contact={activeContact}
              messages={uiMessages}
              onBack={() => { setActiveContactId(null); chat.closeConversation(); }}
              onSend={handleSend}
              onSendVoice={handleSendVoice}
              onSendImage={handleSendImage}
              onReact={handleReact}
              onCopy={handleCopy}
              onDelete={handleDeleteMessage}
              onForward={(msgId) => setForwardMsgId(msgId)}
              conversationId={activeContactId}
              userId={user?.id ?? null}
              userName={profileData?.name || "Me"}
              isPending={activeContact.pending}
              isInitiator={(() => {
                const conv = chat.conversations.find((c) => c.id === activeContactId);
                return conv?.admin_id === user?.id;
              })()}
              onAccept={async () => {
                if (activeContactId) { await chat.acceptConversation(activeContactId); toast.success(t("ipChatAccepted")); }
              }}
              onDecline={async () => {
                if (activeContactId) { await chat.declineConversation(activeContactId); setActiveContactId(null); toast(t("ipChatDeclined")); }
              }}
              onBlockReport={async (reason) => {
                if (activeContactId) { await chat.blockAndReport(activeContactId, reason); setActiveContactId(null); toast.success(t("ipUserBlockedReported")); }
              }}
              onSendMoney={(phone) => {
                const contactId = activeContactId;
                const contactPhone = activeContact.phone;
                setActiveContactId(null); chat.closeConversation();
                onSendMoney?.(phone, async (amount) => {
                  if (contactId) {
                    await chat.sendMessage(contactId, `Sent ৳${amount.toLocaleString()} to ${contactPhone}`, "money", {
                      amount, txnId: `TXN${Date.now().toString(36).toUpperCase()}`,
                    });
                  }
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
