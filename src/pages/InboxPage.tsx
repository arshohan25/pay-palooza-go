import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Send, Phone, Video, MoreVertical, Search, Plus,
  Smile, CheckCheck, Check, Wallet, CheckCircle2, Package,
  Mic, Play, Pause, X, UserPlus,
} from "lucide-react";
import { addInboxMsg, clearInboxCount } from "@/lib/inboxStore";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  status: "sent" | "delivered" | "read";
  type?: "text" | "money" | "order" | "voice";
  amount?: number;
  txnId?: string;
  orderId?: string;
  orderStatus?: "Pending" | "Shipped" | "Delivered";
  itemCount?: number;
  voiceDuration?: number; // seconds
  reactions?: Reaction[];
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  initials: string;
  gradient: string;
  lastMsg: string;
  lastTime: string;
  unread: number;
  online: boolean;
  messages: Message[];
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const INITIAL_CONTACTS: Contact[] = [
  {
    id: "c1",
    name: "Rahim Uddin",
    phone: "01711-223344",
    initials: "RU",
    gradient: "gradient-send",
    lastMsg: "Payment received, thanks! 🙏",
    lastTime: "2m",
    unread: 2,
    online: true,
    messages: [
      { id: "m1", text: "Hey, can you send me ৳500?", time: "10:30 AM", sent: false, status: "read" },
      { id: "m2", text: "Sure, sending now!", time: "10:31 AM", sent: true, status: "read" },
      { id: "m3", text: "Payment received, thanks! 🙏", time: "10:32 AM", sent: false, status: "read" },
      { id: "m4", text: "Let's split the dinner bill?", time: "2m ago", sent: false, status: "delivered" },
      { id: "m5", text: "How much is my share?", time: "1m ago", sent: false, status: "delivered" },
    ],
  },
  {
    id: "c2",
    name: "Nusrat Jahan",
    phone: "01831-556677",
    initials: "NJ",
    gradient: "gradient-payment",
    lastMsg: "Will send you tomorrow 😊",
    lastTime: "1h",
    unread: 0,
    online: true,
    messages: [
      { id: "m1", text: "Hey Nusrat! Did you get the transfer?", time: "9:15 AM", sent: true, status: "read" },
      { id: "m2", text: "Not yet, let me check!", time: "9:20 AM", sent: false, status: "read" },
      { id: "m3", text: "Hmm still not showing. Maybe tomorrow?", time: "9:22 AM", sent: false, status: "read" },
      { id: "m4", text: "Will send you tomorrow 😊", time: "1h ago", sent: false, status: "read" },
    ],
  },
  {
    id: "c3",
    name: "Karim Bhai",
    phone: "01912-889900",
    initials: "KB",
    gradient: "gradient-cashout",
    lastMsg: "ঠিক আছে, পাঠিয়ে দিও",
    lastTime: "3h",
    unread: 0,
    online: false,
    messages: [
      { id: "m1", text: "Karim bhai, need to pay the rent", time: "Yesterday", sent: true, status: "read" },
      { id: "m2", text: "কত লাগবে?", time: "Yesterday", sent: false, status: "read" },
      { id: "m3", text: "৳8,000", time: "Yesterday", sent: true, status: "read" },
      { id: "m4", text: "", time: "Yesterday", sent: false, status: "read", type: "order", orderId: "ORD-20483", orderStatus: "Shipped", itemCount: 3 },
      { id: "m5", text: "ঠিক আছে, পাঠিয়ে দিও", time: "3h ago", sent: false, status: "read" },
    ],
  },
  {
    id: "c4",
    name: "Mitu Apa",
    phone: "01614-334455",
    initials: "MA",
    gradient: "gradient-accent",
    lastMsg: "Sure! I'll transfer right now",
    lastTime: "Yesterday",
    unread: 0,
    online: false,
    messages: [
      { id: "m1", text: "Mitu apa, আপনার কাছে ৳2000 ধার চাই", time: "Yesterday", sent: true, status: "read" },
      { id: "m2", text: "Sure! I'll transfer right now", time: "Yesterday", sent: false, status: "read" },
    ],
  },
  {
    id: "c5",
    name: "Arif vai",
    phone: "01511-778899",
    initials: "AV",
    gradient: "gradient-addmoney",
    lastMsg: "👍",
    lastTime: "2d",
    unread: 0,
    online: false,
    messages: [
      { id: "m1", text: "Payment done bro", time: "2d ago", sent: true, status: "read" },
      { id: "m2", text: "👍", time: "2d ago", sent: false, status: "read" },
    ],
  },
];

