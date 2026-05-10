"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { initDriverPush, showDriverNotification } from "@/components/shared/usePushNotifications";
import { isNativePlatform, showNativeDriverNotification } from "@/lib/nativeMobile";

type NotificationColor = "blue" | "indigo" | "amber" | "emerald" | "green" | "red";
type SoundKind = "new_ride" | "status" | "complete" | "cancel" | "message";

interface Ride {
  id: string;
  status?: string;
  passenger_name?: string;
  pickup_address?: string;
  driver_name?: string;
  final_price?: number;
  estimated_price?: number;
  driver_earnings?: number;
  cancellation_reason?: string;
  assignment_mode?: string;
  passenger_user_id?: string;
  manual_assignment_requested_at?: string;
  auction_driver_ids?: string[];
  driver_id?: string;
  [key: string]: any;
}

interface StatusMessage {
  title: string;
  msg: string;
  color: NotificationColor;
  sound?: SoundKind | null;
}

interface RideRoleMessages {
  admin?: (ride: Ride) => StatusMessage;
  driver?: (ride: Ride) => StatusMessage;
}

interface NotificationSettingsInput {
  interval_seconds?: number;
  volume?: number;
  sound_type?: "classic" | "urgent" | "chime" | "beep";
}

interface Note {
  freq: number;
  start: number;
  dur: number;
  waveType: OscillatorType;
}

const STATUS_MESSAGES: Record<string, RideRoleMessages> = {
  pending: {
    admin: (ride) => ({
      title: "🚖 Nuevo viaje solicitado",
      msg: `${ride.passenger_name || "Pasajero"} · ${ride.pickup_address || "Sin dirección"}`,
      color: "blue",
      sound: "new_ride",
    }),
  },
  assigned: {
    driver: (ride) => ({
      title: "📋 Viaje asignado",
      msg: `Recoge a ${ride.passenger_name || "pasajero"}`,
      color: "blue",
      sound: "new_ride",
    }),
  },
  en_route: {
    admin: (ride) => ({
      title: "🚗 Conductor en camino",
      msg: `${ride.driver_name || "Conductor"} va hacia ${ride.passenger_name || "pasajero"}`,
      color: "indigo",
      sound: "status",
    }),
  },
  arrived: {
    admin: (ride) => ({
      title: "📍 Conductor llegó",
      msg: `${ride.driver_name || "Conductor"} llegó al punto de recogida`,
      color: "amber",
      sound: "status",
    }),
    driver: (ride) => ({
      title: "📍 Llegaste al punto",
      msg: `Esperando a ${ride.passenger_name || "pasajero"}`,
      color: "amber",
      sound: "status",
    }),
  },
  admin_approved: {
    driver: () => ({
      title: "✅ Viaje aprobado",
      msg: "El administrador aprobó el inicio del viaje",
      color: "emerald",
      sound: "status",
    }),
  },
  in_progress: {
    admin: (ride) => ({
      title: "▶️ Viaje iniciado",
      msg: `${ride.passenger_name || "pasajero"} · conductor: ${ride.driver_name || "—"}`,
      color: "emerald",
      sound: "status",
    }),
    driver: (ride) => ({
      title: "▶️ Viaje en curso",
      msg: `Lleva a ${ride.passenger_name || "pasajero"} al destino`,
      color: "emerald",
      sound: "status",
    }),
  },
  completed: {
    admin: (ride) => ({
      title: "✅ Viaje completado",
      msg: `${ride.passenger_name || "pasajero"} · $${(ride.final_price || ride.estimated_price || 0).toFixed(0)}`,
      color: "green",
      sound: "complete",
    }),
    driver: (ride) => ({
      title: "✅ Viaje completado",
      msg: `+$${(ride.driver_earnings || ride.final_price || ride.estimated_price || 0).toFixed(0)} ganados`,
      color: "green",
      sound: "complete",
    }),
  },
  cancelled: {
    admin: (ride) => ({
      title: "❌ Viaje cancelado",
      msg: `${ride.passenger_name || "pasajero"} · ${ride.cancellation_reason || "sin motivo"}`,
      color: "red",
      sound: "cancel",
    }),
    driver: (ride) => ({
      title: "❌ Viaje cancelado",
      msg: ride.cancellation_reason || "El viaje fue cancelado",
      color: "red",
      sound: "cancel",
    }),
  },
};

