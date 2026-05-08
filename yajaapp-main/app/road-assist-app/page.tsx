"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from "react";
import { useRoadAssistAuth } from "@/components/roadassist/useRoadAssistAuth";
import RALoginScreen from "@/components/roadassist/RALoginScreen";
import RAServicePicker from "@/components/roadassist/RAServicePicker";
import RAServiceTracker from "@/components/roadassist/RAServiceTracker";
import RAProfileTab from "@/components/roadassist/RAProfileTab";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, User, Clock, HelpCircle, LogOut, X, History, Star, Wallet, Menu } from "lucide-react";
import { motion } from "framer-motion";
import useAppSettings from "@/components/shared/useAppSettings";
import useRideAutoAssign from "@/components/shared/useRideAutoAssign";
import { formatCDMX, setSystemTimezone } from "@/components/shared/dateUtils";
import TicketsPanel from "@/components/shared/TicketsPanel";
import AnnouncementModal from "@/components/shared/AnnouncementModal";
import { AnimatePresence } from "framer-motion";
import PullToRefresh from "@/components/driver/PullToRefresh";
import { initPassengerPush, showPassengerNotification } from "@/components/shared/usePushNotifications";
import { getLocationPermissionState, getNotificationPermissionState } from "@/lib/nativeMobile";
import PermissionsOnboarding from "@/components/shared/PermissionsOnboarding";
import { syncBrandHead } from "@/components/shared/brandHead";

// Sound engine for passenger notifications
function usePassengerSounds() {
  const ctxRef = useRef(null);
  const playSound = React.useCallback((type) => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      ctxRef.current = new AudioCtx();
    }
    const ctx = ctxRef.current;
    const tones = {
      assigned: [[440,0.1],[660,0.15],[880,0.2]],
      en_route: [[523,0.1],[659,0.15]],
      arrived: [[880,0.1],[1047,0.15],[1319,0.2],[1047,0.15],[880,0.1]],
      in_progress: [[330,0.08],[440,0.12]],
      completed: [[523,0.1],[659,0.15],[784,0.2],[1047,0.3]],
      cancelled: [[440,0.1],[330,0.15],[220,0.2]],
    };
    const seq = tones[type] || tones.assigned;
    let t = ctx.currentTime;
    seq.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t); osc.stop(t + dur);
      t += dur + 0.02;
    });
  }, []);
  return { playSound };
}

// Wake lock hook to keep screen on
function useWakeLock() {
  const wakeLockRef = useRef(null);
  useEffect(() => {
    const acquire = async () => {
      if ("wakeLock" in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request("screen"); } catch (_) {}
      }
    };
    acquire();
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release?.();
    };
  }, []);
}

const STATUS_LABELS = {
  pending: "Pendiente", scheduled: "Programado", auction: "Buscando conductor",
  assigned: "Conductor asignado", admin_approved: "Aprobado", en_route: "En camino",
  arrived: "Conductor llegó", in_progress: "En curso", completed: "Completado", cancelled: "Cancelado",
};
const STATUS_COLORS = {
  completed: "text-emerald-400 bg-emerald-400/10",
  cancelled: "text-red-400 bg-red-400/10",
  in_progress: "text-blue-400 bg-blue-400/10",
  en_route: "text-violet-400 bg-violet-400/10",
  assigned: "text-blue-300 bg-blue-300/10",
  pending: "text-amber-400 bg-amber-400/10",
  auction: "text-orange-400 bg-orange-400/10",
};

