"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseApi } from "@/lib/supabaseApi";

const LABELS = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

/**
 * Generic rating modal for both drivers and passengers.
 *
 * Props:
 *  - ride: RideRequest object
 *  - raterRole: "driver" | "passenger"
 *  - targetName: name of the person being rated
 *  - targetPhoto: optional photo URL
 *  - onClose(skipped: boolean): called when modal closes
 */
export default function RatingModal({ ride, raterRole, targetName, targetPhoto, onClose }) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const isDriver = raterRole === "driver";
  const activeStars = hovered || stars;

  const handleSubmit = async () => {
    if (stars === 0) return;
    setSaving(true);

    const updates = isDriver
      ? { driver_rating_for_passenger: stars, driver_rating_comment: comment }
      : { passenger_rating_for_driver: stars, passenger_rating_comment: comment };

    await supabaseApi.rideRequests.update(ride.id, updates);

    // If passenger rates the driver, update driver's average rating
    if (!isDriver && ride.driver_id) {
      const allRides = await supabaseApi.rideRequests.list({ driver_id: ride.driver_id });
      const rated = allRides.filter(r => r.passenger_rating_for_driver > 0);
      if (rated.length > 0) {
        const avg = rated.reduce((s, r) => s + r.passenger_rating_for_driver, 0) / rated.length;
        await supabaseApi.drivers.update(ride.driver_id, { rating: parseFloat(avg.toFixed(1)) });
      }
    }

    setSaving(false);
    onClose(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/70 flex items-end"
      onClick={() => onClose(true)}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="w-full bg-white rounded-t-3xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xl text-slate-900">
            {isDriver ? "Califica al pasajero" : "Califica al conductor"}
          </h3>
          <button
            onClick={() => onClose(true)}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Target info */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
            {targetPhoto
              ? <img src={targetPhoto} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl font-black text-slate-400">{targetName?.charAt(0)}</span>
            }
          </div>
          <div>
            <p className="font-bold text-slate-900">{targetName}</p>
            <p className="text-xs text-slate-400">
              Servicio #{ride?.service_id || ride?.id?.slice(-6)}
            </p>
          </div>
        </div>

        {/* Stars */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onTouchStart={() => setHovered(s)}
                onClick={() => { setStars(s); setHovered(0); }}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  className={`w-10 h-10 transition-all ${
                    s <= activeStars
                      ? "fill-amber-400 text-amber-400 scale-110"
                      : "text-slate-200"
                  }`}
                />
              </button>
            ))}
          </div>
          {activeStars > 0 && (
            <p className="text-center text-sm font-semibold text-amber-500">
              {LABELS[activeStars]}
            </p>
          )}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Agrega un comentario (opcional)..."
          rows={3}
          className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onClose(true)}
            className="flex-1 py-3 text-sm text-slate-400 border border-slate-200 rounded-2xl font-medium"
          >
            Omitir
          </button>
          <Button
            onClick={handleSubmit}
            disabled={stars === 0 || saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-2xl min-h-[48px] text-sm font-bold"
          >
            {saving ? "Guardando..." : "Enviar calificación"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
