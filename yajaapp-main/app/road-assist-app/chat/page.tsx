"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import ChatInterface from "@/components/shared/ChatInterface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRoadAssistAuth } from "@/components/roadassist/useRoadAssistAuth";


export default function PassengerChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading } = useRoadAssistAuth();

  const { data: conversations = [] } = useQuery({
    queryKey: ["passengerConversations", user?.id],
    queryFn: () => supabaseApi.chats.listConversations(undefined, user?.id, 'passenger'),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Cargando tus chats...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-600">
          <p className="font-semibold mb-2">Necesitas iniciar sesión para ver tus chats.</p>
          <p className="text-sm">Por favor regresa a la app y autentícate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Mis Chats</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
          {/* Lista de conversaciones */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-slate-900">Conversaciones</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conversation: any) => {
                const lastMessage = conversation.chat_messages?.[conversation.chat_messages.length - 1];
                const unreadCount = conversation.chat_messages?.filter((m: any) =>
                  m.sender_role !== 'passenger' && !m.read_by_passenger
                ).length || 0;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`w-full p-4 text-left border-b hover:bg-slate-50 transition-colors ${
                      selectedConversationId === conversation.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {conversation.type === 'ride' ? 'Chat con conductor' :
                             conversation.type === 'passenger_admin' ? 'Chat con administrador' : 'Administración'}
                          </p>
                          {unreadCount > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">{unreadCount}</Badge>
                          )}
                        </div>
                        {conversation.type === 'ride' && conversation.ride_requests && (
                          <p className="text-xs text-slate-500">
                            Viaje: {conversation.ride_requests.pickup_address}
                          </p>
                        )}
                        {lastMessage && (
                          <p className="text-xs text-slate-400 truncate mt-1">
                            {lastMessage.sender_role === 'passenger' ? 'Tú: ' : ''}{lastMessage.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {conversations.length === 0 && (
                <div className="p-8 text-center">
                  <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No tienes conversaciones activas</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat interface */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {selectedConversation ? (
              <ChatInterface
                conversationId={selectedConversation.id}
                currentUserRole="passenger"
                currentUserName={user?.full_name || "Pasajero"}
                readField="read_by_passenger"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="w-14 h-14 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Selecciona una conversación</p>
                  <p className="text-sm text-slate-400 mt-1">para comenzar a chatear</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}