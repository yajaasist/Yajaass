import React, { useState, useEffect } from "react";
import { MapPin, Navigation, CheckCircle2, XCircle, Car, User, Clock, Building2, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { getRoute, getHaverDist } from "@/components/shared/mapsUtils";
import RideRejectionReasons from "./RideRejectionReasons";

// ─── Leaflet CSS injection ────────────────────────────────────────────────────
let _leafletCSSInjected = false;
function injectLeafletCSS() {
  if (_leafletCSSInjected || document.getElementById("leaflet-css-ira")) return;
  const link = document.createElement("link");
  link.id = "leaflet-css-ira";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  _leafletCSSInjected = true;
}

// ─── Leaflet custom icons ─────────────────────────────────────────────────────
const mkIcon = (color, size = 14) => L.divIcon({
  html: `<div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  iconSize: [size, size], iconAnchor: [size / 2, size / 2], className: "",
});

const pickupIcon = mkIcon("#10b981", 16);
const dropoffIcon = mkIcon("#ef4444", 16);
const driverIcon  = mkIcon("#3b82f6", 18);

// ─── Sound helpers ───────────────────────────────────────────────────────────
function playAlarmSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.5, now + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 0.3);
      osc.start(now + i * 0.4); osc.stop(now + i * 0.4 + 0.35);
    }
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

function playAcceptedSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [[520, 0], [660, 0.18], [880, 0.36]].forEach(([freq, when]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.4, now + when);
      gain.gain.exponentialRampToValueAtTime(0.001, now + when + 0.25);
      osc.start(now + when); osc.stop(now + when + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

export { playAcceptedSound };

// ─── Countdown ring ───────────────────────────────────────────────────────────
function CountdownRing({ value, total }) {
  const size = 96, stroke = 7, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (total > 0 ? value / total : 0);
  const urgent = value <= 10;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={urgent ? "#ef4444" : "#10b981"} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.9s linear, stroke 0.3s" }} />
      </svg>
      <div className="flex flex-col items-center justify-center z-10">
        <span className={`text-2xl font-black leading-none ${urgent ? "text-red-500" : "text-slate-800"}`}>
          {String(value).padStart(2, "0")}
        </span>
        <span className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">SEG.</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function IncomingRideAlert({ ride, driver, settings, onAccept, onReject, timeoutSeconds = 30, rejectCountToday = 0 }) {
  const [phase, setPhase] = useState("calculating"); // "calculating" | "ready"
  const [routeInfo, setRouteInfo] = useState(null);
  const [countdown, setCountdown] = useState(timeoutSeconds);
  const [showRejectionReasons, setShowRejectionReasons] = useState(false);
  const featureFlags = settings?.features_enabled || {};
  const rejectionModalEnabled = featureFlags?.driver_rejection_reason_modal_enabled !== false;
  const rejectionWarningThreshold = Number(settings?.rejection_count_threshold || 3);
  const rejectionReasonOptions = Array.isArray(featureFlags?.driver_rejection_reason_options)
    ? featureFlags.driver_rejection_reason_options
    : undefined;
  const rejectionHighRiskReasons = Array.isArray(featureFlags?.driver_rejection_high_risk_reasons)
    ? featureFlags.driver_rejection_high_risk_reasons
    : undefined;
  const rejectionWarningMessageTemplate = typeof featureFlags?.driver_rejection_warning_message_template === "string"
    ? featureFlags.driver_rejection_warning_message_template
    : undefined;
  const rejectionHighRiskTip = typeof featureFlags?.driver_rejection_high_risk_tip === "string"
    ? featureFlags.driver_rejection_high_risk_tip
    : undefined;
  const totalSecs = timeoutSeconds > 0 ? timeoutSeconds : 30;

  useEffect(() => { injectLeafletCSS(); }, []);

  // Calculate driver→pickup distance/ETA before showing the alert
  useEffect(() => {
    if (!ride) return;
    setPhase("calculating");
    setRouteInfo(null);

    const calc = async () => {
      const pLat = ride.pickup_lat, pLon = ride.pickup_lon;

      // Try to get fresh driver coords from DB if not present in prop
      let dLat = driver?.latitude, dLon = driver?.longitude;
      if ((!dLat || !dLon) && driver?.id) {
        try {
          const { supabaseApi } = await import("@/lib/supabaseApi");
          const fresh = await supabaseApi.drivers.get(driver.id);
          dLat = fresh?.latitude;
          dLon = fresh?.longitude;
        } catch {}
      }

      if (dLat && dLon && pLat && pLon) {
        const provider = settings?.maps_provider || "osrm";
        const apiKey = settings?.google_maps_api_key;
        const route = await getRoute(dLat, dLon, pLat, pLon, provider, apiKey);
        if (route) {
          setRouteInfo({ distKm: route.distKm.toFixed(1), etaMin: route.durationMin });
        } else {
          const km = getHaverDist(dLat, dLon, pLat, pLon);
          const speed = settings?.eta_speed_kmh || 30;
          setRouteInfo({ distKm: km ? km.toFixed(1) : null, etaMin: km ? Math.ceil((km / speed) * 60) : null });
        }
      } else {
        // No driver coords at all — use haversine fallback with default speed
        const speed = settings?.eta_speed_kmh || 30;
        setRouteInfo({ distKm: null, etaMin: null, noCoords: true });
      }
      setPhase("ready");
    };

    const fallback = setTimeout(() => setPhase("ready"), 6000);
    calc().then(() => clearTimeout(fallback)).catch(() => { clearTimeout(fallback); setPhase("ready"); });
    return () => clearTimeout(fallback);
   
  }, [ride?.id]);

  // Countdown starts once alert is ready
  useEffect(() => {
    if (phase !== "ready" || !ride) return;
    setCountdown(totalSecs);
    playAlarmSound();
    let rem = totalSecs;
    const iv = setInterval(() => {
      rem -= 1;
      setCountdown(rem);
      if (rem <= 0) { clearInterval(iv); onReject(ride, "timeout"); }
    }, 1000);
    return () => clearInterval(iv);
   
  }, [phase, ride?.id]);

  const hasPickup  = ride?.pickup_lat  && ride?.pickup_lon;
  const hasDropoff = ride?.dropoff_lat && ride?.dropoff_lon;
  const hasDriver  = driver?.latitude  && driver?.longitude;
  const payLabel   = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };

  return (
    <AnimatePresence>
      {ride && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // z-[9999] ensures it renders above Leaflet's default z-index of 400+
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* ── Calculating phase ────────────────────────────────── */}
          {phase === "calculating" && (
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl p-10 flex flex-col items-center gap-5"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-800 text-lg">Nuevo servicio asignado</p>
                <p className="text-sm text-slate-500 mt-1">Calculando distancia y tiempo de llegada…</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 rounded-full px-4 py-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-700">Procesando información</span>
              </div>
            </motion.div>
          )}

          {/* ── Ready phase ──────────────────────────────────────── */}
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ y: "100%" }} animate={{ y: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: "92vh", position: "relative", zIndex: 9999 }}
            >
              {/* Map */}
              <div className="h-40 relative flex-shrink-0 overflow-hidden">
                {hasPickup ? (
                  <MapContainer
                    center={[ride.pickup_lat, ride.pickup_lon]}
                    zoom={14}
                    style={{ width: "100%", height: "100%", zIndex: 0 }}
                    zoomControl={false}
                    scrollWheelZoom={false}
                    dragging={false}
                    attributionControl={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[ride.pickup_lat, ride.pickup_lon]} icon={pickupIcon} />
                    {hasDropoff && (
                      <>
                        <Marker position={[ride.dropoff_lat, ride.dropoff_lon]} icon={dropoffIcon} />
                        <Polyline
                          positions={[[ride.pickup_lat, ride.pickup_lon], [ride.dropoff_lat, ride.dropoff_lon]]}
                          color="#10b981" weight={3} opacity={0.85} dashArray="6,4"
                        />
                      </>
                    )}
                    {hasDriver && (
                      <Marker position={[driver.latitude, driver.longitude]} icon={driverIcon} />
                    )}
                  </MapContainer>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <MapPin className="w-10 h-10 text-slate-300" />
                  </div>
                )}

                {/* Map overlays */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none" style={{ zIndex: 500 }}>
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-slate-700">Nuevo Servicio</span>
                  </div>
                  {routeInfo?.distKm && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                      <Navigation className="w-3 h-3 text-blue-500" />
                      <span className="text-xs font-bold text-slate-700">
                        {routeInfo.distKm} km{routeInfo.etaMin ? ` · ${routeInfo.etaMin} min` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 pointer-events-none" style={{ zIndex: 500 }}>
                  <div className="flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-[10px] font-semibold text-slate-600">Origen</span>
                  </div>
                  {hasDropoff && (
                    <div className="flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      <span className="text-[10px] font-semibold text-slate-600">Destino</span>
                    </div>
                  )}
                  {hasDriver && (
                    <div className="flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      <span className="text-[10px] font-semibold text-slate-600">Tú</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-4 pt-4 pb-5">
                <h2 className="text-lg font-bold text-slate-800 text-center mb-3">¿Aceptar este viaje?</h2>

                {/* Passenger profile */}
                {ride.passenger_name && (
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-blue-100 flex items-center justify-center flex-shrink-0">
                      {ride.passenger_photo_url
                        ? <img src={ride.passenger_photo_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xl font-black text-blue-500">{ride.passenger_name?.charAt(0)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm">{ride.passenger_name}</p>
                    </div>
                    {ride.passenger_rating > 0 && (
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1.5 flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-amber-700 font-bold text-sm">{ride.passenger_rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Distance / ETA pills */}
                {routeInfo && (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    {routeInfo.distKm && (
                      <div className="flex items-center gap-1.5 bg-blue-50 rounded-full px-3 py-1.5">
                        <Navigation className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-semibold text-blue-700">{routeInfo.distKm} km de ti</span>
                      </div>
                    )}
                    {routeInfo.etaMin && (
                      <div className="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-amber-700">{routeInfo.etaMin} min para llegar</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Pickup / Dropoff */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Recoger:</p>
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                      <p className="text-xs font-semibold text-slate-800 leading-tight">{ride.pickup_address}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <p className="text-xs text-slate-500 truncate">{ride.passenger_name}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Destino:</p>
                    {ride.dropoff_address ? (
                      <div className="flex items-start gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-800 leading-tight">{ride.dropoff_address}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-1">Sin destino definido</p>
                    )}
                    {ride.duration_minutes && (
                      <p className="text-[10px] text-slate-400 mt-1.5">{ride.duration_minutes} min de viaje aprox.</p>
                    )}
                  </div>
                </div>

                {/* Service + price */}
                <div className="bg-slate-50 rounded-2xl px-4 py-3 flex items-center gap-3 mb-2 border border-slate-100">
                  <Car className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {ride.service_type_name && (
                      <p className="text-sm font-semibold text-slate-700">{ride.service_type_name}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                      {ride.distance_km && (
                        <span className="text-xs text-slate-400">{ride.distance_km} km de viaje</span>
                      )}
                      {ride.payment_method && (
                        <span className="text-xs text-slate-400">· {payLabel[ride.payment_method] || ride.payment_method}</span>
                      )}
                    </div>
                  </div>
                  {(ride.estimated_price || ride.final_price) && (() => {
                    const price = ride.final_price || ride.estimated_price || 0;
                    const commissionRate = ride.commission_rate ?? driver?.commission_rate ?? settings?.platform_commission_pct ?? 0;
                    const netEarnings = ride.driver_earnings ?? parseFloat((price * (1 - commissionRate / 100)).toFixed(2));
                    return (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wide">Tu ganancia</p>
                        <p className="text-xl font-black text-emerald-600">${netEarnings.toFixed(0)}</p>
                        {commissionRate > 0 && <p className="text-[9px] text-slate-400">-{commissionRate}% comisión</p>}
                      </div>
                    );
                  })()}
                </div>

                {/* Company */}
                {ride.company_name && (
                  <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 mb-2 border border-blue-100">
                    <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <p className="text-xs font-semibold text-blue-700">Empresa: {ride.company_name}</p>
                  </div>
                )}

                {/* Gasoline liters */}
                {ride.is_gasoline && ride.gasoline_liters && (
                  <div className="bg-yellow-50 rounded-xl px-3 py-2 mb-2 border border-yellow-200 flex items-center gap-2">
                    <span className="text-base">⛽</span>
                    <p className="text-xs font-semibold text-yellow-800">Servicio de gasolina: <span className="font-black">{ride.gasoline_liters} litros</span></p>
                  </div>
                )}

                {/* Notes */}
                {ride.notes && (
                  <div className="bg-amber-50 rounded-xl px-3 py-2 mb-3 border border-amber-100">
                    <p className="text-xs text-amber-700">📝 {ride.notes}</p>
                  </div>
                )}

                {/* Countdown + buttons */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-shrink-0">
                    <CountdownRing value={countdown} total={totalSecs} />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <button
                      onClick={() => onAccept(ride)}
                      className="py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-colors active:scale-95 w-full"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Aceptar viaje
                    </button>
                    <button
                      onClick={() => {
                        if (!rejectionModalEnabled) {
                          onReject(ride, "driver_declined");
                          return;
                        }
                        setShowRejectionReasons(true);
                      }}
                      className="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-95 w-full"
                    >
                      <XCircle className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </motion.div>
      )}

      {/* Ride Rejection Reasons Modal */}
      <RideRejectionReasons
        open={showRejectionReasons}
        onClose={() => setShowRejectionReasons(false)}
        onConfirm={(reasonId) => {
          setShowRejectionReasons(false);
          onReject(ride, reasonId);
        }}
        rejectCount={rejectCountToday}
        warningThreshold={rejectionWarningThreshold}
        reasons={rejectionReasonOptions}
        highRiskReasons={rejectionHighRiskReasons}
        warningMessageTemplate={rejectionWarningMessageTemplate}
        highRiskTip={rejectionHighRiskTip}
        ride={ride}
      />
    </AnimatePresence>
  );
}