const QUICK_REPLIES = ["👍", "Thanks!", "OK!", "Send ৳500", "Got it 😊", "Sure!"];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏", "😍", "🎉"];

// ── Gradient initials helper ───────────────────────────────────────────────────
const GRADIENT_OPTIONS = [
  "gradient-send", "gradient-payment", "gradient-cashout",
  "gradient-accent", "gradient-addmoney", "gradient-primary",
];
const pickGradient = (name: string) =>
  GRADIENT_OPTIONS[name.charCodeAt(0) % GRADIENT_OPTIONS.length];

const getInitials = (name: string) =>
  name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

// ── Waveform bars (deterministic from id) ─────────────────────────────────────
const getWaveBars = (seed: string) => {
  const n = 28;
  return Array.from({ length: n }, (_, i) => {
    const h = 3 + ((seed.charCodeAt(i % seed.length) * (i + 7)) % 22);
    return h;
  });
};

// ── Status badge styles ────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Shipped: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

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
const VoiceBubble = ({ msg }: { msg: Message }) => {
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
          if (p + step >= 100) {
            clearInterval(timerRef.current!);
            setPlaying(false);
            return 0;
          }
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
      {/* Waveform */}
      <div className="flex items-center gap-[2px] flex-1 h-8">
        {bars.map((h, i) => (
          <div key={i} style={{ height: h }}
            className={`w-[2.5px] rounded-full transition-colors ${
              i < fillIndex
                ? (msg.sent ? "bg-white" : "bg-primary")
                : (msg.sent ? "bg-white/40" : "bg-muted-foreground/30")
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

// ── Message Bubble ─────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: Message;
  contactName: string;
  searchQuery: string;
  onReact: (msgId: string, emoji: string) => void;
}

const highlightText = (text: string, query: string) => {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-accent/40 text-foreground rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
};

const MessageBubble = ({ msg, contactName, searchQuery, onReact }: BubbleProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMoney = msg.type === "money";
  const isOrder = msg.type === "order";
  const isVoice = msg.type === "voice";

  const startLongPress = () => { longPressTimer.current = setTimeout(() => setShowPicker(true), 480); };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  const pressHandlers = { onMouseDown: startLongPress, onMouseUp: cancelLongPress, onMouseLeave: cancelLongPress, onTouchStart: startLongPress, onTouchEnd: cancelLongPress };

  const hasReactions = msg.reactions && msg.reactions.length > 0;

  return (
    <div className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col max-w-[78%] ${msg.sent ? "items-end" : "items-start"} relative`}>

        {/* Money card */}
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

        {/* Order card */}
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

        {/* Voice bubble */}
        {isVoice && (
          <div {...pressHandlers} className="select-none">
            <VoiceBubble msg={msg} />
          </div>
        )}

        {/* Text bubble */}
        {!isMoney && !isOrder && !isVoice && (
          <div {...pressHandlers}
            className={`px-4 py-2.5 rounded-2xl text-[13.5px] leading-snug font-medium select-none ${
              msg.sent
                ? "gradient-primary text-primary-foreground rounded-br-md shadow-glow"
                : "bg-card border border-border text-foreground rounded-bl-md shadow-card"
            }`}
          >
            {highlightText(msg.text, searchQuery)}
          </div>
        )}

        {/* Emoji picker */}
        <AnimatePresence>
          {showPicker && (
            <EmojiPicker alignRight={msg.sent} onPick={(emoji) => onReact(msg.id, emoji)} onClose={() => setShowPicker(false)} />
          )}
        </AnimatePresence>

        {/* Reaction pills */}
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

        {/* Timestamp */}
        <div className={`flex items-center gap-1 mt-1 ${msg.sent ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-muted-foreground">{msg.time}</span>
          {msg.sent && (msg.status === "read" ? <CheckCheck size={12} className="text-primary" /> : <Check size={12} className="text-muted-foreground" />)}
        </div>
      </div>
    </div>
  );
};

// ── New Contact Sheet ──────────────────────────────────────────────────────────
interface NewContactSheetProps {
  onClose: () => void;
  onCreate: (name: string, phone: string) => void;
}

const NewContactSheet = ({ onClose, onCreate }: NewContactSheetProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Name is required";
    if (!phone.trim()) e.phone = "Phone is required";
    else if (!/^[\d\-+\s]{10,}$/.test(phone.trim())) e.phone = "Enter a valid phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) return;
    onCreate(name.trim(), phone.trim());
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-[80] max-w-md mx-auto bg-card rounded-t-3xl px-5 pt-3 pb-8 shadow-elevated"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">New Contact</h2>
            <p className="text-xs text-muted-foreground">Add someone to start chatting</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-2xl ${pickGradient(name || "A")} flex items-center justify-center text-white font-bold text-xl shadow-card`}>
            {name ? getInitials(name) : <UserPlus size={24} />}
          </div>
        </div>

        {/* Name field */}
        <div className="mb-4">
          <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahim Uddin"
            className={`w-full h-12 px-4 bg-background border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${errors.name ? "border-destructive" : "border-border"}`}
          />
          {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name}</p>}
        </div>

        {/* Phone field */}
        <div className="mb-6">
          <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 01711-223344"
            className={`w-full h-12 px-4 bg-background border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${errors.phone ? "border-destructive" : "border-border"}`}
          />
          {errors.phone && <p className="text-[11px] text-destructive mt-1">{errors.phone}</p>}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleCreate}
          className="w-full h-13 gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow flex items-center justify-center gap-2 py-4"
        >
          <UserPlus size={18} />
          Add Contact & Start Chat
        </motion.button>
      </motion.div>
    </>
  );
};

