"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
import Layout from "@/components/admin/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { supabaseApi } from "@/lib/supabaseApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/shared/StatusBadge";
import ChatInterface from "@/components/shared/ChatInterface";
import { MessageCircle, Search } from "lucide-react";

export default function ChatsPage() {
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showBlockedWordsSettings, setShowBlockedWordsSettings] = useState(false);
  const [newBlockedWord, setNewBlockedWord] = useState("");
  const [blockedWords, setBlockedWords] = useState<string[]>(() => {
    try { return typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("chat_blocked_words") || "[]") : []; } catch { return []; }
  });
  const queryClient = useQueryClient();

  const saveBlockedWords = (words: string[]) => {
    setBlockedWords(words);
    if (typeof window !== 'undefined') {
      localStorage.setItem("chat_blocked_words", JSON.stringify(words));
    }
  };

  const addBlockedWord = () => {
    const w = newBlockedWord.trim().toLowerCase();
    if (!w || blockedWords.includes(w)) return;
    saveBlockedWords([...blockedWords, w]);
    setNewBlockedWord("");
  };

  const removeBlockedWord = (w: string) => saveBlockedWords(blockedWords.filter(b => b !== w));

  // Rides con mensajes activos o asignados
  const { data: rides = [] } = useQuery({
    queryKey: ["ridesWithMessages"],
    queryFn: async () => {
      try {
        return await supabaseApi.rideRequests.list();
      } catch (error) {
        console.error("Error fetching rides:", error);
        return [];
      }
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Obtener todas las conversaciones (admin ve todas)
  const { data: conversations = [] } = useQuery({
    queryKey: ["allConversations"],
    queryFn: async () => {
      try {
        return await supabaseApi.chats.listConversations();
      } catch (error) {
        console.error("Error fetching conversations:", error);
        return [];
      }
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Suscripción en tiempo real a conversaciones
  useEffect(() => {
    const channel = supabase
      .channel("admin_conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["allConversations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["allConversations"] });
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [queryClient]);



  // Filtrar conversaciones activas
  const activeConversations = conversations.filter((c: any) => {
    if (c.type === 'ride') {
      // Solo mostrar chats de viajes activos
      const ride = rides.find((r: any) => r.id === c.ride_id);
      return ride && ["assigned", "admin_approved", "en_route", "arrived", "in_progress"].includes(ride.status);
    }
    return true; // Mostrar chats admin-driver y admin-passenger siempre
  });

  const filteredConversations = activeConversations.filter((c: any) => {
    if (!search) return true;

    if (c.type === 'ride') {
      const ride = rides.find((r: any) => r.id === c.ride_id);
      return ride && (
        ride.passenger_name?.toLowerCase().includes(search.toLowerCase()) ||
        ride.driver_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Para chats admin, buscar en los mensajes
    const messages = c.chat_messages || [];
    return messages.some((m: any) =>
      m.sender_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.message?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const getUnreadCount = (conversation: any) =>
    (conversation.chat_messages || []).filter((m: any) =>
      !m.read_by_admin && (m.sender_role === "driver" || m.sender_role === "passenger")
    ).length;

  const selectedConversation = conversations.find((c: any) => c.id === selectedRideId);
  const selectedRide = selectedConversation?.type === 'ride' ?
    rides.find((r: any) => r.id === selectedConversation.ride_id) : null;

  const visibleRideIds = new Set(rides.filter((r: any) => r.driver_id).map((r: any) => r.id));
  const totalUnread = conversations
    .filter((c: any) => visibleRideIds.has(c.ride_id) || c.type !== 'ride')
    .reduce((sum: number, c: any) =>
      sum + (c.chat_messages || []).filter((m: any) =>
        !m.read_by_admin && (m.sender_role === "driver" || m.sender_role === "passenger")
      ).length, 0
    );

  return (
    <Layout currentPageName="Chats">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Chats</h1>
            {totalUnread > 0 && <Badge className="bg-red-500 text-white">{totalUnread}</Badge>}
          </div>
        </div>
      </div>
      <div className="flex gap-0 h-[calc(100vh-14rem)] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm mt-4">
        {/* Sidebar */}
        <div className="w-80 border-r flex flex-col flex-shrink-0">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              <p className="font-semibold text-slate-900">Conversaciones activas</p>
            </div>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="Buscar viaje o conductor..." className="pl-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation: any) => {
            const messages = conversation.chat_messages || [];
            const lastMsg = messages.sort((a: any, b: any) => (b.id || "").localeCompare(a.id || ""))[0];
            const unread = getUnreadCount(conversation);
            const isSelected = selectedRideId === conversation.id;

            let title = "";
            let subtitle = "";
            if (conversation.type === 'ride') {
              const ride = rides.find((r: any) => r.id === conversation.ride_id);
              title = ride?.passenger_name || "Viaje";
              subtitle = ride?.driver_name ? `${ride.driver_name} · ${ride.pickup_address}` : `Sin conductor · ${ride?.pickup_address}`;
            } else if (conversation.type === 'driver_admin') {
              title = "Chat con Conductor";
              subtitle = conversation.driver?.full_name || "Conductor";
            } else if (conversation.type === 'passenger_admin') {
              title = "Chat con Pasajero";
              subtitle = conversation.passenger?.full_name || "Pasajero";
            }

            return (
              <button
                key={conversation.id}
                onClick={() => setSelectedRideId(conversation.id)}
                className={`w-full p-3 text-left border-b hover:bg-slate-50 transition-colors ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
                      {unread > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">{unread}</span>}
                    </div>
                    <p className="text-xs text-blue-600 truncate">{subtitle}</p>
                    {lastMsg && <p className="text-xs text-slate-400 truncate mt-0.5">{lastMsg.sender_role === "admin" ? "Tú: " : ""}{lastMsg.message}</p>}
                    {!lastMsg && <p className="text-xs text-slate-300 italic mt-0.5">Sin mensajes aún</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {conversation.type === 'ride' && selectedRide && <StatusBadge status={selectedRide.status} label="" />}
                    {lastMsg && <span className="text-xs text-slate-300">—</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center">
              <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No hay conversaciones activas</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <div>
              {selectedConversation.type === 'ride' && selectedRide ? (
                <>
                  <p className="font-semibold text-slate-900">{selectedRide.passenger_name}</p>
                  <p className="text-xs text-slate-500">{selectedRide.driver_name} · {selectedRide.pickup_address}</p>
                </>
              ) : selectedConversation.type === 'driver_admin' ? (
                <>
                  <p className="font-semibold text-slate-900">Chat con Conductor</p>
                  <p className="text-xs text-slate-500">{selectedConversation.driver?.full_name}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-900">Chat con Pasajero</p>
                  <p className="text-xs text-slate-500">{selectedConversation.passenger?.full_name}</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedConversation.type === 'ride' && selectedRide && <StatusBadge status={selectedRide.status} label="" />}
              <button
                onClick={() => setShowBlockedWordsSettings(v => !v)}
                className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors"
                title="Palabras bloqueadas"
              >🚫 Filtros</button>
            </div>
          </div>
          {showBlockedWordsSettings && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 space-y-2">
              <p className="text-xs font-semibold text-amber-800">🚫 Palabras bloqueadas</p>
              <div className="flex gap-2">
                <input
                  value={newBlockedWord}
                  onChange={e => setNewBlockedWord(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addBlockedWord()}
                  placeholder="Agregar palabra..."
                  className="flex-1 border border-amber-200 rounded-lg px-2 py-1 text-xs"
                />
                <button onClick={addBlockedWord} className="bg-amber-600 text-white text-xs px-3 rounded-lg font-medium">+</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {blockedWords.map((w: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                    {w}
                    <button onClick={() => removeBlockedWord(w)} className="hover:text-red-900">×</button>
                  </span>
                ))}
                {blockedWords.length === 0 && <span className="text-xs text-amber-600 italic">Sin palabras bloqueadas</span>}
              </div>
            </div>
          )}

          {/* Chat Interface */}
          <ChatInterface
            conversationId={selectedConversation.id}
            currentUserRole="admin"
            currentUserName="Administrador"
            readField="read_by_admin"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200">
          <div>
            <MessageCircle className="w-14 h-14 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Selecciona una conversación para chatear</p>
            <p className="text-sm text-slate-400 mt-1">Los mensajes son en tiempo real</p>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