let alarmIntervalMs = 3000;
let alarmVolume = 0.7;
let soundType: "classic" | "urgent" | "chime" | "beep" = "classic";

export function setNotificationSettings({ interval_seconds, volume, sound_type }: NotificationSettingsInput) {
  if (interval_seconds != null) alarmIntervalMs = Math.max(1, interval_seconds) * 1000;
  if (volume != null) alarmVolume = Math.min(1, Math.max(0, volume));
  if (sound_type != null) soundType = sound_type;
}

const ALL_SOUND_SETS: Record<string, Record<SoundKind, Note[]>> = {
  classic: {
    new_ride: [
      { freq: 1047, start: 0, dur: 0.15, waveType: "square" },
      { freq: 1319, start: 0.18, dur: 0.15, waveType: "square" },
      { freq: 1047, start: 0.36, dur: 0.15, waveType: "square" },
      { freq: 1319, start: 0.54, dur: 0.22, waveType: "square" },
    ],
    status: [
      { freq: 660, start: 0, dur: 0.1, waveType: "sine" },
      { freq: 880, start: 0.12, dur: 0.15, waveType: "sine" },
    ],
    complete: [
      { freq: 523, start: 0, dur: 0.1, waveType: "sine" },
      { freq: 659, start: 0.12, dur: 0.1, waveType: "sine" },
      { freq: 784, start: 0.24, dur: 0.2, waveType: "sine" },
    ],
    cancel: [
      { freq: 440, start: 0, dur: 0.15, waveType: "sawtooth" },
      { freq: 330, start: 0.18, dur: 0.2, waveType: "sawtooth" },
    ],
    message: [
      { freq: 1047, start: 0, dur: 0.08, waveType: "sine" },
      { freq: 1047, start: 0.12, dur: 0.08, waveType: "sine" },
    ],
  },
  urgent: {
    new_ride: [
      { freq: 880, start: 0, dur: 0.1, waveType: "sawtooth" },
      { freq: 1100, start: 0.12, dur: 0.1, waveType: "sawtooth" },
      { freq: 880, start: 0.24, dur: 0.1, waveType: "sawtooth" },
      { freq: 1100, start: 0.36, dur: 0.1, waveType: "sawtooth" },
      { freq: 1320, start: 0.48, dur: 0.18, waveType: "sawtooth" },
    ],
    status: [
      { freq: 700, start: 0, dur: 0.08, waveType: "sawtooth" },
      { freq: 900, start: 0.1, dur: 0.12, waveType: "sawtooth" },
    ],
    complete: [
      { freq: 600, start: 0, dur: 0.1, waveType: "sine" },
      { freq: 800, start: 0.12, dur: 0.1, waveType: "sine" },
      { freq: 1000, start: 0.24, dur: 0.2, waveType: "sine" },
    ],
    cancel: [
      { freq: 300, start: 0, dur: 0.2, waveType: "sawtooth" },
      { freq: 200, start: 0.22, dur: 0.25, waveType: "sawtooth" },
    ],
    message: [
      { freq: 900, start: 0, dur: 0.07, waveType: "sawtooth" },
      { freq: 900, start: 0.1, dur: 0.07, waveType: "sawtooth" },
    ],
  },
  chime: {
    new_ride: [
      { freq: 1568, start: 0, dur: 0.2, waveType: "sine" },
      { freq: 1319, start: 0.22, dur: 0.2, waveType: "sine" },
      { freq: 1047, start: 0.44, dur: 0.25, waveType: "sine" },
      { freq: 1319, start: 0.7, dur: 0.3, waveType: "sine" },
    ],
    status: [
      { freq: 1319, start: 0, dur: 0.15, waveType: "sine" },
      { freq: 1047, start: 0.18, dur: 0.2, waveType: "sine" },
    ],
    complete: [
      { freq: 1047, start: 0, dur: 0.15, waveType: "sine" },
      { freq: 1319, start: 0.18, dur: 0.15, waveType: "sine" },
      { freq: 1568, start: 0.36, dur: 0.25, waveType: "sine" },
    ],
    cancel: [
      { freq: 784, start: 0, dur: 0.2, waveType: "sine" },
      { freq: 523, start: 0.22, dur: 0.25, waveType: "sine" },
    ],
    message: [
      { freq: 1568, start: 0, dur: 0.1, waveType: "sine" },
      { freq: 1319, start: 0.12, dur: 0.1, waveType: "sine" },
    ],
  },
  beep: {
    new_ride: [
      { freq: 1000, start: 0, dur: 0.07, waveType: "square" },
      { freq: 1000, start: 0.1, dur: 0.07, waveType: "square" },
      { freq: 1000, start: 0.2, dur: 0.07, waveType: "square" },
      { freq: 1500, start: 0.3, dur: 0.15, waveType: "square" },
    ],
    status: [
      { freq: 800, start: 0, dur: 0.06, waveType: "square" },
      { freq: 800, start: 0.09, dur: 0.06, waveType: "square" },
    ],
    complete: [
      { freq: 1000, start: 0, dur: 0.06, waveType: "square" },
      { freq: 1200, start: 0.09, dur: 0.06, waveType: "square" },
      { freq: 1500, start: 0.18, dur: 0.1, waveType: "square" },
    ],
    cancel: [
      { freq: 400, start: 0, dur: 0.1, waveType: "square" },
      { freq: 300, start: 0.13, dur: 0.15, waveType: "square" },
    ],
    message: [
      { freq: 1000, start: 0, dur: 0.05, waveType: "square" },
      { freq: 1000, start: 0.08, dur: 0.05, waveType: "square" },
    ],
  },
};

