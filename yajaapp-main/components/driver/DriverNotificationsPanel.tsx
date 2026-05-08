import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck, Megaphone } from "lucide-react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import { formatCDMX } from "@/components/shared/dateUtils";

export default function DriverNotificationsPanel({ driver }) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("driver_read_notifs") || "[]")); } catch { return new Set(); }
  });

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["driverNotifs", driver?.id],
    queryFn: async () => {
      const all = await supabaseApi.driverNotifications.list();
      return all.filter(n => !n.driver_ids?.length || n.driver_ids.includes(driver?.id));
    },
    enabled: !!driver?.id,
    refetchInterval: 15000,
  });

  // Refresh when panel opens
  useEffect(() => {
    if (open) refetch();
  }, [open]);

  const unread = notifications.filter(n => !readIds.has(n.id)).length;

  const markAllRead = () => {
    const newSet = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(newSet);
    localStorage.setItem("driver_read_notifs", JSON.stringify([...newSet]));
  };

  const markRead = (id) => {
    const newSet = new Set([...readIds, id]);
    setReadIds(newSet);
    localStorage.setItem("driver_read_notifs", JSON.stringify([...newSet]));
  };

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-end"
          style={{ zIndex: 99999 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: "80vh", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-lg">Notificaciones</h2>
                {unread > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs font-bold rounded-full px-2 py-0.5">{unread} nuevas</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-500 font-semibold flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" /> Leer todo
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <Megaphone className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-500">Sin notificaciones</p>
                  <p className="text-xs text-slate-400 mt-1">Aquí aparecerán los mensajes del administrador</p>
                </div>
              )}
              {notifications.map(n => {
                const isRead = readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left rounded-2xl p-4 border transition-colors ${isRead ? "bg-white border-slate-100" : "bg-blue-50 border-blue-100"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isRead ? "bg-slate-100" : "bg-blue-100"}`}>
                        <Megaphone className={`w-4 h-4 ${isRead ? "text-slate-400" : "text-blue-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-semibold leading-tight ${isRead ? "text-slate-600" : "text-slate-900"}`}>{n.title}</p>
                          {!isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className={`text-xs mt-0.5 leading-snug ${isRead ? "text-slate-400" : "text-slate-600"}`}>{n.body}</p>
                        <p className="text-[10px] text-slate-300 mt-1.5">{formatCDMX(n.created_at, "relative")}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen(true)}
        className="relative w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white flex-shrink-0"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel rendered via portal to escape header stacking context */}
      {typeof document !== "undefined" && ReactDOM.createPortal(panel, document.body)}
    </>
  );
}
