import React, { useState, useEffect, useRef } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send } from "lucide-react";
import { playMessageSound } from "@/components/shared/useRideNotifications";

export default function DriverChat({ driver, ride }: { driver: any; ride: any }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const prevCountRef = useRef<number>(0);
  const isRideActive = !["completed", "cancelled"].includes(ride?.status);

  const { data: messages = [] } = useQuery({
    queryKey: ["chatMessages", ride.id],
    queryFn: () => supabaseApi.chats.list({ ride_id: ride.id }),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    enabled: !!ride.id,
  });

  useEffect(() => {
    if (!ride.id) return;
    // Set up real-time listener for chat messages
    const channel = supabase.channel(`chat-${ride.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `ride_id=eq.${ride.id}` }, (payload) => {
        queryClient.setQueryData(["chatMessages", ride.id], (old: any[] = []) => {
          if (payload.eventType === 'DELETE') return old.filter((m: any) => m.id !== payload.old.id);
          const idx = old.findIndex((m: any) => m.id === payload.new.id);
          if (idx === -1) return [...old, payload.new];
          return old.map((m: any) => m.id === payload.new.id ? payload.new : m);
        });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [ride.id, queryClient]);

  useEffect(() => {
    const newNonDriverMessages = messages.filter(m => (m.sender_role === "admin" || m.sender_role === "passenger") && !m.read_by_driver);
    // Notificar sonido + push si el viaje sigue activo y hay nuevos mensajes
    if (isRideActive && newNonDriverMessages.length > prevCountRef.current) {
      playMessageSound();
      const newest = newNonDriverMessages[newNonDriverMessages.length - 1];
      if (newest) {
        import("@/components/shared/usePushNotifications").then(({ showDriverNotification }) => {
          showDriverNotification({
            title: newest.sender_role === "passenger" ? "💬 Mensaje del pasajero" : "💬 Mensaje del administrador",
            body: newest.message,
            rideId: ride.id,
            tag: `chat-${newest.id}`,
          });
        });
      }
    }
    prevCountRef.current = newNonDriverMessages.length;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (isRideActive) {
      newNonDriverMessages.forEach(m => supabaseApi.chats.update(m.id, { read_by_driver: true }));
    }
  }, [messages, isRideActive]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    await supabaseApi.chats.create({
      ride_id: ride.id,
      sender_role: "driver",
      sender_name: driver.full_name,
      message: message.trim(),
      read_by_admin: false,
      read_by_driver: true,
    });
    setMessage("");
    queryClient.invalidateQueries({ queryKey: ["chatMessages", ride.id] });
    setSending(false);
  };

  const unreadCount = messages.filter(m => (m.sender_role === "admin" || m.sender_role === "passenger") && !m.read_by_driver).length;

  return (
    <div className="flex flex-col h-64 border rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 px-3 py-2 border-b flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-slate-700">Chat con administrador</span>
        {unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unreadCount}</span>}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && <p className="text-xs text-slate-400 text-center pt-4">Sin mensajes aún</p>}
        {messages.map(msg => {
          const isDriver = msg.sender_role === "driver";
          const isPassenger = msg.sender_role === "passenger";
          const isRead = isDriver && msg.read_by_admin;
          return (
            <div key={msg.id} className={`flex ${isDriver ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs ${
                isDriver ? "bg-blue-600 text-white" :
                isPassenger ? "bg-violet-100 text-violet-900" :
                "bg-slate-100 text-slate-900"
              }`}>
                {!isDriver && <p className={`text-[10px] font-semibold mb-0.5 ${isPassenger ? "text-violet-600" : "text-blue-600"}`}>{isPassenger ? "Pasajero" : "Admin"}</p>}
                <p>{msg.message}</p>
                {isDriver && (
                  <div className="flex justify-end mt-0.5">
                    <span className={`text-[9px] ${isRead ? "text-blue-200" : "text-blue-300/60"}`}>{isRead ? "✓✓" : "✓"}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {isRideActive ? (
        <div className="p-2 border-t flex gap-2">
          <Input placeholder="Mensaje..." value={message} onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()} className="text-xs h-10 rounded-lg flex-1" />
          <Button onClick={sendMessage} disabled={!message.trim() || sending} size="sm"
            className="h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 rounded-lg select-none">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="p-2 border-t text-center">
          <p className="text-xs text-slate-400">Solo lectura — viaje finalizado</p>
        </div>
      )}
    </div>
  );
}
