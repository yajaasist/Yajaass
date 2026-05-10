import React, { useState, useRef } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { motion } from "framer-motion";

export default function RAPassengerChat({ ride, user, onClose }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ["passengerChat", ride.id],
    queryFn: () => supabaseApi.chats.list({ ride_id: ride.id }),
    refetchInterval: false,
    enabled: !!ride.id,
  });

  type ChatMessage = {
    id: string;
    ride_id: string;
    sender_role?: string;
    sender_name?: string;
    message?: string;
    read_by_passenger?: boolean;
    [key: string]: any;
  };

  React.useEffect(() => {
    if (!ride.id) return;
    const channel = supabase.channel(`realtime:ChatMessage:${ride.id}`);
    const sub = channel.on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `ride_id=eq.${ride.id}` }, (event) => {
      const msg = event.new as ChatMessage | null;
      if (!msg || msg.ride_id !== ride.id) return;
      queryClient.setQueryData<ChatMessage[]>(["passengerChat", ride.id], (old = []) => {
        if (event.eventType === "DELETE") return old.filter(m => m.id !== msg.id);
        const idx = old.findIndex(m => m.id === msg.id);
        if (idx === -1) return [...old, msg];
        return old.map(m => m.id === msg.id ? { ...m, ...msg } : m);
      });
    }).subscribe();
    return () => { channel.unsubscribe(); };
  }, [ride.id, queryClient]);

  const prevCountRef = React.useRef(0);
  React.useEffect(() => {
    const unread = messages.filter(m => (m.sender_role === "driver" || m.sender_role === "admin") && !m.read_by_passenger);
    // Play notification sound when new message arrives
    if (unread.length > prevCountRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
        setTimeout(() => ctx.close(), 500);
      } catch (_) {}
    }
    prevCountRef.current = unread.length;
    unread.forEach(m => supabaseApi.chats.update(m.id, { read_by_passenger: true }));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    await supabaseApi.chats.create({
      ride_id: ride.id,
      sender_role: "passenger",
      sender_name: user?.full_name || "Pasajero",
      message: message.trim(),
      read_by_driver: false,
      read_by_admin: false,
      read_by_passenger: true,
    });
    setMessage("");
    queryClient.invalidateQueries({ queryKey: ["passengerChat", ride.id] });
    setSending(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60">✕</button>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-400" />
          <span className="text-white font-bold">Chat con conductor</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && <p className="text-xs text-white/30 text-center pt-8">Sin mensajes aún. Inicia la conversación.</p>}
        {messages.map(msg => {
          const isMe = msg.sender_role === "passenger";
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-white/10 text-white/80 rounded-bl-sm"}`}>
                {!isMe && <p className="text-[10px] font-semibold mb-0.5 text-blue-300">{msg.sender_name || "Conductor"}</p>}
                <p>{msg.message}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0">
        <input value={message} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-2xl px-4 py-2.5 text-sm outline-none" />
        <button onClick={sendMessage} disabled={!message.trim() || sending}
          className="w-11 h-11 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </motion.div>
  );
}
