"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { supabaseApi } from "@/lib/supabaseApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface ChatInterfaceProps {
  conversationId: string;
  currentUserRole: 'admin' | 'driver' | 'passenger';
  currentUserName: string;
  readField: 'read_by_admin' | 'read_by_driver' | 'read_by_passenger';
}

export default function ChatInterface({
  conversationId,
  currentUserRole,
  currentUserName,
  readField
}: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Mensajes de la conversación
  const { data: messages = [] } = useQuery({
    queryKey: ["chatMessages", conversationId],
    queryFn: () => supabaseApi.chats.listMessages(conversationId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Suscripción en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
          queryClient.setQueryData(["chatMessages", conversationId], (old: any = []) => {
            if (payload.eventType === "DELETE") return old.filter((m: any) => m.id !== payload.old.id);
            if (payload.eventType === "INSERT") return [...old, payload.new];
            if (payload.eventType === "UPDATE") return old.map((m: any) => m.id === payload.new.id ? { ...m, ...payload.new } : m);
            return old;
          });
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [conversationId, queryClient]);

  // Scroll automático
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Marcar mensajes como leídos
  useEffect(() => {
    const unread = messages.filter((m: any) =>
      m.sender_role !== currentUserRole && !m[readField]
    );
    unread.forEach(async (m: any) => {
      try {
        await supabaseApi.chats.update(m.id, { [readField]: true });
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    });
  }, [messages, currentUserRole, readField]);

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      await supabaseApi.chats.create({
        conversation_id: conversationId,
        sender_role: currentUserRole,
        sender_name: currentUserName,
        message: messageText.trim(),
        [readField]: true,
        read_by_admin: currentUserRole === 'admin',
        read_by_driver: currentUserRole === 'driver',
        read_by_passenger: currentUserRole === 'passenger',
      });
      setMessageText("");
      toast.success("Mensaje enviado");
    } catch (error: any) {
      toast.error(error.message || "Error al enviar mensaje");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            Sin mensajes aún. Inicia la conversación.
          </div>
        )}
        {messages.map((msg: any) => {
          const isCurrentUser = msg.sender_role === currentUserRole;
          return (
            <div key={msg.id} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                isCurrentUser ? "bg-blue-600 text-white rounded-br-sm" :
                msg.sender_role === 'admin' ? "bg-slate-100 text-slate-900 rounded-bl-sm" :
                msg.sender_role === 'driver' ? "bg-green-100 text-green-900 rounded-bl-sm" :
                "bg-purple-100 text-purple-900 rounded-bl-sm"
              }`}>
                {!isCurrentUser && (
                  <p className={`text-xs font-semibold mb-1 ${
                    msg.sender_role === 'admin' ? "text-slate-600" :
                    msg.sender_role === 'driver' ? "text-green-600" :
                    "text-purple-600"
                  }`}>
                    {msg.sender_name || (
                      msg.sender_role === 'admin' ? "Administrador" :
                      msg.sender_role === 'driver' ? "Conductor" :
                      "Pasajero"
                    )}
                  </p>
                )}
                <p>{msg.message}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className={`text-xs ${isCurrentUser ? "text-blue-200" : "text-slate-400"}`}>
                    {new Date(msg.created_at || msg.id).toLocaleTimeString()}
                  </span>
                  {isCurrentUser && (
                    <span className={`text-xs font-semibold ${
                      msg.read_by_admin || msg.read_by_driver || msg.read_by_passenger ?
                      "text-blue-200" : "text-slate-300"
                    }`}>
                      ✓
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white flex gap-2">
        <Input
          placeholder="Escribe un mensaje..."
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-xl"
        />
        <Button
          onClick={sendMessage}
          disabled={!messageText.trim() || sending}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}