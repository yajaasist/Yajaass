/**
 * LiveETABadge.tsx
 * 
 * Badge que muestra ETA dinámica en tiempo real con información de tráfico
 * Se utiliza durante viajes en progreso
 */
import React from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { useDynamicETA, formatETARange, getTrafficEmoji, type ETAInfo } from "@/hooks/useDynamicETA";

interface LiveETABadgeProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  updateIntervalSec?: number;
  trafficLightThresholdMin?: number;
  trafficModerateThresholdMin?: number;
  uncertaintyFactor?: number;
  mapsProvider?: string;
  googleMapsApiKey?: string;
  compact?: boolean; // If true, show minimal version
}

export default function LiveETABadge({
  originLat,
  originLng,
  destLat,
  destLng,
  updateIntervalSec = 30,
  trafficLightThresholdMin = 20,
  trafficModerateThresholdMin = 40,
  uncertaintyFactor = 0.2,
  mapsProvider = "osrm",
  googleMapsApiKey,
  compact = false,
}: LiveETABadgeProps) {
  const eta = useDynamicETA({
    originLat,
    originLng,
    destLat,
    destLng,
    enabled: !!(originLat && originLng && destLat && destLng),
    updateIntervalSec,
    trafficLightThresholdMin,
    trafficModerateThresholdMin,
    mapsProvider,
    googleMapsApiKey,
  });

  if (!eta) {
    return (
      <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
        <span className="text-xs font-semibold text-slate-600">Calculando ETA...</span>
      </div>
    );
  }

  const trafficEmoji = getTrafficEmoji(eta.trafficStatus);
  const etaText = formatETARange(eta, uncertaintyFactor);
  const wasRecentlyUpdated = eta.updateCounter > 1;

  if (compact) {
    return (
      <motion.div
        key={eta.updateCounter}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-2.5 py-1"
      >
        <Clock className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-xs font-bold text-slate-700">{etaText}</span>
        {eta.trafficStatus && <span className="text-xs">{trafficEmoji}</span>}
      </motion.div>
    );
  }

  return (
    <motion.div
      key={eta.updateCounter}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl p-3 space-y-2 border ${getBorderClass(eta.trafficStatus)}`}
    >
      {/* Header with distance */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-600">Tiempo estimado</p>
            <p className="text-lg font-black text-slate-800">{etaText}</p>
          </div>
        </div>
        {eta.trafficStatus && (
          <div className="text-right flex items-center gap-1">
            <span className="text-2xl">{trafficEmoji}</span>
            <span className="text-[10px] font-bold uppercase text-slate-500">
              {eta.trafficStatus === "light"
                ? "Libre"
                : eta.trafficStatus === "moderate"
                ? "Moderado"
                : "Congestionado"}
            </span>
          </div>
        )}
      </div>

      {/* Distance info */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Distancia: <strong className="text-slate-700">{eta.distanceKm.toFixed(1)} km</strong>
        </span>
        {wasRecentlyUpdated && (
          <motion.span
            animate={{ opacity: [0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1 text-amber-600 font-semibold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Actualizado
          </motion.span>
        )}
      </div>

      {/* Traffic warning */}
      {eta.trafficStatus === "heavy" && (
        <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2 py-1.5 text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <p className="text-xs font-semibold">
            {eta.durationMin > 60 ? "Tráfico muy congestionado" : "Tráfico moderado"}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function getBorderClass(trafficStatus?: "light" | "moderate" | "heavy"): string {
  switch (trafficStatus) {
    case "light":
      return "bg-emerald-50 border-emerald-200";
    case "moderate":
      return "bg-amber-50 border-amber-200";
    case "heavy":
      return "bg-red-50 border-red-200";
    default:
      return "bg-slate-50 border-slate-200";
  }
}
