"use client";

import React, { useEffect, useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Shows active announcements to the user on app open.
 * @param {string} audience - "drivers" | "passengers"
 * @param {string} cityId - optional city filter
 * @param {string} serviceTypeId - optional service type filter
 * @param {string} storageKey - localStorage key to track shown announcements
 */
export default function AnnouncementModal({ audience, cityId, serviceTypeId, storageKey = "shown_announcements" }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const all = await supabaseApi.announcements.list();
      const shown = JSON.parse(localStorage.getItem(storageKey) || "[]");

      const eligible = all.filter(a => {
        if (!a.is_active) return false;
        if (a.expires_at && new Date(a.expires_at) < now) return false;
        if (a.show_from && new Date(a.show_from) > now) return false;
        if (a.target_audience && a.target_audience !== "all" && a.target_audience !== audience) return false;
        if (a.filter_city_id && cityId && a.filter_city_id !== cityId) return false;
        if (a.filter_service_type_id && serviceTypeId && a.filter_service_type_id !== serviceTypeId) return false;
        if (shown.includes(a.id)) return false;
        return true;
      });

      if (eligible.length > 0) {
        setQueue(eligible);
        setCurrent(eligible[0]);
      }
    };
    load();
  }, [audience, cityId, serviceTypeId, storageKey]);

  const dismiss = () => {
    if (!current) return;
    // Mark as shown
    const shown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    localStorage.setItem(storageKey, JSON.stringify([...shown, current.id]));

    const next = queue.slice(1);
    setQueue(next);
    setCurrent(next[0] || null);
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-[#12121a] border border-white/10 rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl"
          >
            {current.image_url && (
              <img src={current.image_url} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-white font-bold text-lg leading-tight">{current.title}</h2>
                <button onClick={dismiss} className="text-white/30 hover:text-white/60 flex-shrink-0 mt-0.5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{current.body}</p>
              {queue.length > 1 && (
                <p className="text-white/30 text-xs mt-3">{queue.length - 1} anuncio{queue.length - 1 !== 1 ? "s" : ""} más</p>
              )}
              <button
                onClick={dismiss}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white font-semibold text-sm hover:opacity-90 transition-all"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
