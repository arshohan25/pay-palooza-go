import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Send, Phone, Video, MoreVertical, Plus,
  Smile, CheckCheck, Check, Wallet, CheckCircle2, Package,
  Mic, Play, Pause, X, UserPlus, ImagePlus,
  Download, PhoneOff, VideoIcon, MicOff, Volume2,
  Clock, UserCheck, Hourglass, Users, ArrowLeft,
  Shield, UserMinus, Edit3, Info, Lock,
} from "lucide-react";
import { clearInboxCount } from "@/lib/inboxStore";
import { toast } from "@/components/ui/sonner";
import { useChat, type ChatConversation, type ChatMessage } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { WebRTCManager, type CallSignal } from "@/lib/webrtc";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useProfile } from "@/hooks/use-profile";

// ── Types (for UI rendering) ──────────────────────────────────────────────────
interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface UIMessage {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  status: "sent" | "delivered" | "read";
  seenAt?: string;
  type?: "text" | "money" | "order" | "voice" | "image";
  amount?: number;
  txnId?: string;
  orderId?: string;
  orderStatus?: "Pending" | "Shipped" | "Delivered";
  itemCount?: number;
  voiceDuration?: number;
  imageUrl?: string;
  reactions?: Reaction[];
}

interface UIContact {
  id: string;
  name: string;
  phone: string;
  initials: string;
  gradient: string;
  lastMsg: string;
  lastTime: string;
  lastTimestamp: number;
  unread: number;
  online: boolean;
  avatarUrl?: string;
  pending?: boolean;
  isGroup?: boolean;
  members?: string[];
  groupIcon?: string;
  adminId?: string;
  conversationId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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

const formatRelativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
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

// ── Convert DB conversation to UI contact ─────────────────────────────────────
function convToUIContact(conv: ChatConversation, userId: string): UIContact {
  const otherParticipants = conv.participants.filter((p) => p.user_id !== userId);
  const isGroup = conv.type === "group";

  let name = conv.name ?? "Unknown";
  let phone = "";
  let avatarUrl: string | undefined;

  if (!isGroup && otherParticipants.length > 0) {
    const other = otherParticipants[0];
    name = other.profile?.name || other.profile?.phone || "Unknown";
    phone = other.profile?.phone ?? "";
    avatarUrl = other.profile?.avatar_url ?? undefined;
  }

  const lastMsg = conv.lastMessage
    ? conv.lastMessage.decryptedContent || conv.lastMessage.content
    : "No messages yet";

  const lastTimestamp = conv.lastMessage
    ? new Date(conv.lastMessage.created_at).getTime()
    : new Date(conv.created_at).getTime();

  return {
    id: conv.id,
    conversationId: conv.id,
    name,
    phone,
    initials: getInitials(name),
    gradient: pickGradient(name),
    lastMsg,
    lastTime: formatRelativeTime(lastTimestamp),
    lastTimestamp,
    unread: conv.unreadCount,
    online: false, // Would need presence for real online status
    avatarUrl,
    isGroup,
    groupIcon: conv.group_icon ?? undefined,
    adminId: conv.admin_id === userId ? "self" : conv.admin_id ?? undefined,
    members: otherParticipants.map((p) => p.user_id),
  };
}

// ── Convert DB message to UI message ──────────────────────────────────────────
function msgToUIMessage(msg: ChatMessage, userId: string): UIMessage {
  const meta = msg.metadata as Record<string, unknown>;
  return {
    id: msg.id,
    text: msg.decryptedContent || msg.content,
    time: new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    sent: msg.sender_id === userId,
    status: "read",
    type: msg.message_type,
    amount: meta?.amount as number | undefined,
    txnId: meta?.txnId as string | undefined,
    orderId: meta?.orderId as string | undefined,
    orderStatus: meta?.orderStatus as UIMessage["orderStatus"],
    itemCount: meta?.itemCount as number | undefined,
    voiceDuration: meta?.voiceDuration as number | undefined,
    imageUrl: meta?.imageUrl as string | undefined,
    reactions: [],
  };
}

// ── Emoji Picker ───────────────────────────────────────────────────────────────
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

// ── Voice Bubble ───────────────────────────────────────────────────────────────
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

// ── Image Bubble ───────────────────────────────────────────────────────────────
const ImageBubble = ({ msg }: { msg: UIMessage }) => {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = msg.imageUrl!;
    a.download = `chat-image-${msg.id}.jpg`;
    a.target = "_blank";
    a.click();
  };
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-card max-w-[220px] ${msg.sent ? "rounded-br-md" : "rounded-bl-md"}`}>
      <img src={msg.imageUrl} alt="Shared image" className="w-full object-cover" />
      <button
        onClick={handleDownload}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        title="Download image"
      >
        <Download size={13} />
      </button>
    </div>
  );
};

// ── Calling Overlay (with real WebRTC) ─────────────────────────────────────────
interface CallingOverlayProps {
  contact: UIContact;
  mode: "audio" | "video";
  onEnd: () => void;
  webrtc: WebRTCManager | null;
}

const CallingOverlay = ({ contact, mode, onEnd, webrtc }: CallingOverlayProps) => {
  const [status, setStatus] = useState<"ringing" | "connected">("ringing");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!webrtc) return;
    webrtc.setOnCallStateChange((state) => {
      if (state === "connected") {
        setStatus("connected");
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } else if (state === "ended") {
        onEnd();
      }
    });
    webrtc.setOnRemoteStream((stream) => {
      if (mode === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [webrtc, mode, onEnd]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleEnd = () => {
    webrtc?.endCall();
    onEnd();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-between pb-16 pt-24 bg-gradient-to-b from-primary/90 to-primary/60 backdrop-blur-xl"
    >
      <audio ref={remoteAudioRef} autoPlay />
      {mode === "video" && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover opacity-30" />
      )}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="flex flex-col items-center gap-5 z-10">
        <motion.div
          animate={{ scale: status === "ringing" ? [1, 1.05, 1] : 1 }}
          transition={{ duration: 1.5, repeat: status === "ringing" ? Infinity : 0 }}
          className="relative"
        >
          {status === "ringing" && [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-white/30"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
            />
          ))}
          <div className={`w-24 h-24 rounded-full ${contact.gradient} flex items-center justify-center text-white font-bold text-3xl shadow-elevated overflow-hidden`}>
            {contact.avatarUrl
              ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
              : contact.isGroup ? (contact.groupIcon ?? "👥") : contact.initials
            }
          </div>
        </motion.div>
        <div className="text-center text-white">
          <h2 className="text-2xl font-extrabold">{contact.name}</h2>
          <p className="text-white/70 text-sm mt-1 font-medium">
            {status === "ringing" ? (mode === "video" ? "Video calling…" : "Calling…") : formatDuration(seconds)}
          </p>
          {status === "ringing" && (
            <motion.div className="flex items-center justify-center gap-1 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.3 }} />
              ))}
            </motion.div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 z-10 w-full px-12">
        <div className="flex justify-center gap-8">
          <button onClick={() => { const m = webrtc?.toggleMute(); setMuted(!!m); }} className="flex flex-col items-center gap-2">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? "bg-white/30" : "bg-white/15"}`}>
              {muted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
            </div>
            <span className="text-[11px] text-white/70">{muted ? "Unmute" : "Mute"}</span>
          </button>
          <button onClick={() => setSpeaker((v) => !v)} className="flex flex-col items-center gap-2">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${speaker ? "bg-white/30" : "bg-white/15"}`}>
              <Volume2 size={22} className="text-white" />
            </div>
            <span className="text-[11px] text-white/70">Speaker</span>
          </button>
          {mode === "video" && (
            <button onClick={() => webrtc?.toggleCamera()} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center">
                <VideoIcon size={22} className="text-white" />
              </div>
              <span className="text-[11px] text-white/70">Camera</span>
            </button>
          )}
        </div>
        <motion.button whileTap={{ scale: 0.92 }} onClick={handleEnd}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-elevated">
          <PhoneOff size={26} className="text-destructive-foreground" />
        </motion.button>
        <p className="text-[11px] text-white/50">Tap to end call</p>
      </div>
    </motion.div>
  );
};

// ── Read Receipt ───────────────────────────────────────────────────────────────
const ReadReceipt = ({ msg }: { msg: UIMessage }) => {
  if (!msg.sent) return null;
  return (
    <div className="flex items-center gap-1 mt-0.5 justify-end">
      <AnimatePresence mode="wait">
        {msg.status === "read" ? (
          <motion.div key="read" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1">
            <CheckCheck size={13} className="text-primary" />
          </motion.div>
        ) : msg.status === "delivered" ? (
          <motion.div key="delivered" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CheckCheck size={13} className="text-muted-foreground" />
          </motion.div>
        ) : (
          <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Check size={13} className="text-muted-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Message Bubble ─────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: UIMessage;
  contactName: string;
  onReact: (msgId: string, emoji: string) => void;
  isGroup?: boolean;
}

const MessageBubble = ({ msg, contactName, onReact, isGroup }: BubbleProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMoney = msg.type === "money";
  const isOrder = msg.type === "order";
  const isVoice = msg.type === "voice";
  const isImage = msg.type === "image";

  const startLongPress = () => { longPressTimer.current = setTimeout(() => setShowPicker(true), 480); };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  const pressHandlers = { onMouseDown: startLongPress, onMouseUp: cancelLongPress, onMouseLeave: cancelLongPress, onTouchStart: startLongPress, onTouchEnd: cancelLongPress };

  const hasReactions = msg.reactions && msg.reactions.length > 0;

  return (
    <div className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col max-w-[78%] ${msg.sent ? "items-end" : "items-start"} relative`}>
        {isGroup && !msg.sent && (
          <span className="text-[10px] font-semibold text-primary mb-0.5 ml-1">{contactName}</span>
        )}

        {isMoney && (
          <div {...pressHandlers} className="rounded-2xl rounded-br-md border border-primary/30 bg-primary/5 shadow-card overflow-hidden min-w-[200px] select-none">
            <div className="gradient-send px-4 py-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary-foreground/90" />
              <span className="text-[12px] font-bold text-primary-foreground">Money Sent</span>
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-xl font-extrabold text-foreground">৳{(msg.amount ?? 0).toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">To: {contactName}</p>
              <div className="flex items-center justify-between pt-1 border-t border-border mt-1">
                <span className="text-[10px] text-muted-foreground font-mono">{msg.txnId}</span>
                <span className="text-[10px] text-primary font-semibold">View Receipt →</span>
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
                <p className="text-[11px] font-bold text-foreground leading-tight">Order Tracking</p>
                <p className="text-[10px] text-muted-foreground font-mono">{msg.orderId}</p>
              </div>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[msg.orderStatus ?? "Pending"]}`}>{msg.orderStatus}</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground"><span className="font-semibold text-foreground">{msg.itemCount}</span> item{(msg.itemCount ?? 0) > 1 ? "s" : ""}</p>
                <span className="text-[11px] text-primary font-semibold">Track →</span>
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
                {["Pending", "Shipped", "Delivered"].map((step) => (
                  <p key={step} className="text-[9px] text-muted-foreground">{step}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {isVoice && <div {...pressHandlers} className="select-none"><VoiceBubble msg={msg} /></div>}
        {isImage && <div {...pressHandlers} className="select-none"><ImageBubble msg={msg} /></div>}

        {!isMoney && !isOrder && !isVoice && !isImage && (
          <div {...pressHandlers}
            className={`px-4 py-2.5 rounded-2xl text-[13.5px] leading-snug font-medium select-none ${
              msg.sent
                ? "gradient-primary text-primary-foreground rounded-br-md shadow-glow"
                : "bg-card border border-border text-foreground rounded-bl-md shadow-card"
            }`}
          >
            {msg.text}
          </div>
        )}

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
          <span className="text-[10px] text-muted-foreground">{msg.time}</span>
          <ReadReceipt msg={msg} />
        </div>
      </div>
    </div>
  );
};

// ── New Contact Sheet ──────────────────────────────────────────────────────────
interface NewContactSheetProps {
  onClose: () => void;
  onCreate: (phone: string) => void;
}

const NewContactSheet = ({ onClose, onCreate }: NewContactSheetProps) => {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const validate = () => {
    if (!phone.trim()) { setError("Phone number is required"); return false; }
    if (!/^[\d\-+\s]{10,}$/.test(phone.trim())) { setError("Enter a valid phone number"); return false; }
    setError("");
    return true;
  };

  const handleSend = () => {
    if (!validate()) return;
    setSent(true);
    setTimeout(() => {
      onCreate(phone.trim());
      onClose();
    }, 1800);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-[80] max-w-md mx-auto bg-card rounded-t-3xl px-5 pt-3 pb-8 shadow-elevated"
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Add by Phone</h2>
            <p className="text-xs text-muted-foreground">They'll get a request to connect</p>
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
                  <p className="font-bold text-foreground">Conversation Started!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">You can now start chatting</p>
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

        {!sent && (
          <>
            <div className="mb-6">
              <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                placeholder="e.g. 01711223344"
                className={`w-full h-12 px-4 bg-background border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${error ? "border-destructive" : "border-border"}`}
              />
              {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
              <p className="text-[11px] text-muted-foreground mt-2">
                Enter the phone number of the person you want to chat with
              </p>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSend}
              className="w-full h-13 gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4">
              <UserPlus size={18} />
              Start Conversation
            </motion.button>
          </>
        )}
      </motion.div>
    </>
  );
};

// ── New Group Sheet ────────────────────────────────────────────────────────────
interface NewGroupSheetProps {
  contacts: UIContact[];
  onClose: () => void;
  onCreate: (name: string, icon: string, memberIds: string[]) => void;
}

const NewGroupSheet = ({ contacts, onClose, onCreate }: NewGroupSheetProps) => {
  const [step, setStep] = useState<"pick" | "name">("pick");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupIcon, setGroupIcon] = useState("💚");
  const [error, setError] = useState("");

  const regularContacts = contacts.filter((c) => !c.isGroup);

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleNext = () => {
    if (selected.length < 2) { setError("Select at least 2 contacts"); return; }
    setError("");
    setStep("name");
  };

  const handleCreate = () => {
    if (!groupName.trim()) { setError("Group name is required"); return; }
    // selected contains conversation IDs, but we need user IDs (the other participant)
    onCreate(groupName.trim(), groupIcon, selected);
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-[80] max-w-md mx-auto bg-card rounded-t-3xl px-5 pt-3 pb-8 shadow-elevated"
        style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4 shrink-0" />

        <div className="flex items-center gap-3 mb-5 shrink-0">
          {step === "name" && (
            <button onClick={() => setStep("pick")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-foreground">
              {step === "pick" ? "New Group" : "Group Details"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === "pick" ? `Select members (${selected.length} selected)` : "Set a name and icon for your group"}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {step === "pick" ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-0">
              {regularContacts.length === 0 && (
                <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
                  <Users size={32} className="opacity-30" />
                  <p className="text-sm">No contacts available</p>
                </div>
              )}
              {regularContacts.map((c) => {
                const isSelected = selected.includes(c.id);
                return (
                  <motion.button
                    key={c.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleSelect(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                      isSelected ? "bg-primary/10 border-primary/40" : "bg-background border-border hover:bg-muted/50"
                    }`}
                  >
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
              className="w-full gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4 shrink-0">
              Next ({selected.length} selected)
            </motion.button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4 shrink-0">
              {GROUP_ICONS.map((icon) => (
                <motion.button key={icon} whileTap={{ scale: 0.9 }}
                  onClick={() => setGroupIcon(icon)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${
                    groupIcon === icon ? "border-primary bg-primary/10 scale-110" : "border-border bg-muted"
                  }`}
                >
                  {icon}
                </motion.button>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl bg-muted/50 shrink-0">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-2xl shadow-glow shrink-0">
                {groupIcon}
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">{groupName || "Group name…"}</p>
                <p className="text-[11px] text-muted-foreground">{selected.length} members</p>
              </div>
            </div>

            <div className="mb-5 shrink-0">
              <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Group Name</label>
              <input
                autoFocus
                type="text"
                value={groupName}
                onChange={(e) => { setGroupName(e.target.value); setError(""); }}
                placeholder="e.g. Family, Office Team…"
                className={`w-full h-12 px-4 bg-background border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${error ? "border-destructive" : "border-border"}`}
              />
              {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate}
              className="w-full gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4 shrink-0">
              <Users size={18} />
              Create Group
            </motion.button>
          </>
        )}
      </motion.div>
    </>
  );
};

// ── ChatView ───────────────────────────────────────────────────────────────────
interface ChatViewProps {
  contact: UIContact;
  messages: UIMessage[];
  onBack: () => void;
  onSend: (text: string) => void;
  onSendVoice: (duration: number) => void;
  onSendImage: (url: string) => void;
  onSendMoney: (phone: string) => void;
  onReact: (msgId: string, emoji: string) => void;
  onCall: (mode: "audio" | "video") => void;
  webrtc: WebRTCManager | null;
  callMode: "audio" | "video" | null;
  onEndCall: () => void;
  conversationId: string | null;
  userId: string | null;
  userName: string;
}

const ChatView = ({ contact, messages, onBack, onSend, onSendVoice, onSendImage, onSendMoney, onReact, onCall, webrtc, callMode, onEndCall, conversationId, userId, userName }: ChatViewProps) => {
  const [text, setText] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const { typingUsers, setTyping } = useTypingIndicator(conversationId, userId, userName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const micPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    setShowQuick(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const startMicPress = () => {
    micPressTimer.current = setTimeout(() => {
      setRecording(true);
      setRecordSeconds(0);
      recordTimer.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    }, 200);
  };

  const endMicPress = () => {
    clearTimeout(micPressTimer.current!);
    if (recording) {
      clearInterval(recordTimer.current!);
      const dur = Math.max(1, recordSeconds);
      setRecording(false);
      setRecordSeconds(0);
      onSendVoice(dur);
    }
  };

  useEffect(() => () => { clearInterval(recordTimer.current!); clearTimeout(micPressTimer.current!); }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onSendImage(url);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="gradient-primary px-4 pt-12 pb-3 text-primary-foreground shrink-0"
      >
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 flex items-center justify-center active:scale-95 transition-transform shrink-0">
            <ChevronLeft size={20} />
          </button>
          <div className="relative shrink-0">
            <div className={`w-10 h-10 rounded-2xl ${contact.gradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden`}>
              {contact.isGroup
                ? <span className="text-lg">{contact.groupIcon ?? "👥"}</span>
                : contact.avatarUrl
                  ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                  : contact.initials
              }
            </div>
            {!contact.isGroup && contact.online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15px] leading-tight">{contact.name}</p>
            <p className="text-[11px] text-white/70">
              {contact.isGroup ? `${(contact.members?.length ?? 0) + 1} members` : contact.phone}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!contact.isGroup && (
              <>
                <button onClick={() => onCall("audio")}
                  className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
                  <Phone size={16} />
                </button>
                <button onClick={() => onCall("video")}
                  className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
                  <Video size={16} />
                </button>
              </>
            )}
            <button className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
              {contact.isGroup ? <Info size={16} /> : <MoreVertical size={16} />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* E2E encryption banner */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 bg-muted/40 border-b border-border/40">
        <Lock size={10} className="text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">Messages are end-to-end encrypted</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Lock size={24} className="opacity-30" />
            <p className="text-sm font-medium">Start a conversation</p>
            <p className="text-xs">Messages are end-to-end encrypted</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={msg.id}>
            {idx === 0 && (
              <p className="text-center text-[10px] text-muted-foreground mb-3 font-medium">Today</p>
            )}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <MessageBubble
                msg={msg}
                contactName={contact.name}
                onReact={(msgId, emoji) => onReact(msgId, emoji)}
                isGroup={contact.isGroup}
              />
            </motion.div>
          </div>
        ))}
        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-start gap-2 pl-1"
            >
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-card flex items-center gap-2">
                <div className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-[6px] h-[6px] rounded-full bg-muted-foreground/60"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing…`
                    : `${typingUsers.length} people are typing…`}
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-2 overflow-hidden">
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

      {/* Input bar */}
      <div className="px-3 pb-5 pt-2 border-t border-border/60 bg-background shrink-0">
        <AnimatePresence>
          {recording && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-2 mb-2 px-3">
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-destructive" />
              <span className="text-sm text-destructive font-semibold">Recording… {recordSeconds}s</span>
              <span className="text-xs text-muted-foreground ml-auto">Release to send</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-card">
          <button onClick={() => setShowQuick(!showQuick)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showQuick ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Smile size={18} />
          </button>
          <input
            type="text"
            placeholder={recording ? "Recording…" : "Message…"}
            value={text}
            onChange={(e) => { setText(e.target.value); setTyping(true); }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={recording}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0 disabled:opacity-50"
          />
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Share image">
            <ImagePlus size={15} />
          </motion.button>
          {!contact.isGroup && (
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => onSendMoney(contact.phone)}
              className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title={`Send money to ${contact.name}`}>
              <Wallet size={15} />
            </motion.button>
          )}
          {text.trim() ? (
            <motion.button whileTap={{ scale: 0.88 }} onClick={handleSend}
              className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shadow-glow transition-all">
              <Send size={16} />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onMouseDown={startMicPress} onMouseUp={endMicPress} onMouseLeave={endMicPress}
              onTouchStart={startMicPress} onTouchEnd={endMicPress}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all select-none ${recording ? "gradient-send text-primary-foreground shadow-glow scale-110" : "bg-primary/10 text-primary"}`}
            >
              <Mic size={16} />
            </motion.button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Calling overlay */}
      <AnimatePresence>
        {callMode && (
          <CallingOverlay contact={contact} mode={callMode} onEnd={onEndCall} webrtc={webrtc} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── InboxPage ──────────────────────────────────────────────────────────────────
interface InboxPageProps {
  onBack?: () => void;
  onSendMoney?: (phone: string, onComplete?: (amount: number) => void) => void;
  isActive?: boolean;
}

export default function InboxPage({ onBack, onSendMoney, isActive = false }: InboxPageProps) {
  const { user } = useAuth();
  const profileData = useProfile();
  const chat = useChat();
  const [search, setSearch] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // WebRTC state
  const [callMode, setCallMode] = useState<"audio" | "video" | null>(null);
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);

  // Reactions (client-side only)
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  useEffect(() => { clearInboxCount(); }, []);

  // Convert DB conversations to UI contacts
  const uiContacts: UIContact[] = chat.conversations.map((conv) =>
    convToUIContact(conv, user?.id ?? "")
  );

  // Convert DB messages to UI messages
  const uiMessages: UIMessage[] = chat.messages.map((msg) => {
    const uiMsg = msgToUIMessage(msg, user?.id ?? "");
    uiMsg.reactions = reactions[msg.id] ?? [];
    return uiMsg;
  });

  const activeContact = activeContactId
    ? uiContacts.find((c) => c.id === activeContactId) ?? null
    : null;

  const filtered = uiContacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  // ── WebRTC signaling subscription ──────────────────────────────
  useEffect(() => {
    if (!user || !activeContactId) return;
    const mgr = new WebRTCManager(activeContactId, user.id, "Me");
    mgr.subscribe();
    mgr.setOnIncomingCall((signal) => {
      setIncomingCall(signal);
    });
    setWebrtcManager(mgr);
    return () => { mgr.destroy(); };
  }, [user, activeContactId]);

  // ── Global incoming call listener ──────────────────────────────
  useEffect(() => {
    if (!user || chat.conversations.length === 0) return;
    
    // Subscribe to all conversation channels for incoming calls
    const managers: WebRTCManager[] = [];
    for (const conv of chat.conversations) {
      if (conv.type === "direct") {
        const mgr = new WebRTCManager(conv.id, user.id, "Me");
        mgr.subscribe();
        mgr.setOnIncomingCall((signal) => {
          setIncomingCall(signal);
          // Auto-navigate to the conversation
          setActiveContactId(conv.id);
          chat.openConversation(conv.id);
        });
        managers.push(mgr);
      }
    }
    return () => { managers.forEach((m) => m.destroy()); };
  }, [user, chat.conversations.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleCreateContact = async (phone: string) => {
    if (!user) return;
    const found = await chat.findUserByPhone(phone);
    if (!found) {
      toast.error("User not found", { description: "No account with this phone number" });
      return;
    }
    if (found.user_id === user.id) {
      toast.error("That's your own number!");
      return;
    }
    const convId = await chat.createDirectConversation(found.user_id);
    if (convId) {
      toast.success("Conversation started!", { description: `You can now chat with ${found.name || phone}` });
      setActiveContactId(convId);
      chat.openConversation(convId);
    }
  };

  const handleCreateGroup = async (name: string, icon: string, memberConvIds: string[]) => {
    if (!user) return;
    // memberConvIds are conversation IDs of direct chats; extract other user IDs
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
      toast.success(`Group "${name}" created!`);
      setActiveContactId(convId);
      chat.openConversation(convId);
    }
  };

  const openChat = (contact: UIContact) => {
    setActiveContactId(contact.conversationId);
    chat.openConversation(contact.conversationId);
  };

  const handleCall = async (mode: "audio" | "video") => {
    if (!webrtcManager) return;
    try {
      setCallMode(mode);
      await webrtcManager.startCall(mode);
    } catch (err) {
      console.error("Call failed:", err);
      toast.error("Call failed", { description: "Could not access microphone/camera" });
      setCallMode(null);
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !webrtcManager) return;
    try {
      setCallMode(incomingCall.mode);
      await webrtcManager.answerCall(incomingCall.payload as RTCSessionDescriptionInit, incomingCall.mode);
      setIncomingCall(null);
    } catch (err) {
      console.error("Answer failed:", err);
      toast.error("Could not answer call");
      setCallMode(null);
      setIncomingCall(null);
    }
  };

  const handleRejectCall = () => {
    webrtcManager?.rejectCall();
    setIncomingCall(null);
  };

  const handleEndCall = () => {
    webrtcManager?.endCall();
    setCallMode(null);
  };

  const totalUnread = chat.totalUnread;

  if (chat.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">Loading conversations…</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Contact list ── */}
      <div className="space-y-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Messages</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowNewGroup(true)}
              className="w-10 h-10 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Users size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowNewContact(true)}
              className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow">
              <Plus size={18} />
            </motion.button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input type="text" placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-4 h-10 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
        </div>

        {/* Conversation list */}
        <div className="space-y-1">
          <AnimatePresence>
            {filtered.map((contact, idx) => (
              <motion.button key={contact.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 28 }}
                onClick={() => openChat(contact)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border hover:shadow-elevated active:scale-[0.98] transition-all text-left shadow-card"
              >
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-2xl ${contact.gradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden`}>
                    {contact.isGroup
                      ? <span className="text-xl">{contact.groupIcon ?? "👥"}</span>
                      : contact.avatarUrl
                        ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                        : contact.initials
                    }
                  </div>
                  {contact.isGroup && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full border-2 border-background flex items-center justify-center">
                      <Users size={8} className="text-primary-foreground" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`text-[13.5px] ${contact.unread > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/80"} truncate`}>{contact.name}</p>
                      {contact.isGroup && <Users size={10} className="text-muted-foreground shrink-0" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2 flex items-center gap-0.5">
                      <Clock size={9} className="opacity-60" />
                      {contact.lastTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-[12px] truncate ${contact.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{contact.lastMsg}</p>
                    {contact.unread > 0 && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="ml-2 min-w-[18px] h-[18px] px-1 gradient-send text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {contact.unread}
                      </motion.span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && !chat.loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <div className="w-14 h-14 rounded-3xl bg-muted flex items-center justify-center"><UserPlus size={22} /></div>
              <p className="text-sm font-semibold">{uiContacts.length === 0 ? "No conversations yet" : "No contacts found"}</p>
              <p className="text-xs">Tap + to start a new conversation</p>
            </div>
          )}
        </div>
      </div>

      {/* ── New Contact Sheet ── */}
      <AnimatePresence>
        {showNewContact && (
          <NewContactSheet onClose={() => setShowNewContact(false)} onCreate={handleCreateContact} />
        )}
      </AnimatePresence>

      {/* ── New Group Sheet ── */}
      <AnimatePresence>
        {showNewGroup && (
          <NewGroupSheet
            contacts={uiContacts}
            onClose={() => setShowNewGroup(false)}
            onCreate={handleCreateGroup}
          />
        )}
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
              onCall={handleCall}
              webrtc={webrtcManager}
              callMode={callMode}
              onEndCall={handleEndCall}
              conversationId={activeContactId}
              userId={user?.id ?? null}
              userName={profileData?.name || "Me"}
              onSendMoney={(phone) => {
                const contactId = activeContactId;
                const contactPhone = activeContact.phone;
                setActiveContactId(null);
                chat.closeConversation();
                onSendMoney?.(phone, async (amount) => {
                  if (contactId) {
                    await chat.sendMessage(contactId, `Sent ৳${amount.toLocaleString()} to ${contactPhone}`, "money", {
                      amount,
                      txnId: `TXN${Date.now().toString(36).toUpperCase()}`,
                    });
                  }
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Incoming call overlay ── */}
      <AnimatePresence>
        {incomingCall && (
          <IncomingCallOverlay
            callerName={incomingCall.senderName}
            mode={incomingCall.mode}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
          />
        )}
      </AnimatePresence>
    </>
  );
}
