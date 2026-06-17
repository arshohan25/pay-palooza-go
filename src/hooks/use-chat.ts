import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Json } from "@/integrations/supabase/types";
import {
  getOrCreateConversationKey,
  tryDecryptMessage,
} from "@/lib/chatCrypto";
import { addInboxMsg } from "@/lib/inboxStore";
import { playChatNotification, playChatRequestSound } from "@/lib/sounds";
import { haptics } from "@/lib/haptics";

// ── Types ────────────────────────────────────────────────────────────────
export interface ChatParticipant {
  user_id: string;
  conversation_id: string;
  last_read_at: string | null;
  profile?: {
    name: string | null;
    phone: string;
    avatar_url: string | null;
  };
}

export interface ChatConversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  group_icon: string | null;
  admin_id: string | null;
  status: "pending" | "accepted";
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
  participants: ChatParticipant[];
  lastMessage?: ChatMessage | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_encrypted: boolean;
  is_deleted: boolean;
  expires_at: string | null;
  message_type: "text" | "money" | "voice" | "image" | "order";
  metadata: Record<string, unknown>;
  created_at: string;
  // Client-side decrypted content
  decryptedContent?: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>(() => {
    try {
      const cached = localStorage.getItem("mfs_cached_conversations");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(() => {
    try { return !localStorage.getItem("mfs_cached_conversations"); } catch { return true; }
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const activeConvRef = useRef<string | null>(null);
  activeConvRef.current = activeConversationId;

  // ── Load conversations ──────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;

    // Get blocked users list
    let blockedUserIds: string[] = [];
    try {
      blockedUserIds = JSON.parse(localStorage.getItem("ep_blocked_users") || "[]");
    } catch {}

    // Get all conversation IDs for this user
    const { data: participantRows } = await supabase
      .from("chat_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);

    if (!participantRows || participantRows.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = participantRows.map((p) => p.conversation_id);
    const lastReadMap = new Map(
      participantRows.map((p) => [p.conversation_id, p.last_read_at])
    );

    // Load conversations
    const { data: convRows } = await supabase
      .from("chat_conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convRows) {
      setLoading(false);
      return;
    }

    // Load all participants for these conversations
    const { data: allParticipants } = await supabase
      .from("chat_participants")
      .select("conversation_id, user_id, last_read_at")
      .in("conversation_id", convIds);

    // Load profiles for all participants
    const participantUserIds = [
      ...new Set((allParticipants ?? []).map((p) => p.user_id)),
    ];
    // Use SECURITY DEFINER RPC to fetch profiles of chat participants (bypasses RLS)
    const { data: profiles } = await supabase.rpc(
      "get_chat_participant_profiles" as any,
      { p_user_ids: participantUserIds }
    );

    const profileMap = new Map(
      ((profiles as any[]) ?? []).map((p: any) => [p.user_id, p as { user_id: string; name: string | null; phone: string; avatar_url: string | null }])
    );

    // Get last message for each conversation — batch parallel
    const lastMessages: Map<string, ChatMessage> = new Map();
    const lastMsgPromises = convIds.map(async (convId) => {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (msgs && msgs.length > 0) {
        const msg = msgs[0];
        try {
          const key = await getOrCreateConversationKey(convId);
          const decrypted = await tryDecryptMessage(msg.content, msg.is_encrypted, key);
          return { convId, msg: { ...msg, message_type: msg.message_type as ChatMessage["message_type"], metadata: (msg.metadata as Record<string, unknown>) ?? {}, decryptedContent: decrypted } };
        } catch {
          return { convId, msg: { ...msg, message_type: msg.message_type as ChatMessage["message_type"], metadata: (msg.metadata as Record<string, unknown>) ?? {}, decryptedContent: msg.content } };
        }
      }
      return null;
    });

    // Count unread messages per conversation — batch parallel
    const unreadCounts: Map<string, number> = new Map();
    const unreadPromises = convIds.map(async (convId) => {
      const lastRead = lastReadMap.get(convId);
      const query = supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .neq("sender_id", user.id);
      if (lastRead) query.gt("created_at", lastRead);
      const { count } = await query;
      return { convId, count: count ?? 0 };
    });

    // Await all in parallel
    const [lastMsgResults, unreadResults] = await Promise.all([
      Promise.all(lastMsgPromises),
      Promise.all(unreadPromises),
    ]);

    for (const r of lastMsgResults) {
      if (r) lastMessages.set(r.convId, r.msg as ChatMessage);
    }
    for (const r of unreadResults) {
      unreadCounts.set(r.convId, r.count);
    }

    const mapped: ChatConversation[] = convRows.map((conv) => {
      const parts = (allParticipants ?? [])
        .filter((p) => p.conversation_id === conv.id)
        .map((p) => ({
          ...p,
          profile: profileMap.get(p.user_id) ?? undefined,
        }));

      return {
        id: conv.id,
        type: conv.type as "direct" | "group",
        name: conv.name,
        group_icon: conv.group_icon,
        admin_id: conv.admin_id,
        status: (conv.status ?? "accepted") as "pending" | "accepted",
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        metadata: (conv as any).metadata as Record<string, unknown> | null,
        participants: parts,
        lastMessage: lastMessages.get(conv.id) ?? null,
        unreadCount: unreadCounts.get(conv.id) ?? 0,
      };
    });

    // Filter out conversations with blocked users
    const filtered = blockedUserIds.length > 0
      ? mapped.filter((conv) => {
          if (conv.type !== "direct") return true;
          const otherParticipant = conv.participants.find((p) => p.user_id !== user.id);
          return !otherParticipant || !blockedUserIds.includes(otherParticipant.user_id);
        })
      : mapped;

    setConversations(filtered);
    try { localStorage.setItem("mfs_cached_conversations", JSON.stringify(filtered)); } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Participant read times for read receipts ─────────────────────────
  const [participantReadTimes, setParticipantReadTimes] = useState<
    Map<string, Map<string, string>>
  >(new Map());

  // Build participantReadTimes from conversations data
  useEffect(() => {
    const map = new Map<string, Map<string, string>>();
    for (const conv of conversations) {
      const userMap = new Map<string, string>();
      for (const p of conv.participants) {
        if (p.last_read_at) {
          userMap.set(p.user_id, p.last_read_at);
        }
      }
      map.set(conv.id, userMap);
    }
    setParticipantReadTimes(map);
  }, [conversations]);

  // ── Realtime subscription for new messages + participant reads ──────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Skip messages sent by self
          if (newMsg.sender_id === user.id) return;

          // Decrypt
          try {
            const key = await getOrCreateConversationKey(newMsg.conversation_id);
            const decrypted = await tryDecryptMessage(
              newMsg.content,
              newMsg.is_encrypted,
              key
            );
            newMsg.decryptedContent = decrypted;
          } catch {
            newMsg.decryptedContent = newMsg.content;
          }
          newMsg.metadata = (newMsg.metadata as Record<string, unknown>) ?? {};

          if (activeConvRef.current === newMsg.conversation_id) {
            setMessages((prev) => [...prev, newMsg]);
          }

          // Play sound + haptic for incoming message
          playChatNotification();
          haptics.notify();

          // Update conversation list
          setConversations((prev) => {
            const idx = prev.findIndex(
              (c) => c.id === newMsg.conversation_id
            );
            if (idx === -1) {
              // New conversation — reload
              loadConversations();
              return prev;
            }
            const updated = [...prev];
            const conv = { ...updated[idx] };
            conv.lastMessage = newMsg;
            conv.updated_at = newMsg.created_at;
            if (activeConvRef.current !== newMsg.conversation_id) {
              conv.unreadCount += 1;
              addInboxMsg();
            }
            updated.splice(idx, 1);
            updated.unshift(conv);
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_participants",
        },
        (payload) => {
          const newPart = payload.new as { conversation_id: string; user_id: string };
          // If current user was added to a new conversation, reload the list
          if (newPart.user_id === user.id) {
            loadConversations();
            // Play chat request sound + haptic
            playChatRequestSound();
            haptics.notify();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_conversations",
        },
        (payload) => {
          const updated = payload.new as { id: string; updated_at: string; name: string | null; group_icon: string | null };
          // Re-sort conversation list when updated_at changes
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === updated.id);
            if (idx === -1) return prev;
            const copy = [...prev];
            const conv = { ...copy[idx], updated_at: updated.updated_at, name: updated.name ?? copy[idx].name, group_icon: updated.group_icon ?? copy[idx].group_icon };
            copy.splice(idx, 1);
            // Insert sorted by updated_at desc
            const insertIdx = copy.findIndex((c) => c.updated_at < conv.updated_at);
            if (insertIdx === -1) copy.push(conv);
            else copy.splice(insertIdx, 0, conv);
            return copy;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
        },
        (payload) => {
          const updated = payload.new as {
            conversation_id: string;
            user_id: string;
            last_read_at: string | null;
          };
          // Skip own updates
          if (updated.user_id === user.id) return;
          if (!updated.last_read_at) return;

          // Update participant read times
          setParticipantReadTimes((prev) => {
            const next = new Map(prev);
            const convMap = new Map(next.get(updated.conversation_id) ?? []);
            convMap.set(updated.user_id, updated.last_read_at!);
            next.set(updated.conversation_id, convMap);
            return next;
          });

          // Also update the conversation's participant data
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== updated.conversation_id) return c;
              return {
                ...c,
                participants: c.participants.map((p) =>
                  p.user_id === updated.user_id
                    ? { ...p, last_read_at: updated.last_read_at }
                    : p
                ),
              };
            })
          );
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[chat-realtime] Channel error — will retry");
        } else if (status === "TIMED_OUT") {
          console.warn("[chat-realtime] Subscription timed out");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  // ── Load messages for active conversation ───────────────────────────
  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      setActiveConversationId(conversationId);
      setMessagesLoading(true);

      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      const key = await getOrCreateConversationKey(conversationId);

      const decrypted: ChatMessage[] = await Promise.all(
        (data ?? []).map(async (msg) => {
          const content = await tryDecryptMessage(
            msg.content,
            msg.is_encrypted,
            key
          );
          return {
            ...msg,
            message_type: msg.message_type as ChatMessage["message_type"],
            metadata: (msg.metadata as Record<string, unknown>) ?? {},
            decryptedContent: content,
          };
        })
      );

      setMessages(decrypted);
      setMessagesLoading(false);

      // Mark as read
      await supabase
        .from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);

      // Update unread count locally
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    },
    [user]
  );

  const closeConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  // ── Send message ────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      conversationId: string,
      text: string,
      messageType: ChatMessage["message_type"] = "text",
      metadata: Record<string, unknown> = {}
    ) => {
      if (!user) return;

      // Send as plaintext — E2E encryption is disabled because symmetric keys
      // are device-local and cannot be shared between participants safely.
      const newMsg = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: text,
        is_encrypted: false,
        message_type: messageType,
        metadata: metadata as Json,
      };

      const { data, error } = await supabase
        .from("chat_messages")
        .insert([newMsg])
        .select()
        .single();

      if (error) {
        console.error("Failed to send message:", error);
        return null;
      }

      // Update conversation updated_at
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      const sent: ChatMessage = {
        ...data,
        message_type: data.message_type as ChatMessage["message_type"],
        metadata: (data.metadata as Record<string, unknown>) ?? {},
        decryptedContent: text,
      };

      // Add to local messages
      setMessages((prev) => [...prev, sent]);

      // Update conversation list
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) return prev;
        const updated = [...prev];
        const conv = { ...updated[idx] };
        conv.lastMessage = sent;
        conv.updated_at = data.created_at;
        updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });

      return sent;
    },
    [user]
  );

  // ── Create direct conversation ──────────────────────────────────────
  const createDirectConversation = useCallback(
    async (otherUserId: string, metadata?: Record<string, unknown>) => {
      if (!user) return null;

      const { data, error } = await supabase.rpc(
        "create_direct_chat_request" as any,
        { p_other_user_id: otherUserId, p_metadata: metadata ?? null }
      );

      if (error || !data) {
        console.error("Failed to create direct chat request:", error);
        return null;
      }

      await loadConversations();
      return data as string;
    },
    [user, loadConversations]
  );

  // ── Create group conversation ───────────────────────────────────────
  const createGroupConversation = useCallback(
    async (name: string, icon: string, memberUserIds: string[]) => {
      if (!user) return null;

      const { data: conv, error: convError } = await supabase
        .from("chat_conversations")
        .insert({
          type: "group",
          name,
          group_icon: icon,
          admin_id: user.id,
        })
        .select()
        .single();

      if (convError || !conv) return null;

      const participants = [user.id, ...memberUserIds].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
      }));

      await supabase.from("chat_participants").insert(participants);

      await loadConversations();
      return conv.id;
    },
    [user, loadConversations]
  );

  // ── Find user by phone ──────────────────────────────────────────────
  const findUserByPhone = useCallback(async (phone: string) => {
    // Normalize to match backend lookup behavior
    let normalized = phone.replace(/\D/g, "");
    if (normalized.startsWith("88") && normalized.length > 11) {
      normalized = normalized.slice(2);
    }

    const { data, error } = await supabase.rpc(
      "find_chat_user_by_phone" as any,
      { p_phone: normalized }
    );

    if (error) {
      console.error("Failed to find user by phone:", error);
      return null;
    }

    if (!data || typeof data !== "object") return null;

    return data as {
      user_id: string;
      name: string | null;
      phone: string;
      avatar_url: string | null;
    };
  }, []);

  // ── Update group ────────────────────────────────────────────────────
  const updateGroup = useCallback(
    async (
      conversationId: string,
      updates: { name?: string; group_icon?: string }
    ) => {
      await supabase
        .from("chat_conversations")
        .update(updates)
        .eq("id", conversationId);
      await loadConversations();
    },
    [loadConversations]
  );

  const addGroupMember = useCallback(
    async (conversationId: string, userId: string) => {
      await supabase.from("chat_participants").insert({
        conversation_id: conversationId,
        user_id: userId,
      });
      await loadConversations();
    },
    [loadConversations]
  );

  const removeGroupMember = useCallback(
    async (conversationId: string, userId: string) => {
      await supabase
        .from("chat_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      await loadConversations();
    },
    [loadConversations]
  );

  // ── Accept / Decline conversation ────────────────────────────────
  const acceptConversation = useCallback(
    async (conversationId: string) => {
      await supabase
        .from("chat_conversations")
        .update({ status: "accepted" })
        .eq("id", conversationId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, status: "accepted" as const } : c
        )
      );
    },
    []
  );

  const declineConversation = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      // Remove self from participants
      await supabase
        .from("chat_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      // Remove from local state
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConvRef.current === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [user]
  );

  // ── Block & Report ──────────────────────────────────────────────────
  const blockAndReport = useCallback(
    async (conversationId: string, reason?: string) => {
      if (!user) return;

      // Find the other user (the sender/initiator)
      const conv = conversations.find((c) => c.id === conversationId);
      const otherUser = conv?.participants.find((p) => p.user_id !== user.id);
      const reportedUserId = otherUser?.user_id;

      if (reportedUserId) {
        // Insert fraud alert for admin review
        try {
          await supabase.from("fraud_alerts").insert({
            user_id: reportedUserId,
            rule_triggered: "user_report_spam",
            severity: "medium" as const,
            status: "open" as const,
            details: {
              reporter_id: user.id,
              conversation_id: conversationId,
              reason: reason || "Spam / unwanted chat request",
              reported_at: new Date().toISOString(),
            },
          });
        } catch (e) {
          console.warn("Failed to insert fraud alert:", e);
        }

        // Store in localStorage block list
        try {
          const blocked = JSON.parse(localStorage.getItem("ep_blocked_users") || "[]");
          if (!blocked.includes(reportedUserId)) {
            blocked.push(reportedUserId);
            localStorage.setItem("ep_blocked_users", JSON.stringify(blocked));
          }
        } catch {}
      }

      // Decline the conversation
      await declineConversation(conversationId);
    },
    [user, conversations, declineConversation]
  );

  // Total unread
  const totalUnread = conversations.reduce(
    (sum, c) => sum + c.unreadCount,
    0
  );

  return {
    conversations,
    loading,
    messages,
    messagesLoading,
    activeConversationId,
    totalUnread,
    participantReadTimes,
    openConversation,
    closeConversation,
    sendMessage,
    createDirectConversation,
    createGroupConversation,
    findUserByPhone,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    acceptConversation,
    declineConversation,
    blockAndReport,
    loadConversations,
  };
}