function getPattern(type: SoundKind) {
  return (ALL_SOUND_SETS[soundType] || ALL_SOUND_SETS.classic)[type] || ALL_SOUND_SETS.classic.status;
}

function playSoundOnce(type: SoundKind, volume = alarmVolume) {
  if (typeof window === "undefined") return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = getPattern(type);
    const now = ctx.currentTime;

    notes.forEach(({ freq, start, dur, waveType }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = waveType;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });

    setTimeout(() => ctx.close().catch(() => {}), 3000);
  } catch {
  }
}

const activeAlarms: Record<string, number | true> = {};

export function startNewRideAlarm(rideId: string) {
  if (activeAlarms[rideId]) return;
  playSoundOnce("new_ride", alarmVolume);
  activeAlarms[rideId] = true;
}

export function stopNewRideAlarm(rideId: string) {
  if (!activeAlarms[rideId]) return;
  if (typeof activeAlarms[rideId] === "number") clearInterval(activeAlarms[rideId] as number);
  delete activeAlarms[rideId];
}

export function stopAllAlarms() {
  Object.keys(activeAlarms).forEach((id) => {
    if (typeof activeAlarms[id] === "number") clearInterval(activeAlarms[id] as number);
    delete activeAlarms[id];
  });
}

export function playMessageSound() {
  playSoundOnce("message");
}

function showNotification({ title, msg, color, sound }: StatusMessage) {
  const colorMap: Record<NotificationColor, string> = {
    blue: "#3B82F6",
    indigo: "#6366F1",
    amber: "#F59E0B",
    emerald: "#10B981",
    green: "#22C55E",
    red: "#EF4444",
  };

  toast(title, {
    description: msg,
    duration: 5000,
    style: { borderLeft: `4px solid ${colorMap[color] || "#3B82F6"}` },
  });

  if (sound) playSoundOnce(sound);

  if (isNativePlatform()) {
    showNativeDriverNotification({ title, body: msg, url: "/driver-app" }).catch(() => {});
    return;
  }

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: msg, icon: "/favicon.ico" });
  }
}

