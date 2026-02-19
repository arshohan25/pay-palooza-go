import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Send, Phone, Video, MoreVertical, Search, Plus,
  Smile, CheckCheck, Check, Wallet, CheckCircle2, Package,
} from "lucide-react";
import { addInboxMsg, clearInboxCount } from "@/lib/inboxStore";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean; // did the current user react with this?
}

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  status: "sent" | "delivered" | "read";
  emoji?: string;
  type?: "text" | "money" | "order";
  amount?: number;
  txnId?: string;
  // order card fields
  orderId?: string;
  orderStatus?: "Pending" | "Shipped" | "Delivered";
  itemCount?: number;
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
      {
        id: "m4",
        text: "",
        time: "Yesterday",
        sent: false,
        status: "read",
        type: "order",
        orderId: "ORD-20483",
        orderStatus: "Shipped",
        itemCount: 3,
      },
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

// ── Emoji Reaction Picker ──────────────────────────────────────────────────────
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏", "😍", "🎉"];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
  alignRight?: boolean;
}

const EmojiPicker = ({ onPick, onClose, alignRight }: EmojiPickerProps) => (
  <>
    {/* Backdrop */}
    <div className="fixed inset-0 z-[70]" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`absolute bottom-full mb-2 z-[80] bg-card border border-border rounded-2xl shadow-elevated px-2 py-2 flex gap-1 ${alignRight ? "right-0" : "left-0"}`}
    >
      {REACTION_EMOJIS.map((e) => (
        <motion.button
          key={e}
          whileTap={{ scale: 0.8 }}
          whileHover={{ scale: 1.25, y: -4 }}
          onClick={() => { onPick(e); onClose(); }}
          className="text-xl w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          {e}
        </motion.button>
      ))}
    </motion.div>
  </>
);

// ── Order Status Badge ─────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Shipped: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

// ── Message Bubble ─────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: Message;
  contactName: string;
  onReact: (msgId: string, emoji: string) => void;
}

