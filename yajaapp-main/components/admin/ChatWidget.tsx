"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, ChevronDown, ChevronUp, Loader } from "lucide-react";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  ride_id: string;
  sender_role: "admin" | "driver" | "passenger";
  sender_name?: string;
  message: string;
}

export default function ChatWidget({ ride }: { ride: any }) {
  const [showChat, setShowChat] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch chat messages
  const { data: chatMessages = [] } = useQuery({
    queryKey: ["rideChat", ride?.id],
    queryFn: async () => {
      try {
        const all = await supabaseApi.chats.list();
        return all.filter((m: any) => m.ride_id === ride.id).sort((a: any, b: any) => (a.id || "").localeCompare(b.id || ""));
      } catch (err) {
        console.error("Error fetching chat messages:", err);
        return [];
      }
    },
    enabled: !!ride?.id,
    staleTime: 0,
  });

  // Real-time subscription
  useEffect(() => {
    if (!ride?.id) return;

    const channel = supabase
      .channel(`chat_${ride.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `ride_id=eq.${ride.id}` },
        (payload: any) => {
          queryClient.setQueryData(["rideChat", ride.id], (old: any = []) => [...old, payload.new]);

          // Auto-scroll to bottom
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [ride?.id, queryClient]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (showChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, showChat]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    setIsSending(true);
    try {
      await supabaseApi.chats.create({
        ride_id: ride.id,
        sender_role: "admin",
        sender_name: "Admin",
        message: messageText.trim(),
      });

      setMessageText("");
      toast.success("Mensaje enviado");
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Error al enviar mensaje");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!ride?.id) return null;

  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
      {/* Header */}
      <button
        onClick={() => setShowChat((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1 hover:bg-slate-100 rounded-lg transition"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Chat {chatMessages.length > 0 ? `(${chatMessages.length})` : ""}
          </span>
        </div>
        {showChat ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Chat Content */}
      {showChat && (
        <div className="space-y-2 border-t pt-2">
          {/* Messages */}
          <div className="bg-white rounded-lg p-2 space-y-1.5 max-h-64 overflow-y-auto border border-slate-200">
            {chatMessages.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                📭 Sin mensajes. Inicia una conversación con el conductor o pasajero.
              </p>
            ) : (
              chatMessages.map((msg: ChatMessage) => {
                const isAdmin = msg.sender_role === "admin";
                const isPassenger = msg.sender_role === "passenger";

                return (
                  <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs px-3 py-1.5 rounded-lg text-xs break-words ${
                        isAdmin
                          ? "bg-slate-900 text-white"
                          : isPassenger
                          ? "bg-violet-100 text-violet-900"
                          : "bg-blue-100 text-blue-900"
                      }`}
                    >
                      {!isAdmin && (
                        <p
                          className={`text-[10px] font-semibold mb-0.5 ${
                            isPassenger ? "text-violet-600" : "text-blue-600"
                          }`}
                        >
                          {msg.sender_name || (isPassenger ? "Pasajero" : "Conductor")}
                        </p>
                      )}
                      <p className="leading-tight">{msg.message}</p>
                      <p className="text-[9px] opacity-60 mt-0.5">
                        —
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!["completed", "cancelled"].includes(ride?.status) && (
            <div className="flex gap-1.5 bg-white rounded-lg p-1.5 border border-slate-200">
              <Input
                placeholder="Escribe un mensaje..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className="text-xs h-8 rounded-lg border-slate-200"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={isSending || !messageText.trim()}
                className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg gap-1"
              >
                {isSending ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                {!isSending && "Enviar"}
              </Button>
            </div>
          )}

          {["completed", "cancelled"].includes(ride?.status) && (
            <p className="text-xs text-slate-400 text-center py-2">
              💬 Chat cerrado. El servicio ya fue completado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