export function useAdminNotifications() {
  const prevRides = useRef<Record<string, Ride>>({});

  useEffect(() => {
    const channel = supabase
      .channel("admin_ride_notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, (payload: any) => {
        const ride = (payload.new || payload.old) as Ride;
        if (!ride?.id) return;
        const prev = prevRides.current[ride.id];

        if (payload.eventType === "INSERT") {
          const isPassengerAppRide = !!ride.passenger_user_id;
          if (["pending", "auction"].includes(ride.status || "")) {
            const cfg = STATUS_MESSAGES.pending?.admin?.(ride);
            if (cfg) {
              if (isPassengerAppRide && ride.assignment_mode !== "manual") {
                showNotification({ ...cfg, sound: null });
              } else {
                showNotification({ ...cfg, sound: null });
                startNewRideAlarm(ride.id);
              }
            }
          }
        }

        if (payload.eventType === "UPDATE") {
          const prevStatus = prev?.status;
          const newStatus = ride.status;

          const shouldStop = !!ride.driver_id || ["assigned", "admin_approved", "en_route", "arrived", "in_progress", "completed", "cancelled"].includes(newStatus || "");
          if (shouldStop) stopNewRideAlarm(ride.id);

          if (prevStatus && prevStatus !== newStatus) {
            const cfg = STATUS_MESSAGES[newStatus || ""]?.admin?.(ride);
            if (cfg) showNotification(cfg);
          }

          if (newStatus === "pending" && !ride.driver_id) {
            startNewRideAlarm(ride.id);
          }

          if (
            newStatus === "pending" &&
            ride.passenger_user_id &&
            ride.manual_assignment_requested_at &&
            !prev?.manual_assignment_requested_at
          ) {
            startNewRideAlarm(ride.id);
          }
        }

        prevRides.current[ride.id] = ride;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}

export function useDriverNotifications(driverId?: string) {
  const prevRides = useRef<Record<string, Ride>>({});

  const isAuctionTargetedToDriver = (ride: Ride, currentDriverId: string) => {
    const directIds = Array.isArray((ride as any)?.auction_driver_ids) ? (ride as any).auction_driver_ids : [];
    if (directIds.includes(currentDriverId)) return true;
    const fallbackIds = Array.isArray((ride as any)?.extra_charges?.auction_candidate_driver_ids)
      ? (ride as any).extra_charges.auction_candidate_driver_ids
      : [];
    return fallbackIds.includes(currentDriverId);
  };

  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver_ride_notifications_${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, (payload: any) => {
        const ride = (payload.new || payload.old) as Ride;
        if (!ride?.id) return;

        if (
          (payload.eventType === "INSERT" || payload.eventType === "UPDATE") &&
          ride.status === "auction" &&
          isAuctionTargetedToDriver(ride, driverId)
        ) {
          showNotification({
            title: "🚗 ¡Nuevo servicio disponible!",
            msg: `${ride.passenger_name || "Pasajero"} · ${ride.pickup_address || ""}`,
            color: "blue",
            sound: null,
          });
          startNewRideAlarm(ride.id);
          showDriverNotification({
            title: "🚗 ¡Nuevo servicio disponible!",
            body: `${ride.passenger_name || "Pasajero"} · ${ride.pickup_address || ""}`,
            rideId: ride.id,
          });
          prevRides.current[ride.id] = ride;
          return;
        }

        if (ride.driver_id !== driverId) return;
        const prev = prevRides.current[ride.id];

        if (payload.eventType === "UPDATE" && prev && prev.status !== ride.status) {
          if (["assigned", "cancelled", "completed"].includes(ride.status || "")) {
            stopNewRideAlarm(ride.id);
          }

          if (ride.status === "assigned" && prev.status !== "assigned") {
            const cfg = STATUS_MESSAGES.assigned?.driver?.(ride);
            if (cfg) showNotification({ ...cfg, sound: null });
            startNewRideAlarm(ride.id);
            showDriverNotification({
              title: "🚗 ¡Servicio asignado!",
              body: `Recoge a ${ride.passenger_name || "Pasajero"} · ${ride.pickup_address || ""}`,
              rideId: ride.id,
            });
          } else {
            const cfg = STATUS_MESSAGES[ride.status || ""]?.driver?.(ride);
            if (cfg) showNotification(cfg);
          }
        }

        prevRides.current[ride.id] = ride;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);
}

export function requestNotificationPermission(driverId?: string) {
  if (!driverId) return;
  initDriverPush(driverId).catch(() => {});
}