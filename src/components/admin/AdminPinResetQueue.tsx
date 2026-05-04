import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, KeyRound, CheckCircle2, Phone, Clock, FileText, Download } from "lucide-react";
import { toast } from "sonner";

interface Request {
  id: string;
  phone: string;
  note: string | null;
  source: string;
  status: string;
  created_at: string;
}

interface Message {
  id: string;
  request_id: string;
  sender_role: "merchant" | "admin" | "system";
  content: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_merchant: boolean;
  read_by_admin_at?: string | null;
  attachment_path?: string | null;
  attachment_mime?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
}

function formatBytes(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function maskPhone(p: string) {
  if (p.length !== 11) return p;
  return `${p.slice(0, 3)}••••••${p.slice(8)}`;
}

export default function AdminPinResetQueue() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [unreadByReq, setUnreadByReq] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => requests.find((r) => r.id === selectedId) ?? null, [requests, selectedId]);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("merchant_pin_reset_requests")
      .select("id, phone, note, source, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setRequests((data ?? []) as Request[]);

    const { data: unread } = await supabase
      .from("merchant_pin_reset_messages")
      .select("request_id")
      .eq("read_by_admin", false)
      .eq("sender_role", "merchant");
    const counts: Record<string, number> = {};
    (unread ?? []).forEach((m: any) => { counts[m.request_id] = (counts[m.request_id] ?? 0) + 1; });
    setUnreadByReq(counts);
    setLoadingList(false);
  };

  useEffect(() => {
    void loadRequests();
    const ch = supabase
      .channel("admin-pin-reset-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_pin_reset_requests" }, () => void loadRequests())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "merchant_pin_reset_messages" }, () => void loadRequests())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoadingChat(true);
    setMessages([]);

    const load = async () => {
      const { data } = await supabase
        .from("merchant_pin_reset_messages")
        .select("*")
        .eq("request_id", selectedId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []) as Message[]);
      setLoadingChat(false);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });

      // Mark merchant messages as read (with timestamp so the merchant sees "Seen at ...")
      await supabase
        .from("merchant_pin_reset_messages")
        .update({ read_by_admin: true, read_by_admin_at: new Date().toISOString() })
        .eq("request_id", selectedId)
        .eq("sender_role", "merchant")
        .eq("read_by_admin", false);
      setUnreadByReq((prev) => { const next = { ...prev }; delete next[selectedId]; return next; });
    };
    void load();

    const ch = supabase
      .channel(`admin-pin-reset-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "merchant_pin_reset_messages", filter: `request_id=eq.${selectedId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [selectedId]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setReply("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("merchant_pin_reset_messages").insert({
      request_id: selectedId,
      sender_role: "admin",
      sender_admin_id: user?.id ?? null,
      content: text,
      read_by_admin: true,
      read_by_merchant: false,
    });
    if (error) { toast.error(error.message); setReply(text); }
    setSending(false);
  };

  const markResolved = async () => {
    if (!selectedId) return;
    const { error } = await supabase
      .from("merchant_pin_reset_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", selectedId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("merchant_pin_reset_messages").insert({
      request_id: selectedId, sender_role: "system",
      content: "✅ Ticket marked resolved by support. You can now sign in with your new PIN.",
      read_by_admin: true, read_by_merchant: false,
    });
    toast.success("Ticket resolved");
  };

  return (
    <div className="grid h-[calc(100vh-180px)] grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
      {/* List */}
      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">PIN Reset Queue</h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">{requests.filter((r) => r.status === "open").length} open</Badge>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <p className="px-3 py-10 text-center text-xs text-muted-foreground">No requests yet.</p>
          ) : requests.map((r) => {
            const unread = unreadByReq[r.id] ?? 0;
            const otpVerified = (r.note ?? "").startsWith("[OTP-VERIFIED");
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left text-xs transition hover:bg-muted/60 ${selectedId === r.id ? "bg-muted/60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    +88 {maskPhone(r.phone)}
                  </span>
                  {unread > 0 && <Badge className="h-4 bg-rose-500 px-1.5 text-[9px] text-white">{unread}</Badge>}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={r.status === "open" ? "default" : "secondary"} className="h-4 px-1.5 text-[9px] capitalize">{r.status}</Badge>
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px]">{r.source}</Badge>
                  {otpVerified && <Badge className="h-4 bg-emerald-500/15 px-1.5 text-[9px] text-emerald-700">OTP</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Select a ticket to view the conversation.</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">+88 {maskPhone(selected.phone)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{selected.source} · {selected.status}</p>
              </div>
              {selected.status === "open" && (
                <Button size="sm" variant="outline" onClick={markResolved} className="h-7 text-[11px]">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                </Button>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/20 px-3 py-3">
              {selected.note && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                  <span className="font-semibold">Submitted note: </span>{selected.note}
                </div>
              )}
              {loadingChat ? (
                <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : messages.map((m) => {
                const isAdmin = m.sender_role === "admin";
                const isSystem = m.sender_role === "system";
                if (isSystem) {
                  return (
                    <div key={m.id} className="text-center text-[10px] text-muted-foreground">{m.content}</div>
                  );
                }
                return (
                  <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${isAdmin ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-background border"}`}>
                      {m.attachment_path && (
                        <AdminAttachment
                          path={m.attachment_path}
                          mime={m.attachment_mime}
                          name={m.attachment_name}
                          size={m.attachment_size}
                          isAdmin={isAdmin}
                        />
                      )}
                      {m.content && <p className="mt-1 break-words">{m.content}</p>}
                      <p className={`mt-0.5 text-[9px] ${isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); void sendReply(); }}
              className="flex items-center gap-2 border-t bg-background p-2"
            >
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={selected.status === "open" ? "Reply to merchant…" : "Ticket resolved"}
                disabled={sending || selected.status !== "open"}
                maxLength={2000}
                className="h-9 rounded-xl text-sm"
              />
              <Button type="submit" size="icon" disabled={!reply.trim() || sending || selected.status !== "open"} className="h-9 w-9 rounded-xl">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* Admin-side attachment: signed-URL fetched directly via supabase storage (admins are authenticated). */
function AdminAttachment({
  path,
  mime,
  name,
  size,
  isAdmin,
}: {
  path: string;
  mime?: string | null;
  name?: string | null;
  size?: number | null;
  isAdmin: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isImage = (mime ?? "").startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    if (!isImage) return;
    setLoading(true);
    supabase.storage
      .from("pin-reset-attachments")
      .createSignedUrl(path, 300)
      .then(({ data }) => { if (!cancelled) setUrl(data?.signedUrl ?? null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, isImage]);

  const openSigned = async () => {
    const { data } = await supabase.storage
      .from("pin-reset-attachments")
      .createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (isImage) {
    return (
      <button
        type="button"
        onClick={openSigned}
        className="block overflow-hidden rounded-lg border border-white/10"
        style={{ maxWidth: 220 }}
      >
        {loading || !url ? (
          <div className="flex h-32 w-32 items-center justify-center bg-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
          </div>
        ) : (
          <img src={url} alt={name ?? "attachment"} className="block max-h-[220px] w-auto" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openSigned}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${isAdmin ? "border-white/20 bg-white/10" : "border-border bg-muted/40"}`}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium">{name ?? "Attachment"}</p>
        <p className="text-[9px] opacity-70">{formatBytes(size)} · PDF</p>
      </div>
      <Download className="h-3 w-3 shrink-0 opacity-70" />
    </button>
  );
}