const MessageBubble = ({ msg, contactName, onReact }: BubbleProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMoney = msg.type === "money";
  const isOrder = msg.type === "order";

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      setShowPicker(true);
    }, 480);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const hasReactions = msg.reactions && msg.reactions.length > 0;

  return (
    <div className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col max-w-[78%] ${msg.sent ? "items-end" : "items-start"} relative`}>
        {/* ── Money sent card ── */}
        {isMoney && (
          <div
            className="rounded-2xl rounded-br-md border border-primary/30 bg-primary/5 shadow-card overflow-hidden min-w-[200px] select-none"
            onMouseDown={startLongPress}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
          >
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

        {/* ── Order tracking card ── */}
        {isOrder && (
          <div
            className={`rounded-2xl border border-border bg-card shadow-card overflow-hidden min-w-[210px] select-none ${msg.sent ? "rounded-br-md" : "rounded-bl-md"}`}
            onMouseDown={startLongPress}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-muted/40">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground leading-tight">Order Tracking</p>
                <p className="text-[10px] text-muted-foreground font-mono">{msg.orderId}</p>
              </div>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[msg.orderStatus ?? "Pending"]}`}>
                {msg.orderStatus}
              </span>
            </div>
            {/* Body */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{msg.itemCount}</span> item{(msg.itemCount ?? 0) > 1 ? "s" : ""}
                </p>
                <span className="text-[11px] text-primary font-semibold">Track →</span>
              </div>
              {/* Progress dots */}
              <div className="flex items-center gap-1 mt-3">
                {["Pending", "Shipped", "Delivered"].map((step, i) => {
                  const statusIndex = ["Pending", "Shipped", "Delivered"].indexOf(msg.orderStatus ?? "Pending");
                  const active = i <= statusIndex;
                  return (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${active ? "bg-primary" : "bg-border"}`} />
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

        {/* ── Regular text bubble ── */}
        {!isMoney && !isOrder && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-[13.5px] leading-snug font-medium select-none ${
              msg.sent
                ? "gradient-primary text-primary-foreground rounded-br-md shadow-glow"
                : "bg-card border border-border text-foreground rounded-bl-md shadow-card"
            }`}
            onMouseDown={startLongPress}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
          >
            {msg.text}
          </div>
        )}

        {/* Emoji reaction picker */}
        <AnimatePresence>
          {showPicker && (
            <EmojiPicker
              alignRight={msg.sent}
              onPick={(emoji) => onReact(msg.id, emoji)}
              onClose={() => setShowPicker(false)}
            />
          )}
        </AnimatePresence>

        {/* Reaction pills */}
        {hasReactions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-1 mt-1 flex-wrap"
          >
            {msg.reactions!.map((r) => (
              <motion.button
                key={r.emoji}
                whileTap={{ scale: 0.85 }}
                onClick={() => onReact(msg.id, r.emoji)}
                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[12px] border transition-colors ${
                  r.reacted
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-card border-border text-foreground"
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-[10px] font-semibold">{r.count}</span>}
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Timestamp + read receipt */}
        <div className={`flex items-center gap-1 mt-1 ${msg.sent ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-muted-foreground">{msg.time}</span>
          {msg.sent && (
            msg.status === "read"
              ? <CheckCheck size={12} className="text-primary" />
              : <Check size={12} className="text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const QUICK_REPLIES = ["👍", "Thanks!", "OK!", "Send ৳500", "Got it 😊", "Sure!"];

// ── Chat View ──────────────────────────────────────────────────────────────────
interface ChatViewProps {
  contact: Contact;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
  onSendMoney: (phone: string) => void;
  onReact: (msgId: string, emoji: string) => void;
}

const ChatView = ({ contact, messages, onBack, onSend, onSendMoney, onReact }: ChatViewProps) => {
  const [text, setText] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    setShowQuick(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Chat header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="gradient-primary px-4 pt-12 pb-4 text-primary-foreground flex items-center gap-3 shrink-0"
      >
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 flex items-center justify-center active:scale-95 transition-transform shrink-0"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="relative">
          <div className={`w-10 h-10 rounded-2xl ${contact.gradient} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {contact.initials}
          </div>
          {contact.online && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] leading-tight">{contact.name}</p>
          <p className="text-[11px] text-white/70">{contact.online ? "Active now" : contact.phone}</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
            <Phone size={16} />
          </button>
          <button className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
            <Video size={16} />
          </button>
          <button className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
            <MoreVertical size={16} />
          </button>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
        {messages.map((msg, idx) => {
          const showDate = idx === 0;
          return (
            <div key={msg.id}>
              {showDate && (
                <p className="text-center text-[10px] text-muted-foreground mb-3 font-medium">Today</p>
              )}
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <MessageBubble msg={msg} contactName={contact.name} onReact={onReact} />
              </motion.div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {contact.online && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1 shadow-card">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <AnimatePresence>
        {showQuick && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-2 overflow-hidden"
          >
            <div className="flex gap-2 flex-wrap">
              {QUICK_REPLIES.map((r) => (
                <button
                  key={r}
                  onClick={() => { onSend(r); setShowQuick(false); }}
                  className="px-3 py-1.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-3 pb-5 pt-2 border-t border-border/60 bg-background shrink-0">
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-card">
          <button
            onClick={() => setShowQuick(!showQuick)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showQuick ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Smile size={18} />
          </button>
          <input
            type="text"
            placeholder="Message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
          />
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => onSendMoney(contact.phone)}
            className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors shrink-0"
            title={`Send money to ${contact.name}`}
          >
            <Wallet size={15} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none transition-all"
          >
            <Send size={16} />
          </motion.button>
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
  const [contacts, setContacts] = useState<Contact[]>(() => {
    return INITIAL_CONTACTS.map((c) => {
      try {
        const stored = localStorage.getItem(`inbox_msgs_${c.id}`);
        if (stored) {
          const msgs: Message[] = JSON.parse(stored);
          const last = msgs[msgs.length - 1];
          return { ...c, messages: msgs, lastMsg: last?.text ?? c.lastMsg, lastTime: "saved" };
        }
      } catch { /* ignore */ }
      return c;
    });
  });
  const [activeChat, setActiveChat] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { clearInboxCount(); }, []);

  useEffect(() => {
    contacts.forEach((c) => {
      try {
        localStorage.setItem(`inbox_msgs_${c.id}`, JSON.stringify(c.messages));
      } catch { /* ignore quota errors */ }
    });
  }, [contacts]);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search),
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
            // un-react
            const updated = { ...existing, count: existing.count - 1, reacted: false };
            const filtered = updated.count === 0
              ? reactions.filter((r) => r.emoji !== emoji)
              : reactions.map((r) => r.emoji === emoji ? updated : r);
            return { ...m, reactions: filtered };
          } else {
            return { ...m, reactions: reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r) };
          }
        }
        return { ...m, reactions: [...reactions, { emoji, count: 1, reacted: true }] };
      }),
    }));
  }, [updateContact]);

  const handleSend = useCallback((contactId: string, text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const newMsg: Message = {
      id: `m${Date.now()}`,
      text,
      time: timeStr,
      sent: true,
      status: "sent",
      type: "text",
    };

    updateContact(contactId, (c) => ({
      ...c,
      messages: [...c.messages, newMsg],
      lastMsg: text,
      lastTime: "now",
      unread: 0,
    }));

    const contact = contacts.find((c) => c.id === contactId);
    if (contact?.online) {
      const AUTO_REPLIES = ["Got it! 👍", "Thanks for letting me know", "OK sure!", "Received 🙏", "Will check now", "😊"];
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      setTimeout(() => {
        addInboxMsg();
        updateContact(contactId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            newMsg,
            {
              id: `m${Date.now() + 1}`,
              text: reply,
              time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
              sent: false,
              status: "delivered" as const,
              type: "text" as const,
            },
          ],
          lastMsg: reply,
          lastTime: "now",
        }));
      }, 1800);
    }
  }, [contacts, updateContact]);

  const handleSendMoneyMsg = useCallback((contactId: string, amount: number, phone: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const txnId = `TXN${Date.now().toString().slice(-8)}`;
    const moneyMsg: Message = {
      id: `m${Date.now()}`,
      text: `Sent ৳${amount.toLocaleString()} to ${phone}`,
      time: timeStr,
      sent: true,
      status: "sent",
      type: "money",
      amount,
      txnId,
    };
    updateContact(contactId, (c) => ({
      ...c,
      messages: [...c.messages, moneyMsg],
      lastMsg: `💸 Sent ৳${amount.toLocaleString()}`,
      lastTime: "now",
      unread: 0,
    }));
    const contact = contacts.find((c) => c.id === contactId);
    if (contact?.online) {
      const MONEY_REPLIES = ["Received! Thank you 🙏", "Got it, thanks! 💚", "Received ৳" + amount.toLocaleString() + " ✓", "Thank you so much! 😊"];
      const reply = MONEY_REPLIES[Math.floor(Math.random() * MONEY_REPLIES.length)];
      setTimeout(() => {
        addInboxMsg();
        updateContact(contactId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            moneyMsg,
            {
              id: `m${Date.now() + 1}`,
              text: reply,
              time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
              sent: false,
              status: "delivered" as const,
              type: "text" as const,
            },
          ],
          lastMsg: reply,
          lastTime: "now",
        }));
      }, 1500);
    }
  }, [contacts, updateContact]);

  const openChat = (contact: Contact) => {
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, unread: 0 } : c)));
    setActiveChat(contact);
  };

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0);

  const currentMessages =
    activeChat
      ? (contacts.find((c) => c.id === activeChat.id)?.messages ?? activeChat.messages)
      : [];

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
          <motion.button
            whileTap={{ scale: 0.88 }}
            className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow"
          >
            <Plus size={18} />
          </motion.button>
        </div>

        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-10 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
        </div>

        {/* Online contacts strip */}
        <div className="mb-4 -mx-1">
          <div className="flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
            {contacts.filter((c) => c.online).map((c) => (
              <button key={c.id} onClick={() => openChat(c)} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl ${c.gradient} flex items-center justify-center text-white font-bold text-sm shadow-card`}>
                    {c.initials}
                  </div>
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
              <motion.button
                key={contact.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 28 }}
                onClick={() => openChat(contact)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border hover:shadow-elevated active:scale-[0.98] transition-all text-left shadow-card"
              >
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-2xl ${contact.gradient} flex items-center justify-center text-white font-bold text-sm`}>
                    {contact.initials}
                  </div>
                  {contact.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-[13.5px] ${contact.unread > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/80"} truncate`}>
                      {contact.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{contact.lastTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-[12px] truncate ${contact.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {contact.lastMsg}
                    </p>
                    {contact.unread > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-2 min-w-[18px] h-[18px] px-1 gradient-send text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0"
                      >
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
              <div className="w-14 h-14 rounded-3xl bg-muted flex items-center justify-center">
                <Search size={22} />
              </div>
              <p className="text-sm font-semibold">No contacts found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Chat overlay ── */}
      <AnimatePresence>
        {activeChat && (
          <motion.div
            key="chat"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-0 z-[60]"
          >
            <ChatView
              contact={activeChat}
              messages={currentMessages}
              onBack={() => setActiveChat(null)}
              onSend={(text) => handleSend(activeChat.id, text)}
              onReact={(msgId, emoji) => handleReact(activeChat.id, msgId, emoji)}
              onSendMoney={(phone) => {
                const chatId = activeChat.id;
                const chatContact = activeChat;
                setActiveChat(null);
                onSendMoney?.(phone, (amount) => {
                  handleSendMoneyMsg(chatId, amount, chatContact.phone);
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