// ── ChatView ───────────────────────────────────────────────────────────────────
interface ChatViewProps {
  contact: Contact;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
  onSendVoice: (duration: number) => void;
  onSendMoney: (phone: string) => void;
  onReact: (msgId: string, emoji: string) => void;
}

const ChatView = ({ contact, messages, onBack, onSend, onSendVoice, onSendMoney, onReact }: ChatViewProps) => {
  const [text, setText] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const micPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, searchOpen]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    setShowQuick(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  // Mic long-press handlers
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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  useEffect(() => () => {
    clearInterval(recordTimer.current!);
    clearTimeout(micPressTimer.current!);
  }, []);

  // Filtered messages for search
  const displayMessages = searchOpen && searchQuery.trim()
    ? messages.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()) && m.type !== "voice" && m.type !== "money" && m.type !== "order")
    : messages;

  const searchMatchCount = searchOpen && searchQuery.trim()
    ? messages.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase())).length
    : 0;

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
          <div className="relative">
            <div className={`w-10 h-10 rounded-2xl ${contact.gradient} flex items-center justify-center text-white font-bold text-sm`}>
              {contact.initials}
            </div>
            {contact.online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15px] leading-tight">{contact.name}</p>
            <p className="text-[11px] text-white/70">{contact.online ? "Active now" : contact.phone}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setSearchOpen((v) => !v); setSearchQuery(""); }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all ${searchOpen ? "bg-white/30" : "bg-white/15"}`}>
              <Search size={16} />
            </button>
            <button className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform"><Phone size={16} /></button>
            <button className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform"><Video size={16} /></button>
            <button className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform"><MoreVertical size={16} /></button>
          </div>
        </div>

        {/* Search bar (inline below header) */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="overflow-hidden mt-3"
            >
              <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
                <Search size={14} className="text-white/70 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in conversation…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none"
                />
                {searchQuery && (
                  <span className="text-[10px] text-white/70 shrink-0">{searchMatchCount} found</span>
                )}
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-white/70 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
        {searchOpen && searchQuery && displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Search size={28} className="opacity-40" />
            <p className="text-sm font-semibold">No messages found</p>
          </div>
        )}

        {displayMessages.map((msg, idx) => (
          <div key={msg.id}>
            {idx === 0 && !searchOpen && (
              <p className="text-center text-[10px] text-muted-foreground mb-3 font-medium">Today</p>
            )}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <MessageBubble msg={msg} contactName={contact.name} searchQuery={searchQuery} onReact={onReact} />
            </motion.div>
          </div>
        ))}

        {/* Typing indicator */}
        {contact.online && !searchOpen && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1 shadow-card">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full"
                  animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </div>
        )}
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
        {/* Recording indicator */}
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
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={recording}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0 disabled:opacity-50"
          />
          {/* Send money shortcut */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => onSendMoney(contact.phone)}
            className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors shrink-0"
            title={`Send money to ${contact.name}`}>
            <Wallet size={15} />
          </motion.button>
          {/* Mic (hold to record) or Send */}
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
    </div>
  );
};

// ── InboxPage ──────────────────────────────────────────────────────────────────
interface InboxPageProps {
  onBack?: () => void;
  onSendMoney?: (phone: string, onComplete?: (amount: number) => void) => void;
}

export default function InboxPage({ onBack, onSendMoney }: InboxPageProps) {
  const [contacts, setContacts] = useState<Contact[]>(() =>
    INITIAL_CONTACTS.map((c) => {
      try {
        const stored = localStorage.getItem(`inbox_msgs_${c.id}`);
        if (stored) {
          const msgs: Message[] = JSON.parse(stored);
          const last = msgs[msgs.length - 1];
          return { ...c, messages: msgs, lastMsg: last?.text ?? c.lastMsg, lastTime: "saved" };
        }
      } catch { /* ignore */ }
      return c;
    })
  );
  const [activeChat, setActiveChat] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);

  useEffect(() => { clearInboxCount(); }, []);

  useEffect(() => {
    contacts.forEach((c) => {
      try { localStorage.setItem(`inbox_msgs_${c.id}`, JSON.stringify(c.messages)); } catch { /* quota */ }
    });
  }, [contacts]);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const updateContact = useCallback((contactId: string, updater: (c: Contact) => Contact) => {
    setContacts((prev) => prev.map((c) => c.id === contactId ? updater(c) : c));
  }, []);

  const handleReact = useCallback((contactId: string, msgId: string, emoji: string) => {
    updateContact(contactId, (c) => ({
      ...c,
      messages: c.messages.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = m.reactions ? [...m.reactions] : [];
        const existing = reactions.find((r) => r.emoji === emoji);
        if (existing) {
          if (existing.reacted) {
            const updated = { ...existing, count: existing.count - 1, reacted: false };
            return { ...m, reactions: updated.count === 0 ? reactions.filter((r) => r.emoji !== emoji) : reactions.map((r) => r.emoji === emoji ? updated : r) };
          }
          return { ...m, reactions: reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r) };
        }
        return { ...m, reactions: [...reactions, { emoji, count: 1, reacted: true }] };
      }),
    }));
  }, [updateContact]);

  const handleSend = useCallback((contactId: string, text: string) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const newMsg: Message = { id: `m${Date.now()}`, text, time: timeStr, sent: true, status: "sent", type: "text" };
    updateContact(contactId, (c) => ({ ...c, messages: [...c.messages, newMsg], lastMsg: text, lastTime: "now", unread: 0 }));
    const contact = contacts.find((c) => c.id === contactId);
    if (contact?.online) {
      const replies = ["Got it! 👍", "Thanks for letting me know", "OK sure!", "Received 🙏", "Will check now", "😊"];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      setTimeout(() => {
        addInboxMsg();
        updateContact(contactId, (c) => ({
          ...c,
          messages: [...c.messages, newMsg, { id: `m${Date.now() + 1}`, text: reply, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), sent: false, status: "delivered" as const, type: "text" as const }],
          lastMsg: reply, lastTime: "now",
        }));
      }, 1800);
    }
  }, [contacts, updateContact]);

  const handleSendVoice = useCallback((contactId: string, duration: number) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const voiceMsg: Message = { id: `m${Date.now()}`, text: "", time: timeStr, sent: true, status: "sent", type: "voice", voiceDuration: duration };
    updateContact(contactId, (c) => ({ ...c, messages: [...c.messages, voiceMsg], lastMsg: `🎤 Voice note (${duration}s)`, lastTime: "now", unread: 0 }));
    const contact = contacts.find((c) => c.id === contactId);
    if (contact?.online) {
      const voiceReplies = ["🎤 Heard it!", "Listening now...", "👍 Got your voice note", "Will reply soon!"];
      const reply = voiceReplies[Math.floor(Math.random() * voiceReplies.length)];
      setTimeout(() => {
        addInboxMsg();
        updateContact(contactId, (c) => ({
          ...c,
          messages: [...c.messages, voiceMsg, { id: `m${Date.now() + 1}`, text: reply, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), sent: false, status: "delivered" as const, type: "text" as const }],
          lastMsg: reply, lastTime: "now",
        }));
      }, 2000);
    }
  }, [contacts, updateContact]);

  const handleSendMoneyMsg = useCallback((contactId: string, amount: number, phone: string) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const txnId = `TXN${Date.now().toString().slice(-8)}`;
    const moneyMsg: Message = { id: `m${Date.now()}`, text: `Sent ৳${amount.toLocaleString()} to ${phone}`, time: timeStr, sent: true, status: "sent", type: "money", amount, txnId };
    updateContact(contactId, (c) => ({ ...c, messages: [...c.messages, moneyMsg], lastMsg: `💸 Sent ৳${amount.toLocaleString()}`, lastTime: "now", unread: 0 }));
    const contact = contacts.find((c) => c.id === contactId);
    if (contact?.online) {
      const moneyReplies = ["Received! Thank you 🙏", "Got it, thanks! 💚", `Received ৳${amount.toLocaleString()} ✓`, "Thank you so much! 😊"];
      const reply = moneyReplies[Math.floor(Math.random() * moneyReplies.length)];
      setTimeout(() => {
        addInboxMsg();
        updateContact(contactId, (c) => ({
          ...c,
          messages: [...c.messages, moneyMsg, { id: `m${Date.now() + 1}`, text: reply, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), sent: false, status: "delivered" as const, type: "text" as const }],
          lastMsg: reply, lastTime: "now",
        }));
      }, 1500);
    }
  }, [contacts, updateContact]);

  const handleCreateContact = (name: string, phone: string) => {
    const id = `c_${Date.now()}`;
    const initials = getInitials(name);
    const gradient = pickGradient(name);
    const newContact: Contact = {
      id, name, phone, initials, gradient,
      lastMsg: "Say hi! 👋", lastTime: "now", unread: 0, online: false,
      messages: [],
    };
    setContacts((prev) => [newContact, ...prev]);
    // Open their chat immediately
    setActiveChat(newContact);
  };

  const openChat = (contact: Contact) => {
    setContacts((prev) => prev.map((c) => c.id === contact.id ? { ...c, unread: 0 } : c));
    setActiveChat(contact);
  };

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0);
  const currentMessages = activeChat ? (contacts.find((c) => c.id === activeChat.id)?.messages ?? activeChat.messages) : [];

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
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowNewContact(true)}
            className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow">
            <Plus size={18} />
          </motion.button>
        </div>

        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-10 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
        </div>

        {/* Online strip */}
        <div className="mb-4 -mx-1">
          <div className="flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
            {contacts.filter((c) => c.online).map((c) => (
              <button key={c.id} onClick={() => openChat(c)} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl ${c.gradient} flex items-center justify-center text-white font-bold text-sm shadow-card`}>{c.initials}</div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-background" />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[48px]">{c.name.split(" ")[0]}</p>
              </button>
            ))}
          </div>
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
                  <div className={`w-12 h-12 rounded-2xl ${contact.gradient} flex items-center justify-center text-white font-bold text-sm`}>{contact.initials}</div>
                  {contact.online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-background" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-[13.5px] ${contact.unread > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/80"} truncate`}>{contact.name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{contact.lastTime}</span>
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

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <div className="w-14 h-14 rounded-3xl bg-muted flex items-center justify-center"><Search size={22} /></div>
              <p className="text-sm font-semibold">No contacts found</p>
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

      {/* ── Chat overlay ── */}
      <AnimatePresence>
        {activeChat && (
          <motion.div key="chat" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }} className="fixed inset-0 z-[60]">
            <ChatView
              contact={activeChat}
              messages={currentMessages}
              onBack={() => setActiveChat(null)}
              onSend={(text) => handleSend(activeChat.id, text)}
              onSendVoice={(dur) => handleSendVoice(activeChat.id, dur)}
              onReact={(msgId, emoji) => handleReact(activeChat.id, msgId, emoji)}
              onSendMoney={(phone) => {
                const chatId = activeChat.id;
                const chatContact = activeChat;
                setActiveChat(null);
                onSendMoney?.(phone, (amount) => { handleSendMoneyMsg(chatId, amount, chatContact.phone); });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