function RACompletedRideCard({ ride, onReportProblem, onViewDetail }) {
  const isCancelled = ride.status === "cancelled";
  const isCancelledFree = isCancelled && !(ride.cancellation_fee > 0);
  const label = STATUS_LABELS[ride.status] || ride.status;
  const colorClass = STATUS_COLORS[ride.status] || "text-slate-400 bg-slate-400/10";
  const price = ride.final_price || ride.estimated_price || 0;

  const downloadTicket = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const lineH = 8; let y = 20;
    const line = (text, indent = 14) => { doc.text(text, indent, y); y += lineH; };
    doc.setFontSize(18); doc.setFont(undefined, "bold"); line("TICKET DE SERVICIO");
    doc.setFontSize(10); doc.setFont(undefined, "normal"); y += 2;
    line(`Folio: #${ride.service_id || ride.id?.slice(-6)}`);
    line(`Fecha: ${new Date(ride.requested_at || ride.created_date).toLocaleString("es-MX")}`);
    line(`Estado: ${label}`);
    y += 4; doc.setFont(undefined, "bold"); line("SERVICIO"); doc.setFont(undefined, "normal");
    line(`Tipo: ${ride.service_type_name || "—"}`);
    line(`Conductor: ${ride.driver_name || "—"}`);
    y += 4; doc.setFont(undefined, "bold"); line("RUTA"); doc.setFont(undefined, "normal");
    doc.splitTextToSize(`Origen: ${ride.pickup_address || "—"}`, 180).forEach(l => line(l));
    if (ride.dropoff_address) doc.splitTextToSize(`Destino: ${ride.dropoff_address}`, 180).forEach(l => line(l));
    if (ride.distance_km) line(`Distancia: ${ride.distance_km} km`);
    y += 4; doc.setFont(undefined, "bold"); line("PAGO"); doc.setFont(undefined, "normal");
    line(`Método: ${ride.payment_method || "efectivo"}`);
    line(`Total: $${price.toFixed(2)}`);
    doc.save(`ticket-${ride.service_id || ride.id?.slice(-6)}.pdf`);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <button className="w-full text-left" onClick={() => !isCancelledFree && onViewDetail(ride)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-white font-semibold text-sm">{ride.service_type_name || "Servicio"}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>
            </div>
            <p className="text-white/40 text-xs truncate">{ride.pickup_address}</p>
            {ride.dropoff_address && <p className="text-white/30 text-xs truncate">→ {ride.dropoff_address}</p>}
            <p className="text-white/30 text-xs mt-1">{formatCDMX(ride.requested_at || ride.created_date, "shortdatetime")}</p>
            {isCancelled && ride.cancellation_reason && (
              <p className="text-red-400/70 text-xs mt-1">Motivo: {ride.cancellation_reason}</p>
            )}
          </div>
          {price > 0 && (
            <p className={`font-bold flex-shrink-0 text-sm ${isCancelled ? "text-slate-500" : "text-emerald-400"}`}>
              ${price.toFixed(0)}
            </p>
          )}
        </div>
      </button>
      <div className="flex gap-2 mt-3">
        {!isCancelledFree && (
          <button
            onClick={() => onViewDetail(ride)}
            className="flex-1 text-xs text-blue-400/80 border border-blue-500/20 bg-blue-500/5 rounded-xl py-2 hover:bg-blue-500/10 transition-colors">
            Ver detalle
          </button>
        )}
        {!isCancelled && (
          <button
            onClick={downloadTicket}
            className="flex-1 text-xs text-emerald-400/80 border border-emerald-500/20 bg-emerald-500/5 rounded-xl py-2 hover:bg-emerald-500/10 transition-colors">
            📄 Ticket
          </button>
        )}
        {!isCancelled && (
          <button
            onClick={() => onReportProblem(ride)}
            className="flex-1 text-xs text-red-400/80 border border-red-500/20 bg-red-500/5 rounded-xl py-2 hover:bg-red-500/10 transition-colors">
            Problema
          </button>
        )}
      </div>
    </div>
  );
}

