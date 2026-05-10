import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { Button } from "@/components/ui/button";
import { Star, X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * RARatingModal — shown after ride is completed
 * Props:
 *   ride     — the completed RideRequest
 *   driver   — the Driver record (for name/photo)
 *   onClose  — called after submitting (or skipping)
 */
export default function RARatingModal({ ride, driver, onClose }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      // Save rating to the ride
      await supabaseApi.rideRequests.update(ride.id, {
        passenger_rating_for_driver: rating,
        passenger_rating_comment: comment.trim() || undefined,
      });

      // Update driver's aggregate rating
      if (driver?.id) {
        const count = (driver.rating_count || 0) + 1;
        const newRating = parseFloat(
          (((driver.rating || 5) * (count - 1) + rating) / count).toFixed(2)
        );
        await supabaseApi.drivers.update(driver.id, {
          rating: newRating,
          rating_count: count,
        });
      }
    } catch {}
    setSubmitting(false);
    onClose();
  };

  const stars = [1, 2, 3, 4, 5];
  const effective = hovered || rating;

  const starLabels = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 260 }}
        className="w-full max-w-md bg-slate-800 rounded-t-3xl border-t border-white/10 px-5 pt-5 pb-8 space-y-5"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />

        {/* Skip */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">¿Cómo fue tu servicio?</h2>
            <p className="text-white/40 text-sm mt-0.5">Califica a tu conductor</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Driver info */}
        {driver && (
          <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3">
            {driver.photo_url ? (
              <img src={driver.photo_url} alt="" className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-black text-blue-400">{driver.full_name?.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm">{driver.full_name}</p>
              <p className="text-white/40 text-xs">
                {driver.vehicle_brand} {driver.vehicle_model} · {driver.license_plate}
              </p>
            </div>
          </div>
        )}

        {/* Stars */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-3">
            {stars.map(s => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(s)}
                className="transition-transform active:scale-90"
              >
                <Star
                  className={`w-10 h-10 transition-all duration-150 ${
                    s <= effective
                      ? "fill-amber-400 text-amber-400 scale-110"
                      : "text-white/20"
                  }`}
                />
              </button>
            ))}
          </div>
          {effective > 0 && (
            <p className="text-amber-300 text-sm font-semibold">{starLabels[effective]}</p>
          )}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Comentario opcional..."
          rows={2}
          className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-blue-500/50"
        />

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-white/40 text-sm border border-white/10 rounded-2xl hover:bg-white/5 transition-colors"
          >
            Omitir
          </button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 bg-amber-500 hover:bg-amber-400 rounded-2xl h-12 font-bold text-slate-900"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar calificación"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
