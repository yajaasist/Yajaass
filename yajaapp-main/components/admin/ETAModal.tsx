"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, MapPin, Navigation, X, Search, CheckCircle2, UserCheck, AlertTriangle } from "lucide-react";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";
import { getRoute, getHaverDist } from "@/components/shared/mapsUtils";

function formatETA(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Searching Phase: compact modal ─────────────────────────────────────────
function SearchingPhase({ ride, onClose, waitingAcceptance = false, rejected = false, onAssignManual = undefined }) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  const modeLabels = { auto: "Automática", auction: "Subasta", manual: "Manual" };
  const mode = ride?.assignment_mode || "auto";
  const bgStyle = rejected
    ? { background: "linear-gradient(135deg,#b91c1c,#7f1d1d)" }
    : waitingAcceptance
    ? { background: "linear-gradient(135deg,#059669,#065f46)" }
    : mode === "auction"
    ? { background: "linear-gradient(135deg,#d97706,#92400e)" }
    : mode === "manual"
    ? { background: "linear-gradient(135deg,#4f46e5,#312e81)" }
    : { background: "linear-gradient(135deg,#2563eb,#1e40af)" };

  const headingText = rejected
    ? `Conductor no aceptó el viaje${".".repeat(dots)}`
    : waitingAcceptance
    ? `Conductor encontrado · Esperando aceptación${".".repeat(dots)}`
    : `Buscando conductor${".".repeat(dots)}`;
  const subText = rejected
    ? "Se requiere reasignar manualmente"
    : waitingAcceptance
    ? `Conductor: ${ride?.driver_name || "Asignado"} — esperando que confirme`
    : `Modo: ${modeLabels[mode] || "Auto"}`;

  const notifiedCount = ride?.auction_driver_ids?.length || 0;

  return (
    <div className="p-5 text-white relative" style={bgStyle}>
      <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-4 pr-8">
        {/* Animated icon */}
        <div className="relative flex-shrink-0 w-14 h-14">
          <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center relative z-10">
            {rejected ? <AlertTriangle className="w-6 h-6 text-white" /> : waitingAcceptance ? <Car className="w-6 h-6 text-white" /> : <Search className="w-6 h-6 text-white" />}
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-base leading-tight">{headingText}</p>
          <p className="text-white/70 text-xs mt-0.5">{subText}</p>
          {/* Auction summary */}
          {mode === "auction" && !waitingAcceptance && (
            <div className="flex items-center gap-2 mt-1">
              {notifiedCount > 0 && (
                <span className="text-[11px] bg-white/20 rounded-full px-2 py-0.5 font-semibold">
                  {notifiedCount} conductor{notifiedCount !== 1 ? "es" : ""} notificado{notifiedCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
          <p className="text-white/90 text-sm font-medium mt-1">{ride?.passenger_name}</p>
          <div className="flex items-start gap-1.5 mt-0.5">
            <MapPin className="w-3 h-3 text-white/60 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/75 leading-tight line-clamp-2">{ride?.pickup_address}</p>
          </div>
        </div>
      </div>

      {rejected && (
        <Button
          onClick={() => onAssignManual?.(ride)}
          className="w-full mt-4 bg-white text-red-700 hover:bg-red-50 rounded-xl font-bold h-10"
        >
          <UserCheck className="w-4 h-4 mr-2" /> Reasignar ahora
        </Button>
      )}
    </div>
  );
}

// ─── Assigned Phase ──────────────────────────────────────────────────────────
function AssignedPhase({ ride, driver, settings, onClose }) {
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [distKm, setDistKm] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveDriver, setLiveDriver] = useState<any>(null);
  const liveDriverRef = useRef<any>(null);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const speedKmh = settings?.eta_speed_kmh ?? 30;
  const pollSec = settings?.driver_location_update_interval_seconds ?? 10;
  const modalDurationSec = settings?.eta_modal_duration_seconds ?? 30;

  useEffect(() => {
    setCountdown(modalDurationSec);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); onClose(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [modalDurationSec]);

  const refreshETA = async () => {
    if (!driver) return;
    const currentLive = liveDriverRef.current;
    const hasLive = !!(currentLive?.latitude && currentLive?.longitude);
    const d = hasLive
      ? { ...driver, latitude: currentLive.latitude, longitude: currentLive.longitude }
      : await supabaseApi.drivers.get(driver.id);

    if (d.latitude && d.longitude && ride.pickup_lat && ride.pickup_lon) {
      const mapsProvider = settings?.maps_provider || "osrm";
      const apiKey = settings?.google_maps_api_key;
      const route = await getRoute(d.latitude, d.longitude, ride.pickup_lat, ride.pickup_lon, mapsProvider, apiKey);
      if (route) {
        setDistKm(route.distKm);
        setEtaMinutes(route.durationMin);
        setLastUpdated(new Date());
        return;
      }
    }
    // Fallback: Haversine estimate
    const km = getHaverDist(d?.latitude, d?.longitude, ride.pickup_lat, ride.pickup_lon);
    setDistKm(km);
    setEtaMinutes(km && km !== Infinity ? Math.ceil((km / speedKmh) * 60) : null);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    if (!driver?.id) return;
    const channel = supabase
      .channel(`gps_driver_${driver.id}`)
      .on("broadcast", { event: "location" }, ({ payload }: any) => {
        if (payload?.driver_id !== driver.id) return;
        const nextLive = { latitude: payload.latitude, longitude: payload.longitude, status: payload.status, sent_at: payload.sent_at };
        liveDriverRef.current = nextLive;
        setLiveDriver(nextLive);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [driver?.id]);

  useEffect(() => {
    if (!liveDriver?.latitude || !liveDriver?.longitude || !ride?.pickup_lat || !ride?.pickup_lon) return;
    const km = getHaverDist(liveDriver.latitude, liveDriver.longitude, ride.pickup_lat, ride.pickup_lon);
    setDistKm(km);
    setEtaMinutes(km && km !== Infinity ? Math.ceil((km / speedKmh) * 60) : null);
    setLastUpdated(new Date());
  }, [liveDriver?.latitude, liveDriver?.longitude, ride?.pickup_lat, ride?.pickup_lon, speedKmh]);

  useEffect(() => {
    refreshETA();
    intervalRef.current = setInterval(refreshETA, pollSec * 1000);
    return () => clearInterval(intervalRef.current);
  }, [driver?.id, pollSec]);

  const hasCoords = ride.pickup_lat && ride.pickup_lon;
  const pct = ((countdown || 0) / modalDurationSec) * 100;

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <p className="text-emerald-100 text-xs font-semibold">¡Conductor aceptó el servicio!</p>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-lg font-bold">
            {(driver?.full_name || "?").charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight truncate">{driver?.full_name}</p>
            <p className="text-emerald-200 text-xs truncate">{driver?.vehicle_brand} {driver?.vehicle_model} · <span className="font-bold text-white">{driver?.license_plate}</span></p>
          </div>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-200 uppercase tracking-wide font-medium mb-1">⏱ Tiempo estimado de llegada</p>
          {etaMinutes === null && hasCoords ? (
            <div className="flex items-center justify-center gap-1 py-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : (
            <p className="text-4xl font-black tracking-tight">{hasCoords ? formatETA(etaMinutes) : "—"}</p>
          )}
          {distKm !== null && distKm !== Infinity && (
            <p className="text-emerald-200 text-xs mt-0.5">{distKm.toFixed(2)} km</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 bg-white">
        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-slate-800">{ride.passenger_name}</p>
            {ride.estimated_price > 0 && (
              <span className="ml-auto text-xs font-bold text-emerald-600">${ride.estimated_price?.toFixed(0)}</span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-600 leading-tight">{ride.pickup_address}</p>
          </div>
          {ride.dropoff_address && (
            <div className="flex items-start gap-2">
              <Navigation className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-600 leading-tight">{ride.dropoff_address}</p>
            </div>
          )}
        </div>

        {/* Countdown bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Se cierra automáticamente</span>
            <span className="font-bold text-slate-600">{countdown}s</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Button onClick={onClose} variant="outline" className="w-full rounded-xl text-sm">Cerrar</Button>
      </div>
    </>
  );
}

// ─── No Drivers Phase (panel) ────────────────────────────────────────────────
function NoDriversPhase({ ride, onClose, onAssignManual }) {
  return (
    <div className="bg-gradient-to-br from-red-700 to-red-900 p-5 text-white relative">
      <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-3 pr-8 mb-4">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="font-bold text-base">Sin conductores disponibles</p>
          <p className="text-red-200 text-xs mt-0.5">No hay conductores en la zona de búsqueda</p>
        </div>
      </div>
      <div className="bg-black/20 rounded-xl p-3 text-sm mb-4">
        <p className="text-white/80 font-medium">{ride?.passenger_name}</p>
        <div className="flex items-start gap-1.5 mt-1">
          <MapPin className="w-3 h-3 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200 line-clamp-2">{ride?.pickup_address}</p>
        </div>
      </div>
      <Button
        onClick={onAssignManual}
        className="w-full bg-white text-red-700 hover:bg-red-50 rounded-xl font-bold h-10">
        <UserCheck className="w-4 h-4 mr-2" /> Asignar conductor manualmente
      </Button>
    </div>
  );
}

function NoAcceptancePhase({ ride, onClose, onAssignManual }) {
  return (
    <div className="bg-gradient-to-br from-red-700 to-red-900 p-5 text-white relative">
      <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-3 pr-8 mb-4">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="font-bold text-base">Nadie aceptó el viaje</p>
          <p className="text-red-200 text-xs mt-0.5">Se alcanzó el tiempo máximo de búsqueda</p>
        </div>
      </div>
      <div className="bg-black/20 rounded-xl p-3 text-sm mb-4">
        <p className="text-white/80 font-medium">{ride?.passenger_name}</p>
        <div className="flex items-start gap-1.5 mt-1">
          <MapPin className="w-3 h-3 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200 line-clamp-2">{ride?.pickup_address}</p>
        </div>
      </div>
      <Button
        onClick={onAssignManual}
        className="w-full bg-white text-red-700 hover:bg-red-50 rounded-xl font-bold h-10"
      >
        <UserCheck className="w-4 h-4 mr-2" /> Asignar conductor manualmente
      </Button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function ETAModal({ ride, driver, phase, settings, open, onClose, onAssignManual }) {
  if (!open || !ride) return null;

  const isAssigned = phase === "assigned" && driver;
  const isNoDrivers = phase === "no_drivers";
  const isWaitingAcceptance = phase === "waiting_acceptance";
  const isDriverRejected = phase === "driver_rejected";
  const isNoAcceptance = phase === "no_acceptance";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={`p-0 overflow-hidden border-0 shadow-2xl ${isAssigned ? "sm:max-w-[30.8rem]" : "sm:max-w-[26.4rem]"}`}>
        <DialogTitle className="sr-only">Estado de asignación de conductor</DialogTitle>
        <DialogDescription className="sr-only">
          Muestra el estado actual de la búsqueda o asignación de conductor para el viaje.
        </DialogDescription>
        {isNoDrivers ? (
          <NoDriversPhase ride={ride} onClose={onClose} onAssignManual={() => { onClose(); onAssignManual?.(ride); }} />
        ) : isNoAcceptance ? (
          <NoAcceptancePhase ride={ride} onClose={onClose} onAssignManual={() => { onClose(); onAssignManual?.(ride); }} />
        ) : isAssigned ? (
          <AssignedPhase ride={ride} driver={driver} settings={settings} onClose={onClose} />
        ) : isDriverRejected ? (
          <SearchingPhase
            ride={ride}
            onClose={onClose}
            rejected={true}
            onAssignManual={(r) => {
              onClose();
              onAssignManual?.(r);
            }}
          />
        ) : isWaitingAcceptance ? (
          <SearchingPhase ride={ride} onClose={onClose} waitingAcceptance={true} />
        ) : (
          <SearchingPhase ride={ride} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