function RideDetailModal({ ride, onClose }) {
  const isCancelled = ride.status === "cancelled";
  const price = ride.final_price || ride.estimated_price || 0;
  const label = STATUS_LABELS[ride.status] || ride.status;

  const downloadTicket = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const lineH = 8; let y = 20;
    const line = (text, indent = 14) => { doc.text(text, indent, y); y += lineH; };
    doc.setFontSize(18); doc.setFont(undefined, "bold"); line("TICKET DE SERVICIO");
    doc.setFontSize(10); doc.setFont(undefined, "normal"); y += 2;
    line(`Folio: #${ride.service_id || ride.id?.slice(-6)}`);
    line(`Fecha: ${new Date(ride.requested_at || ride.created_date).toLocaleString("es-MX")}`);
    line(`Estado: ${label}`);
    y += 4; doc.setFont(undefined, "bold"); line("SERVICIO"); doc.setFont(undefined, "normal");
    line(`Tipo: ${ride.service_type_name || "—"}`);
    line(`Conductor: ${ride.driver_name || "—"}`);
    y += 4; doc.setFont(undefined, "bold"); line("RUTA"); doc.setFont(undefined, "normal");
    doc.splitTextToSize(`Origen: ${ride.pickup_address || "—"}`, 180).forEach(l => line(l));
    if (ride.dropoff_address) doc.splitTextToSize(`Destino: ${ride.dropoff_address}`, 180).forEach(l => line(l));
    if (ride.distance_km) line(`Distancia: ${ride.distance_km} km`);
    y += 4; doc.setFont(undefined, "bold"); line("PAGO"); doc.setFont(undefined, "normal");
    line(`Método: ${ride.payment_method || "efectivo"}`);
    line(`Total: $${price.toFixed(2)}`);
    doc.save(`ticket-${ride.service_id || ride.id?.slice(-6)}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div className="w-full bg-slate-900 rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Detalle del servicio</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60">✕</button>
        </div>
        <div className="text-center">
          <p className="text-white/40 text-xs">Folio</p>
          <p className="text-white font-mono font-bold">#{ride.service_id || ride.id?.slice(-6)}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5 text-sm">
          <div className="flex justify-between"><span className="text-white/40">Servicio</span><span className="text-white font-medium">{ride.service_type_name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Estado</span><span className={`font-medium text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ride.status] || "text-slate-400 bg-slate-400/10"}`}>{label}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Conductor</span><span className="text-white">{ride.driver_name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Pago</span><span className="text-white capitalize">{ride.payment_method || "efectivo"}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Total</span><span className="text-emerald-400 font-bold text-lg">${price.toFixed(2)}</span></div>
          {ride.distance_km && <div className="flex justify-between"><span className="text-white/40">Distancia</span><span className="text-white">{ride.distance_km} km</span></div>}
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
            <p className="text-white/80 text-sm">{ride.pickup_address}</p>
          </div>
          {ride.dropoff_address && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
              <p className="text-white/80 text-sm">{ride.dropoff_address}</p>
            </div>
          )}
        </div>
        {!isCancelled && (
          <button onClick={downloadTicket}
            className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-2xl">
            📄 Descargar ticket
          </button>
        )}
      </div>
    </div>
  );
}

export default function RoadAssistApp() {
  const { user, login, logout, loading, refreshUser, setUser } = useRoadAssistAuth();
  const [tab, setTab] = useState("home");
  const [showTickets, setShowTickets] = useState<any>(false);
  const [detailRide, setDetailRide] = useState(null);
  const [endedRide, setEndedRide] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [raTab, setRaTab] = useState("home");
  const [showPermissionsOnboarding, setShowPermissionsOnboarding] = useState(false);
  const { settings } = useAppSettings();
  const activeRidesRefetchMs = Math.max(5000, Number(settings?.passenger_active_rides_refetch_seconds ?? 30) * 1000);
  const allRidesRefetchMs = Math.max(10000, Number(settings?.passenger_all_rides_refetch_seconds ?? 60) * 1000);
  const queryClient = useQueryClient();
  const prevStatusRef = useRef(null);
  const dismissedTerminalRideIdsRef = useRef<Set<string>>(new Set());
  useWakeLock();

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      try {
        return await supabaseApi.cities.list();
      } catch {
        return [];
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Watchdog de auto-asignación también en app pasajero.
  // Así la búsqueda/asignación corre sin requerir una sesión abierta en el panel.
  useRideAutoAssign(settings as any, cities as any, true);

  useEffect(() => {
    if (settings?.timezone) setSystemTimezone(settings.timezone);
  }, [settings?.timezone]);

  useEffect(() => {
    const company = settings?.company_name?.trim() || "YAJA Asistencia";
    return syncBrandHead({
      title: `${company} Pasajero`,
      logoUrl: settings?.logo_url,
      appName: `${company} Pasajero`,
      cacheSeed: settings?.updated_at || settings?.updated_date || company,
    });
  }, [settings?.company_name, settings?.logo_url, settings?.updated_at, settings?.updated_date]);

  const { playSound } = usePassengerSounds();

  const { data: activeRides = [], refetch: refetchRides } = useQuery({
    queryKey: ["ra_active_rides", user?.id],
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: activeRidesRefetchMs,
    queryFn: async () => {
      const all = await supabaseApi.rideRequests.list({ passenger_phone: user.phone });
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      return all.filter(r =>
        !['completed', 'cancelled'].includes(r.status) ||
        // Keep recently ended rides that haven't been rated yet
        (new Date(r.completed_at || r.requested_at).getTime() > twoHoursAgo &&
          !r.passenger_rating_for_driver && r.status === 'completed') ||
        (new Date(r.completed_at || r.requested_at).getTime() > twoHoursAgo &&
          r.status === 'cancelled' && (r.cancellation_fee || 0) > 0 && r.payment_status !== 'paid')
      );
    },
  });

  const { data: allRides = [] } = useQuery({
    queryKey: ["ra_all_rides", user?.id],
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: allRidesRefetchMs,
    queryFn: () => supabaseApi.rideRequests.list({ passenger_phone: user.phone }),
  });

  // Init push notifications when user logs in
  useEffect(() => {
    if (user?.id) initPassengerPush(user.id);
  }, [user?.id]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user?.id) return;
      const locGranted = (await getLocationPermissionState()) === "granted";
      const notifState = await getNotificationPermissionState();
      const notifGranted = notifState === "granted" || notifState === "unsupported";
      if (!locGranted || !notifGranted) {
        setShowPermissionsOnboarding(true);
      }
    };
    checkPermissions();
  }, [user?.id]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && user?.id) {
        refetchRides();
        queryClient.invalidateQueries({ queryKey: ["ra_all_rides", user.id] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    if (document.visibilityState === "visible") onVisible();
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id, queryClient, refetchRides]);

  // Real-time user data sync with Supabase
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`road_assist_user:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "road_assist_users", filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            setUser(payload.new as any);
          }
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user?.id, setUser]);

  const activeRide = React.useMemo(() => {
    if (!activeRides.length) return null;
    const priority: Record<string, number> = {
      in_progress: 6,
      arrived: 5,
      en_route: 4,
      admin_approved: 3,
      assigned: 2,
      auction: 1,
      pending: 0,
      no_drivers: -1,
      completed: -2,
      cancelled: -3,
    };
    return [...activeRides].sort((a: any, b: any) => {
      const pa = priority[a.status || "pending"] ?? 0;
      const pb = priority[b.status || "pending"] ?? 0;
      if (pb !== pa) return pb - pa;
      const ta = new Date(a.updated_at || a.requested_at || a.created_at || 0).getTime();
      const tb = new Date(b.updated_at || b.requested_at || b.created_at || 0).getTime();
      return tb - ta;
    })[0];
  }, [activeRides]);

  // Realtime subscription for passenger's ride requests
  useEffect(() => {
    const passengerId = user?.id;
    if (!passengerId) return;

    const channel = supabase
      .channel(`passenger_rides:${passengerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `passenger_user_id=eq.${passengerId}`,
        },
        async (payload) => {
          const ride = payload.new || payload.old;
          if (!ride) return;

          // Update local rides state
          if (payload.eventType === "UPDATE") {
            queryClient.setQueryData(["rides"], (old: any[] = []) => {
              return old.map((r) => r.id === ride.id ? { ...r, ...ride } : r);
            });

            // Handle status changes with notifications
            if (ride.status === "assigned" && payload.old?.status !== "assigned") {
              playSound("assigned");
              showPassengerNotification({
                title: "🚗 Conductor asignado",
                body: `${ride.driver_name || "Tu conductor"} está en camino`,
              });
            } else if (ride.status === "en_route" && payload.old?.status !== "en_route") {
              playSound("en_route");
              showPassengerNotification({
                title: "🚗 Conductor en camino",
                body: `${ride.driver_name || "El conductor"} se dirige hacia ti`,
              });
            } else if (ride.status === "arrived" && payload.old?.status !== "arrived") {
              playSound("arrived");
              showPassengerNotification({
                title: "📍 ¡Tu conductor llegó!",
                body: `${ride.driver_name || "El conductor"} te espera en el punto de recogida`,
              });
            } else if (ride.status === "in_progress" && payload.old?.status !== "in_progress") {
              playSound("in_progress");
              showPassengerNotification({
                title: "🚗 Servicio en progreso",
                body: "Tu viaje ha comenzado",
              });
            } else if (ride.status === "completed" && payload.old?.status !== "completed") {
              playSound("completed");
              showPassengerNotification({
                title: "✅ Servicio completado",
                body: `Total: $${(ride.final_price || ride.estimated_price || 0).toFixed(2)}`,
              });
            } else if (ride.status === "cancelled" && payload.old?.status !== "cancelled") {
              playSound("cancelled");
              showPassengerNotification({
                title: "❌ Servicio cancelado",
                body: ride.cancellation_reason || "El servicio fue cancelado",
              });
            }
          } else if (payload.eventType === "INSERT") {
            // New ride created
            queryClient.setQueryData(["rides"], (old: any[] = []) => [ride, ...old]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, queryClient]);

  // Capture ride when completed/cancelled so tracker stays mounted until user dismisses
  useEffect(() => {
    if (activeRide) {
      if (activeRide.status === "completed" || activeRide.status === "cancelled") {
        if (!dismissedTerminalRideIdsRef.current.has(activeRide.id)) {
          setEndedRide(activeRide);
        }
      }
      return;
    }

    const now = Date.now();
    const fallbackTerminalRide = [...(allRides || [])]
      .sort((a, b) => new Date(b.updated_at || b.completed_at || b.requested_at || b.created_date).getTime() - new Date(a.updated_at || a.completed_at || a.requested_at || a.created_date).getTime())
      .find((r) => {
        const isTerminal = r.status === "completed" || r.status === "cancelled";
        if (!isTerminal) return false;
        if (dismissedTerminalRideIdsRef.current.has(r.id)) return false;
        const rideTs = new Date(r.completed_at || r.updated_at || r.requested_at || r.created_date).getTime();
        const recentEnough = Number.isFinite(rideTs) ? (now - rideTs) <= 2 * 60 * 60 * 1000 : true;
        if (!recentEnough) return false;
        if (r.status === "completed") return !r.passenger_rating_for_driver;
        return true;
      });

    setEndedRide(fallbackTerminalRide || null);
  }, [activeRide?.status, activeRide?.id, allRides]);

  // Notify passenger of driver status changes with sound + push notification
  useEffect(() => {
    if (!activeRide) { prevStatusRef.current = null; return; }
    const prev = prevStatusRef.current;
    const curr = activeRide.status;
    if (prev && prev !== curr) {
      const soundMap = {
        assigned: "assigned", en_route: "en_route", admin_approved: "en_route",
        arrived: "arrived", in_progress: "in_progress",
        completed: "completed", cancelled: "cancelled",
      };
      const pushMessages = {
        assigned: { title: "🚗 Conductor asignado", body: `${activeRide.driver_name || "Tu conductor"} está en camino` },
        en_route: { title: "🚗 Conductor en camino", body: `${activeRide.driver_name || "El conductor"} se dirige hacia ti` },
        admin_approved: { title: "✅ Servicio aprobado", body: "Tu conductor está en camino" },
        arrived: { title: "📍 ¡Tu conductor llegó!", body: `${activeRide.driver_name || "El conductor"} te espera en el punto de recogida` },
        in_progress: { title: "🚙 Servicio en curso", body: "Tu servicio ha comenzado" },
        completed: { title: "✅ Servicio completado", body: `Total: $${(activeRide.final_price || activeRide.estimated_price || 0).toFixed(2)}` },
        cancelled: { title: "❌ Servicio cancelado", body: activeRide.cancellation_reason || "Tu servicio fue cancelado" },
      };
      if (soundMap[curr]) playSound(soundMap[curr]);
      if (pushMessages[curr]) {
        showPassengerNotification({ ...pushMessages[curr], rideId: activeRide.id });
      }
    }
    prevStatusRef.current = curr;
  }, [activeRide?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <RALoginScreen onLogin={login} appName={settings?.company_name || "YAJA Asistencia"} appLogo={settings?.logo_url} />;
  }

  if (showPermissionsOnboarding) {
    return (
      <PermissionsOnboarding
        role="passenger"
        userId={user.id}
        onDone={() => setShowPermissionsOnboarding(false)}
      />
    );
  }

  const trackerRide = activeRide || endedRide;

  if (trackerRide) {
    return (
      <RAServiceTracker
        ride={trackerRide}
        user={user}
        onRefresh={refetchRides}
        onRideEnded={() => {
          if (trackerRide?.id) {
            dismissedTerminalRideIdsRef.current.add(trackerRide.id);
          }
          setEndedRide(null);
          refetchRides();
          queryClient.invalidateQueries({ queryKey: ["ra_active_rides", user?.id] });
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900" style={{ paddingTop: "env(safe-area-inset-top)", touchAction: "pan-y" }}>
      <AnnouncementModal audience="passengers" cityId="" serviceTypeId="" storageKey="passenger_shown_announcements" />

      {/* Header flotante */}
      <div className="absolute top-0 left-0 right-0 z-30" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-3 mt-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl px-3 py-2.5 flex items-center justify-between border border-white/10 shadow-xl">
          <div className="flex items-center gap-2.5">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-8 h-8 rounded-xl object-contain bg-white/10 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Truck className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="text-left">
              <p className="text-white font-bold text-sm leading-tight">{settings?.company_name || "YAJA Asistencia"}</p>
              <p className="text-white/60 text-[11px]">Hola, {user.full_name?.split(" ")[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.pending_balance > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-xl font-medium">
                Adeudo: ${user.pending_balance}
              </span>
            )}
            {/* Botón menú hamburguesa */}
            <button onClick={() => setShowMenu(true)}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 active:bg-white/20 transition-colors">
              <Menu className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal — siempre RAServicePicker como home */}
      <div className="fixed inset-0" style={{ paddingTop: "calc(env(safe-area-inset-top) + 68px)" }}>
        <RAServicePicker user={user} onRequestCreated={refetchRides} onRefreshUser={refreshUser} />
      </div>

      {/* Overlay: Mis viajes */}
      <AnimatePresence>
        {raTab === "rides" && (
          <motion.div key="rides" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-0 bg-slate-900 z-[60] flex flex-col"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
              <button onClick={() => setRaTab("home")} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                <X className="w-4 h-4" />
              </button>
              <p className="text-white font-bold">Mis viajes</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PullToRefresh onRefresh={async () => { await refetchRides(); queryClient.invalidateQueries({ queryKey: ["ra_all_rides", user?.id] }); }}>
                <div className="px-4 py-4 space-y-3">
                  {allRides.length === 0 ? (
                    <div className="text-center py-16 text-white/30">
                      <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Sin servicios solicitados aún</p>
                    </div>
                  ) : (
                    [...allRides].sort((a, b) => new Date(b.requested_at || b.created_date).getTime() - new Date(a.requested_at || a.created_date).getTime()).map(r => (
                      <RACompletedRideCard key={r.id} ride={r}
                        onReportProblem={(ride) => setShowTickets({ rideContext: { ride_id: ride.id, service_id: ride.service_id } })}
                        onViewDetail={(ride) => setDetailRide(ride)}
                      />
                    ))
                  )}
                </div>
              </PullToRefresh>
            </div>
          </motion.div>
        )}
        {raTab === "profile" && (
          <motion.div key="profile" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-0 bg-slate-900 z-[60] overflow-y-auto"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 bg-slate-900 z-10">
              <button onClick={() => setRaTab("home")} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                <X className="w-4 h-4" />
              </button>
              <p className="text-white font-bold">Mi perfil</p>
            </div>
            <RAProfileTab user={user} rides={allRides} onLogout={logout} onUserUpdate={(u) => { setUser(u); }} onDeleteAccount={logout} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menú desplegable desde foto de perfil */}
      <AnimatePresence>
        {showMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end"
            onClick={() => setShowMenu(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full bg-slate-900 rounded-t-3xl border-t border-white/10"
              style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              {/* User info */}
              <div className="px-5 pb-4 flex items-center gap-3 border-b border-white/10">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
                  {user.photo_url
                    ? <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xl font-black text-white">{user.full_name?.charAt(0)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{user.full_name}</p>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-white/50 text-xs">{user.rating || 5} · {allRides.filter(r => r.status === "completed").length} servicios</span>
                  </div>
                </div>
                <button onClick={() => setShowMenu(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              {/* Menu items */}
              <div className="px-4 py-3 space-y-1">
                {[
                  { icon: Truck, label: "Solicitar servicio", color: "text-blue-400", bg: "bg-blue-500/15", onPress: () => { setRaTab("home"); setShowMenu(false); } },
                  { icon: History, label: "Mis viajes", color: "text-violet-400", bg: "bg-violet-500/15", onPress: () => { setRaTab("rides"); setShowMenu(false); } },
                  { icon: User, label: "Mi perfil", color: "text-emerald-400", bg: "bg-emerald-500/15", onPress: () => { setRaTab("profile"); setShowMenu(false); } },
                  { icon: HelpCircle, label: "Ayuda / Soporte", color: "text-amber-400", bg: "bg-amber-500/15", onPress: () => { setShowMenu(false); setShowTickets(true); } },
                ].map(({ icon: Icon, label, color, bg, onPress }) => (
                  <button key={label} onClick={onPress}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <span className="text-white font-medium text-sm">{label}</span>
                  </button>
                ))}
                {user.wallet_balance > 0 && (
                  <div className="mx-3 mt-1 flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-violet-400" />
                      <span className="text-violet-300 text-sm font-medium">Saldo wallet</span>
                    </div>
                    <span className="text-violet-300 font-bold">${user.wallet_balance?.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 mt-2">
                  <button onClick={() => { setShowMenu(false); logout(); }}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <LogOut className="w-4 h-4 text-white/50" />
                    </div>
                    <span className="text-white/60 font-medium text-sm">Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {detailRide && <RideDetailModal ride={detailRide} onClose={() => setDetailRide(null)} />}

      <AnimatePresence>
        {showTickets && (
          <TicketsPanel
            role="passenger"
            driverId=""
            passengerUserId={user?.id}
            passengerName={user?.full_name}
            driverName=""
            passengerPhone={user?.phone}
            rideContext={showTickets?.rideContext || null}
            onClose={() => setShowTickets(false)}
            darkMode={true}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
