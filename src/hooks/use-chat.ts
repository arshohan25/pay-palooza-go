import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Json } from "@/integrations/supabase/types";
import {
  getOrCreateConversationKey,
  encryptMessage,
  tryDecryptMessage,
} from "@/lib/chatCrypto";
import { addInboxMsg } from "@/lib/inboxStore";

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
  created_at: string;
  updated_at: string;
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
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const activeConvRef = useRef<string | null>(null);
  activeConvRef.current = activeConversationId;

  // ── Load conversations ──────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;

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
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, phone, avatar_url")
      .in("user_id", participantUserIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.user_id, p])
    );

    // Get last message for each conversation
    const lastMessages: Map<string, ChatMessage> = new Map();
    for (const convId of convIds) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (msgs && msgs.length > 0) {
        const msg = msgs[0];
        // Try decrypt
        try {
          const key = await getOrCreateConversationKey(convId);
          const decrypted = await tryDecryptMessage(
            msg.content,
            msg.is_encrypted,
            key
          );
          lastMessages.set(convId, {
            ...msg,
            message_type: msg.message_type as ChatMessage["message_type"],
            metadata: (msg.metadata as Record<string, unknown>) ?? {},
            decryptedContent: decrypted,
          });
        } catch {
          lastMessages.set(convId, {
            ...msg,
            message_type: msg.message_type as ChatMessage["message_type"],
            metadata: (msg.metadata as Record<string, unknown>) ?? {},
            decryptedContent: msg.content,
          });
        }
      }
    }

    // Count unread messages per conversation
    const unreadCounts: Map<string, number> = new Map();
    for (const convId of convIds) {
      const lastRead = lastReadMap.get(convId);
      if (lastRead) {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .neq("sender_id", user.id)
          .gt("created_at", lastRead);
        unreadCounts.set(convId, count ?? 0);
      } else {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .neq("sender_id", user.id);
        unreadCounts.set(convId, count ?? 0);
      }
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
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        participants: parts,
        lastMessage: lastMessages.get(conv.id) ?? null,
        unreadCount: unreadCounts.get(conv.id) ?? 0,
      };
    });

    setConversations(mapped);
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
      .channel("chat-realtime-combined")
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

          // If viewing this conversation, add to messages
          if (activeConvRef.current === newMsg.conversation_id) {
            setMessages((prev) => [...prev, newMsg]);
          }

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

      const key = await getOrCreateConversationKey(conversationId);
      const encrypted = await encryptMessage(text, key);

      const newMsg = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: encrypted,
        is_encrypted: true,
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
    async (otherUserId: string) => {
      if (!user) return null;

      // Check if direct conversation already exists
      const { data: myConvIds } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (myConvIds && myConvIds.length > 0) {
        const ids = myConvIds.map((r) => r.conversation_id);
        const { data: otherConvIds } = await supabase
          .from("chat_participants")
          .select("conversation_id")
          .eq("user_id", otherUserId)
          .in("conversation_id", ids);

        if (otherConvIds && otherConvIds.length > 0) {
          // Check if any is a direct conversation
          for (const row of otherConvIds) {
            const { data: conv } = await supabase
              .from("chat_conversations")
              .select("*")
              .eq("id", row.conversation_id)
              .eq("type", "direct")
              .single();
            if (conv) return conv.id;
          }
        }
      }

      // Create new conversation
      const { data: conv, error: convError } = await supabase
        .from("chat_conversations")
        .insert({ type: "direct" })
        .select()
        .single();

      if (convError || !conv) return null;

      // Add both participants
      await supabase.from("chat_participants").insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: otherUserId },
      ]);

      await loadConversations();

      // Send a notification to the other user
      try {
        const senderProfile = await supabase
          .from("profiles")
          .select("name, phone")
          .eq("user_id", user.id)
          .single();

        const senderName = senderProfile.data?.name || senderProfile.data?.phone || "Someone";

        await supabase.from("notifications").insert({
          user_id: otherUserId,
          title: "New Message Request",
          body: `${senderName} wants to chat with you`,
          category: "chat",
          metadata: { conversation_id: conv.id, sender_id: user.id } as unknown as Json,
        });
      } catch (e) {
        console.warn("Failed to send chat notification:", e);
      }

      return conv.id;
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
    // Normalize: strip spaces, dashes
    const normalized = phone.replace(/[\s\-]/g, "");

    // Try exact match first
    const { data } = await supabase
      .from("profiles")
      .select("user_id, name, phone, avatar_url")
      .eq("phone", normalized)
      .maybeSingle();

    if (data) return data;

    // Fallback: try with @easypay.local suffix (legacy data)
    const { data: fallback } = await supabase
      .from("profiles")
      .select("user_id, name, phone, avatar_url")
      .eq("phone", `${normalized}@easypay.local`)
      .maybeSingle();

    return fallback;
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
    loadConversations,
  };
}
