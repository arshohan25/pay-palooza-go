import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MessageCircle, Users, AlertTriangle, Search, RefreshCw, Eye, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface ConvRow {
  id: string;
  name: string | null;
  type: string;
  status: string;
  created_at: string;
  participants?: { user_id: string }[];
  lastMessage?: string;
}

interface MessageRow {
  id: string;
  content: string;
  sender_id: string;
  message_type: string;
  created_at: string;
  is_deleted: boolean;
  senderName?: string;
}

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "chat_conversation", entity_id: entityId, details
    });
  }
}

export default function AdminChatMonitor() {
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 });

  const loadConversations = async () => {
    setLoading(true);
    const { data: convs } = await supabase
      .from("chat_conversations")
      .select("id, name, type, status, created_at")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (convs) {
      const enriched: ConvRow[] = [];
      for (const c of convs) {
        const { data: parts } = await supabase
          .from("chat_participants")
          .select("user_id")
          .eq("conversation_id", c.id);
        const { data: lastMsg } = await supabase
          .from("chat_messages")
          .select("content")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);
        enriched.push({
          ...c,
          participants: parts?.map(p => ({ user_id: p.user_id })) ?? [],
          lastMessage: lastMsg?.[0]?.content ?? "No messages",
        });
      }
      setConversations(enriched);
      setStats({
        total: convs.length,
        active: convs.filter(c => c.status === "active").length,
        pending: convs.filter(c => c.status === "pending").length,
      });
    }
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, []);

  const viewMessages = async (convId: string) => {
    setSelectedConv(convId);
    setLoadingMsgs(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("id, content, sender_id, message_type, created_at, is_deleted")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", senderIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.name]) ?? []);
      setMessages(data.map(m => ({ ...m, senderName: profileMap.get(m.sender_id) ?? "Unknown" })));
    }
    setLoadingMsgs(false);
  };

  const deleteConversation = async (convId: string) => {
    await supabase.from("chat_messages").delete().eq("conversation_id", convId);
    await supabase.from("chat_participants").delete().eq("conversation_id", convId);
    const { error } = await supabase.from("chat_conversations").delete().eq("id", convId);
    if (error) { toast.error(error.message); return; }
    await auditLog("conversation_deleted", convId, {});
    toast.success("Conversation deleted");
    loadConversations();
  };

  const flagConversation = async (convId: string, currentStatus: string) => {
    const newStatus = currentStatus === "flagged" ? "active" : "flagged";
    const { error } = await supabase.from("chat_conversations").update({ status: newStatus }).eq("id", convId);
    if (error) { toast.error(error.message); return; }
    await auditLog(newStatus === "flagged" ? "conversation_flagged" : "conversation_unflagged", convId, {});
    toast.success(newStatus === "flagged" ? "Flagged for review" : "Unflagged");
    loadConversations();
  };

  const filtered = conversations.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Chats</p>
              <p className="text-xl font-bold text-foreground">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold text-foreground">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-foreground">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" onClick={loadConversations} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">All Conversations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <div className="divide-y divide-border/50">
              {filtered.map(conv => (
                <div key={conv.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {conv.name || `Chat ${conv.id.slice(0, 8)}`}
                      </p>
                      <Badge variant="outline" className="text-[9px]">{conv.type}</Badge>
                      <Badge variant={conv.status === "active" ? "secondary" : conv.status === "flagged" ? "destructive" : "outline"} className="text-[9px]">
                        {conv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {conv.participants?.length ?? 0} participants · {new Date(conv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => viewMessages(conv.id)}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                    <Button variant="ghost" size="icon" className={`h-8 w-8 ${conv.status === "flagged" ? "text-amber-500" : "text-muted-foreground"}`}
                      onClick={() => flagConversation(conv.id, conv.status)}>
                      <Flag className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
                          <AlertDialogDescription>All messages and participant data will be permanently removed.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteConversation(conv.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {loading ? "Loading..." : "No conversations found"}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Sheet open={!!selectedConv} onOpenChange={() => setSelectedConv(null)}>
        <SheetContent side="right" className="w-[90vw] max-w-lg p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="text-sm">Messages</SheetTitle>
            <SheetDescription className="text-xs">
              Conversation: {selectedConv?.slice(0, 8)}...
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4 py-3">
            {loadingMsgs ? (
              <p className="text-center text-muted-foreground py-8">Loading messages...</p>
            ) : (
              <div className="space-y-2">
                {messages.map(msg => (
                  <div key={msg.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{msg.senderName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className={`text-xs ${msg.is_deleted ? "text-muted-foreground italic" : "text-foreground"}`}>
                      {msg.is_deleted ? "[Deleted]" : msg.content}
                    </p>
                    <Badge variant="outline" className="text-[8px] mt-1">{msg.message_type}</Badge>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No messages</p>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
