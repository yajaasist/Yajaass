"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useDriverNotifications, stopNewRideAlarm, startNewRideAlarm } from "@/components/shared/useRideNotifications";
import { Car, Star, Clock, User, AlertTriangle, DollarSign, ShieldAlert, HelpCircle, Navigation, RefreshCw, TrendingUp, LogOut, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Popup, Circle, useMap } from "react-leaflet";
// Leaflet CSS is imported via npm package
import L from "leaflet";
import { setSystemTimezone, nowCDMX, futureCDMX } from "@/components/shared/dateUtils";
import IncomingRideAlert, { playAcceptedSound } from "@/components/driver/IncomingRideAlert";
import DriverSurveyModal from "@/components/driver/DriverSurveyModal";
import DriverHelpTicket from "@/components/driver/DriverHelpTicket";
import PullToRefresh from "@/components/driver/PullToRefresh";
import PushPermissionBanner from "@/components/driver/PushPermissionBanner";
import { showDriverNotification, startSWRideTimer, cancelSWRideTimer, sendDriverHeartbeat, stopDriverHeartbeat, registerDriverSW } from "@/components/shared/usePushNotifications";
import DriverNotificationsPanel from "@/components/driver/DriverNotificationsPanel";
import PermissionsOnboarding from "@/components/shared/PermissionsOnboarding";
import VehicleSelectorModal from "@/components/driver/VehicleSelectorModal";
import DriverProfileTab from "@/components/driver/DriverProfileTab";
import DocumentExpiryBanner from "@/components/driver/DocumentExpiryBanner";
import { SESSION_KEY, SESSION_TOKEN_KEY, getDistance } from "@/components/driver/driverUtils";
import DriverLoginScreen from "@/components/driver/DriverLoginScreen";
import RideCard from "@/components/driver/RideCard";
import InstallAppBanner from "@/components/shared/InstallAppBanner";
import DriverEarningsTab from "@/components/driver/DriverEarningsTab";
import { LocationPermissionScreen, SuspendedScreen, AdminSuspendedScreen } from "@/components/driver/DriverStatusScreens";
import AnnouncementModal from "@/components/shared/AnnouncementModal";
import RideSummaryScreen from "@/components/driver/RideSummaryScreen";
import RideHistoryModal from "@/components/driver/RideHistoryModal";
import useRideAutoAssign from "@/components/shared/useRideAutoAssign";
import { toast } from "sonner";
import { enqueueRideUpdateOffline, flushOfflineOutbox, buildReconciliationExtra, isOnlineNow, type OfflineOutboxAction } from "@/lib/offlineSecurity";
import { clearLiveLocationWatch, getCurrentLiveLocation, watchLiveLocation, type LiveLocationWatchHandle } from "@/lib/nativeMobile";
import { ensureLocationPermission } from "@/lib/locationPermissions";
import { locationTracker } from "@/lib/locationTracker";
import { syncBrandHead } from "@/components/shared/brandHead";
import { useDriverLocation } from "@/lib/useDriverLocationRealtime";
import { AnimatedMarker, SmoothMapPanner } from "@/components/shared/AnimatedMapComponents";
import { getLocationPermissionState, getNotificationPermissionState, requestNotificationPermission } from "@/lib/permissionsService";

// ─── Types ────────────────────────────────────────────────────────────────────
type Driver = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  total_rides?: number;
  total_earnings?: number;
  photo_url?: string;
  vehicles?: any[];
  commission_rate?: number;
  doc_expiries?: Record<string, string>;
  suspended_until?: string;
  approval_status?: string;
  rejection_reason?: string;
  admin_notes?: string;
  access_code?: string;
  online_since?: string;
  accumulated_work_minutes?: number;
  rest_required_until?: string;
  last_disconnect_reason?: string;
  city_id?: string;
  password?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  license_plate?: string;
  [key: string]: any;
};

type Ride = {
  id: string;
  driver_id?: string;
  passenger_user_id?: string;
  passenger_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  pickup_lat?: number;
  pickup_lon?: number;
  dropoff_lat?: number;
  dropoff_lon?: number;
  status: string;
  estimated_price?: number;
  final_price?: number;
  driver_earnings?: number;
  platform_commission?: number;
  commission_rate?: number;
  payment_method?: string;
  created_date?: string;
  updated_date?: string;
  requested_at?: string;
  assigned_at?: string;
  en_route_at?: string;
  arrived_at?: string;
  in_progress_at?: string;
  completed_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  cancellation_fee?: number;
  wallet_amount_used?: number;
  wallet_refund_amount?: number;
  wallet_excess_amount?: number;
  rating_window_expires_at?: string;
  auction_driver_ids?: string[];
  auction_expires_at?: string;
  driver_accepted?: boolean;
  driver_accepted_at?: string;
  assignment_mode?: string;
  company_id?: string;
  driver_rating_for_passenger?: number;
  _excluded_driver_ids?: string[];
  [key: string]: any;
};

type AppSettings = {
  id: string;
  company_name?: string;
  logo_url?: string;
  accent_color?: string;
  primary_color?: string;
  timezone?: string;
  platform_commission_pct?: number;
  auction_timeout_seconds?: number;
    driver_offer_timeout_seconds?: number;
  rating_window_minutes?: number;
  driver_location_update_interval_seconds?: number;
  driver_inactivity_timeout_minutes?: number;
  driver_inactivity_warn_minutes?: number;
  payment_methods?: any[];
  driver_required_docs?: any[];
  driver_vehicle_docs?: any[];
  service_flow_update_minutes?: number;
  work_max_hours?: number;
  work_rest_ratio?: number;
  work_rest_trigger_minutes?: number;
  work_long_rest_minutes?: number;
  support_whatsapp_number?: string;
  driver_app_instructions?: string;
  [key: string]: any;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useLocationPermission() {
  const [permission, setPermission] = useState("checking");
  useEffect(() => {
    let cancelled = false;
    const syncPermission = async () => {
      const state = await getLocationPermissionState();
      if (!cancelled) setPermission(state);
    };
    syncPermission();
    window.addEventListener("focus", syncPermission);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncPermission);
    };
  }, []);
  return permission;
}

function useGeofenceCheck(driver: Driver | null, cities: any[]) {
  const [outsideGeofence, setOutsideGeofence] = useState(false);
  useEffect(() => {
    if (!driver?.city_id || !driver?.latitude || !cities?.length) return;
    const city = cities.find((c) => c.id === driver.city_id);
    if (!city?.center_lat || !city?.center_lon || !city?.geofence_radius_km) return;
    const dist = getDistance(driver.latitude, driver.longitude, city.center_lat, city.center_lon);
    setOutsideGeofence(dist > city.geofence_radius_km);
  }, [driver?.latitude, driver?.longitude, driver?.city_id, cities]);
  return outsideGeofence;
}

const _lastActivity = { t: Date.now() };
if (typeof window !== "undefined") {
  const bump = () => {
    _lastActivity.t = Date.now();
  };
  window.addEventListener("touchstart", bump, { passive: true });
  window.addEventListener("touchmove", bump, { passive: true });
  window.addEventListener("click", bump);
  window.addEventListener("scroll", bump, { passive: true });
  window.addEventListener("mousemove", bump, { passive: true });
}

function useInactivityAutoDisconnect({
  driver,
  settings,
  onDisconnect,
  onWarn,
}: {
  driver: Driver | null;
  settings: AppSettings | undefined;
  onDisconnect: () => void;
  onWarn: () => void;
}) {
  const driverRef = useRef(driver);
  const onDisconnectRef = useRef(onDisconnect);
  const onWarnRef = useRef(onWarn);
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);
  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);
  useEffect(() => {
    onWarnRef.current = onWarn;
  }, [onWarn]);

  useEffect(() => {
    const mins = settings?.driver_inactivity_timeout_minutes ?? 30;
    if (!mins || mins <= 0) return;
    const warnMins = Math.min(mins - 1, settings?.driver_inactivity_warn_minutes ?? Math.max(1, mins - 3));
    let warned = false;
    const iv = setInterval(() => {
      const d = driverRef.current;
      if (!d?.id || d.status !== "available") {
        warned = false;
        return;
      }
      const idleMin = (Date.now() - _lastActivity.t) / 60000;
      if (idleMin >= mins) {
        onDisconnectRef.current?.();
      } else if (idleMin >= warnMins && !warned) {
        warned = true;
        onWarnRef.current?.();
      } else if (idleMin < warnMins) {
        warned = false;
      }
    }, 10000); // check every 10s for better precision
    return () => clearInterval(iv);
  }, [settings?.driver_inactivity_timeout_minutes, settings?.driver_inactivity_warn_minutes]);
}

function useWakeLock() {
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    const acquire = async () => {
      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        } catch (_) {}
      }
    };
    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release?.();
    };
  }, []);
}

function useDarkModeSync() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
}

// ─── MapRecenter helper ───────────────────────────────────────────────────────
function MapRecenter({ lat, lon }: { lat?: number; lon?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [lat, lon, map]);
  return null;
}

// ─── HomeMap — mapa pantalla completa con heatmap de flujo ───────────────────
function HomeMap({
  driver,
  allRides,
  onToggleOnline,
  onRefreshLocation,
  isSuspended,
  hasActiveRide,
  todayEarnings,
  settings,
}: {
  driver: Driver | null;
  allRides: Ride[];
  onToggleOnline: () => Promise<void>;
  onRefreshLocation: () => void;
  isSuspended: boolean;
  hasActiveRide: boolean;
  todayEarnings: number;
  settings: AppSettings | undefined;
}) {
  const isOnline = driver?.status === "available";

  // Usar hook de ubicación en tiempo real
  const { location: driverLocation, isLoading: locationLoading } = useDriverLocation({
    driverId: driver?.id || null,
    enabled: !!driver?.id && isOnline,
  });

  const lat = driverLocation?.latitude;
  const lon = driverLocation?.longitude;
  const center = lat && lon ? [lat, lon] : [19.4326, -99.1332];
  const mapRef = useRef<any>(null);

  // Flow data: fetch ALL platform rides periodically
  const [flowRides, setFlowRides] = React.useState<Ride[]>([]);
  const updateIntervalMs = (settings?.service_flow_update_minutes ?? 5) * 60 * 1000;

  const fetchFlowRides = React.useCallback(async () => {
    try {
      // Fetch ALL recent rides from the platform
      const allData = await supabaseApi.rideRequests.list();

      // Only show active/recent rides (not cancelled), last 24h
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const relevant = (allData || []).filter(
        (r) =>
          r.status !== "cancelled" &&
          new Date(r.requested_at).getTime() > since
      );
      setFlowRides(relevant);
    } catch (_) {}
  }, []);

  // Fetch on mount
  React.useEffect(() => {
    fetchFlowRides();
  }, [fetchFlowRides]);

  // Refresh periodically
  React.useEffect(() => {
    const iv = setInterval(fetchFlowRides, updateIntervalMs);
    return () => clearInterval(iv);
  }, [fetchFlowRides, updateIntervalMs]);

  // Crear icono de conductor personalizado
  const driverIcon = L.divIcon({
    className: "",
    html: `<div style="width:44px;height:44px;background:${
      isOnline ? "#10b981" : "#64748b"
    };border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h.5"/><path d="M9 17l-1.5-5h9L15 17"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M9 5h6l1 5H8L9 5z"/></svg>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  // Puntos de calor: basado en DONDE SE SOLICITAN los servicios (pickup_lat/lon)
  const heatPoints = flowRides
    .filter((r) => r.pickup_lat && r.pickup_lon && r.status !== "cancelled")
    .slice(0, 200);

  // Agrupar en zonas de calor por coordenadas de RECOGIDA
  const zoneMap: Record<string, any> = {};
  heatPoints.forEach((r) => {
    const key = `${Math.round(r.pickup_lat! * 20) / 20}_${Math.round(r.pickup_lon! * 20) / 20}`;
    zoneMap[key] = zoneMap[key] || { lat: r.pickup_lat, lon: r.pickup_lon, count: 0 };
    zoneMap[key].count++;
  });
  const zones = Object.values(zoneMap);
  const maxCount = Math.max(...zones.map((z) => z.count), 1);

  return (
    <div className="relative w-full h-full" style={{ zIndex: 0 }}>
      <MapContainer
        center={center as any}
        zoom={14}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
        zoomControl={false}
        attributionControl={false}
        ref={mapRef as any}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <SmoothMapPanner center={center as [number, number]} duration={1000} />

        {/* Zonas de calor de flujo */}
        {zones.map((z, i) => {
          const intensity = z.count / maxCount;
          const color = intensity > 0.7 ? "#ef4444" : intensity > 0.4 ? "#f97316" : "#eab308";
          const opacity = 0.15 + intensity * 0.25;
          return (
            <Circle
              key={i}
              center={[z.lat, z.lon] as any}
              radius={400 + intensity * 600}
              pathOptions={{ color, fillColor: color, fillOpacity: opacity, weight: 0 }}
            />
          );
        })}

        {/* Marcador del conductor con animación suave tipo Uber */}
        {lat && lon && (
          <AnimatedMarker
            position={[lat, lon]}
            icon={driverIcon}
            duration={1000}
          >
            <Popup>Tu ubicación actual</Popup>
          </AnimatedMarker>
        )}
      </MapContainer>

      {/* Overlay: Ganancias del día */}
      <div className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none" style={{ top: 12 }}>
        <div className="bg-black/70 backdrop-blur-md rounded-2xl px-5 py-2.5 flex items-center gap-2.5 shadow-xl border border-white/10 pointer-events-auto">
          <div>
            <p className="text-[10px] text-slate-400 leading-none">Ganancias de hoy</p>
            <p className="text-base font-black text-emerald-400 leading-tight">${todayEarnings.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Overlay: botón GPS */}
      {lat && lon && (
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              void onRefreshLocation?.();
            }}
            className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center"
            aria-label="Actualizar ubicación"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (!map || !lat || !lon) return;
              const targetZoom = Math.max(map.getZoom?.() || 14, 14);
              map.setView([lat, lon], targetZoom, { animate: true });
            }}
            className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center"
            aria-label="Recentrar mapa a mi ubicación"
          >
            <Navigation className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Botón principal de conexión */}
      {!isSuspended && !hasActiveRide && (
        <div className="absolute left-0 right-0 z-10 flex flex-col items-center gap-2 px-6" style={{ bottom: "10px" }}>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onToggleOnline}
            className={`w-full max-w-xs py-4 rounded-3xl font-black text-base shadow-2xl flex items-center justify-center gap-3 transition-all ${
              isOnline
                ? "bg-emerald-500 text-white shadow-emerald-500/40"
                : "bg-white text-slate-900 shadow-slate-900/20"
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${isOnline ? "bg-white animate-pulse" : "bg-slate-400"}`} />
            {isOnline ? "Estoy en línea · Toca para salir" : "Conectarme para recibir viajes"}
          </motion.button>
          {/* Leyenda de flujo de servicios */}
          <div className="bg-black/55 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-orange-400" />
            <span className="text-white text-[11px] font-semibold">Flujo de servicios</span>
            <div className="flex gap-1 ml-0.5">
              <div className="w-2 h-2 rounded-full bg-yellow-400 opacity-80" />
              <div className="w-2 h-2 rounded-full bg-orange-500 opacity-80" />
              <div className="w-2 h-2 rounded-full bg-red-500 opacity-80" />
            </div>
          </div>
        </div>
      )}

      {hasActiveRide && (
        <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center px-6">
          <div className="bg-blue-600 text-white py-3.5 px-6 rounded-3xl font-bold text-sm flex items-center gap-2 shadow-2xl shadow-blue-600/40">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            En servicio activo
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DriverMenu ───────────────────────────────────────────────────────────────
function DriverMenu({
  driver,
  onClose,
  onOpenEarnings,
  onOpenProfile,
  onOpenTickets,
  onLogout,
  onSOS,
  hasActiveRide,
}: {
  driver: Driver;
  onClose: () => void;
  onOpenEarnings: () => void;
  onOpenProfile: () => void;
  onOpenTickets: () => void;
  onLogout: () => void;
  onSOS: () => void;
  hasActiveRide: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full bg-slate-900 rounded-t-3xl border-t border-white/10"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {/* Driver info */}
        <div className="px-5 pb-4 flex items-center gap-3 border-b border-white/10">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0">
            {driver.photo_url ? (
              <img src={driver.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-xl font-black text-white">
                {driver.full_name?.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate">{driver.full_name || "Desconocido"}</p>
            <div className="flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-white/50 text-xs">
                {driver.rating || 5} · {driver.total_rides || 0} servicios
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        {/* Menu items */}
        <div className="px-4 py-3 space-y-1">
          {[
            {
              icon: DollarSign,
              label: "Ganancias",
              color: "text-emerald-400",
              bg: "bg-emerald-500/15",
              onPress: onOpenEarnings,
            },
            {
              icon: User,
              label: "Mi perfil",
              color: "text-violet-400",
              bg: "bg-violet-500/15",
              onPress: onOpenProfile,
            },
            {
              icon: HelpCircle,
              label: "Ayuda / Soporte",
              color: "text-amber-400",
              bg: "bg-amber-500/15",
              onPress: onOpenTickets,
            },
          ].map(({ icon: Icon, label, color, bg, onPress }) => (
            <button
              key={label}
              onClick={() => {
                onClose();
                onPress();
              }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <span className="text-white font-medium text-sm">{label}</span>
            </button>
          ))}
          {hasActiveRide && (
            <button
              onClick={() => {
                onClose();
                onSOS();
              }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-red-500/10 active:bg-red-500/15 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-red-400 font-medium text-sm">Enviar SOS de emergencia</span>
            </button>
          )}
          <div className="border-t border-white/10 pt-2 mt-2">
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-4 h-4 text-white/50" />
              </div>
              <span className="text-white/60 font-medium text-sm">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DriverApp() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [sessionLoading, setSessionLoading] = useState(() => typeof window !== 'undefined' ? !!localStorage.getItem(SESSION_KEY) : false);
  const [sessionKickedOut, setSessionKickedOut] = useState(false);
  const [incomingRide, setIncomingRide] = useState<Ride | null>(null);
  const [activeTab, setActiveTab] = useState<"rides" | "earnings" | "profile">("rides");
  const [tabDir, setTabDir] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpRideContext, setHelpRideContext] = useState<Ride | null>(null);
  const [showTickets, setShowTickets] = useState(false);
  const [pendingSurvey, setPendingSurvey] = useState<any>(null);
  const [rideSummary, setRideSummary] = useState<any>(null);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPermissionsOnboarding, setShowPermissionsOnboarding] = useState(false);
  const [suspendedUntil, setSuspendedUntil] = useState(() => {
    const stored = localStorage.getItem("driver_suspended_until");
    if (stored) {
      const val = parseInt(stored);
      if (val > Date.now()) return val;
      localStorage.removeItem("driver_suspended_until");
    }
    return null;
  });

  const releaseDriverToAvailable = useCallback(async () => {
    if (!driver?.id) return;
    // Antes de poner disponible, asegurar permiso de ubicación
    const ok = await ensureLocationPermission();
    if (!ok) return;
    try {
      await supabaseApi.drivers.update(driver.id, { status: "available", suspended_until: null });
    } catch {}
    setDriver((prev) => (prev ? { ...prev, status: "available", suspended_until: null } : prev));
    setSuspendedUntil(null);
    localStorage.removeItem("driver_suspended_until");
  }, [driver?.id]);

  const registerDriverOfferResult = useCallback(
    async (kind: "accepted" | "rejected", reasonKey?: string) => {
      if (!driver?.id) return;
      try {
        const fresh = await supabaseApi.drivers.get(driver.id);
        if (!fresh) return;
        const accepted = Number(fresh.accepted_offers_count || 0);
        const rejected = Number(fresh.rejection_count || 0);
        const updates: any = {};
        if (kind === "accepted") {
          updates.accepted_offers_count = accepted + 1;
        } else {
          updates.rejection_count = rejected + 1;
          updates.last_rejection_reason = reasonKey || "other";
        }
        await supabaseApi.drivers.update(driver.id, updates);
        setDriver((prev: any) => (prev ? { ...prev, ...updates } : prev));
      } catch {}
    },
    [driver?.id]
  );

  useEffect(() => {
    // Al iniciar sesión, asegurar permiso de ubicación
    const checkPermissions = async () => {
      const ok = await ensureLocationPermission();
      if (!ok) {
        setShowPermissionsOnboarding(true);
        return;
      }
      const notifState = await getNotificationPermissionState();
      const notifGranted = notifState === "granted" || notifState === "unsupported";
      if (!notifGranted) {
        setShowPermissionsOnboarding(true);
      }
    };
    checkPermissions();
  }, []);

  const locationPermission = useLocationPermission();
  useDarkModeSync();
  useWakeLock();
  const settingsRef = useRef<AppSettings | undefined>(null);

  const queryClient = useQueryClient();
  const getAssignmentSignal = useCallback((ride?: Ride | null) => {
    if (!ride) return "";
    // Include updated_at + status so same-driver reassignment in the same second
    // is still treated as a new assignment and banner is shown again.
    return String(`${ride.assigned_at || ""}_${ride.updated_at || ""}_${ride.status || ""}_${ride.driver_id || ""}`);
  }, []);
  const getDriverOfferTimeoutMs = useCallback((ride?: Ride | null) => {
    const configured = Number(settingsRef.current?.driver_offer_timeout_seconds ?? settingsRef.current?.auction_timeout_seconds ?? 30);
    const safeSeconds = Math.max(5, configured);
    if (ride?.status === "auction" && ride?.auction_expires_at) {
      const remaining = Math.max(0, new Date(ride.auction_expires_at).getTime() - Date.now());
      return remaining;
    }
    return safeSeconds * 1000;
  }, []);
  const isAuctionTargetedToDriver = useCallback((ride: any, driverId: string) => {
    if (!ride || !driverId) return false;
    const directIds = Array.isArray(ride.auction_driver_ids) ? ride.auction_driver_ids : [];
    if (directIds.includes(driverId)) return true;
    const fallbackIds = Array.isArray(ride?.extra_charges?.auction_candidate_driver_ids)
      ? ride.extra_charges.auction_candidate_driver_ids
      : [];
    return fallbackIds.includes(driverId);
  }, []);
  const prefilledEmail = useRef(
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("driverEmail") || ""
  ).current;
  const rejectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      setHelpRideContext(e.detail || null);
      setShowHelp(true);
    };
    window.addEventListener("openDriverHelp", handler);
    return () => window.removeEventListener("openDriverHelp", handler);
  }, []);

  // Restore session
  useEffect(() => {
    const savedId = localStorage.getItem(SESSION_KEY);
    if (savedId && !driver) {
      (async () => {
        try {
          const data = await supabaseApi.drivers.get(savedId);

          if (data) {
            const { password: _, ...d } = data as any;
            setDriver(d);
            if (d.suspended_until && new Date(d.suspended_until) > new Date()) {
              const until = new Date(d.suspended_until).getTime();
              setSuspendedUntil(until);
              localStorage.setItem("driver_suspended_until", String(until));
            } else {
              setSuspendedUntil(null);
              localStorage.removeItem("driver_suspended_until");
            }
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
          setSessionLoading(false);
        } catch {
          setSessionLoading(false);
        }
      })();
    } else {
      setSessionLoading(false);
    }
  }, []);

  useDriverNotifications(driver?.id);
  useEffect(() => {
    if (driver?.id) requestNotificationPermission(driver.id);
  }, [driver?.id]);

  const handleRejectRideRef = useRef<any>(null);

  useEffect(() => {
    if (!driver?.id) return;
    registerDriverSW();

    const handleSWMessage = (event: any) => {
      const msg = event.data || {};

      if (msg.type === "RIDE_TIMEOUT") {
        const rideId = msg.rideId;
        setIncomingRide((prev) => {
          if (prev?.id === rideId) {
            stopNewRideAlarm(rideId);
            handleRejectRideRef.current?.(prev, "timeout");
            return null;
          }
          return prev;
        });
      }

      if (msg.type === "INACTIVITY_TIMEOUT") {
        handleInactivityDisconnectRef.current?.();
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleSWMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
  }, [driver?.id]);

  const handleInactivityDisconnectRef = useRef<any>(null);

  // Admin broadcast notifications
  useEffect(() => {
    if (!driver?.id) return;
    
    const channel = supabase
      .channel(`driver_notificaciones:${driver.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_notificaciones",
          filter: `driver_ids=cs.{${driver.id}}`,
        },
        (payload) => {
          const notif = payload.new as any;
          if (!notif) return;
          showDriverNotification({
            title: notif.title,
            body: notif.body,
            tag: notif.tag || `admin-notif-${notif.id}`,
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [driver?.id]);

  // Realtime subscription for ride requests assigned to this driver
  useEffect(() => {
    if (!driver?.id) return;

    const channel = supabase
      .channel(`driver_rides:${driver.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `driver_id=eq.${driver.id}`,
        },
        async (payload) => {
          const ride = payload.new || payload.old;
          if (!ride) return;

          // Update local ride state
          if (payload.eventType === "UPDATE") {
            setCurrentRide((prev) => prev?.id === ride.id ? { ...prev, ...ride } : prev);
            setActiveRide((prev) => prev?.id === ride.id ? { ...prev, ...ride } : prev);

            // Update location tracker based on ride status
            if (["accepted", "en_route", "arrived", "in_progress"].includes(ride.status)) {
              locationTracker.setRideStatus(true, ride.id);
            } else {
              locationTracker.setRideStatus(false);
            }

            // Handle status changes
            if (ride.status === "cancelled" && prev?.status !== "cancelled") {
              stopNewRideAlarm();
              import("sonner").then(({ toast }) =>
                toast.error(`🚫 Viaje cancelado: ${ride.cancellation_reason || "Cancelado por pasajero"}`)
              );
            } else if (ride.status === "completed" && prev?.status !== "completed") {
              playAcceptedSound();
              import("sonner").then(({ toast }) =>
                toast.success("✅ Viaje completado exitosamente")
              );
            }
          } else if (payload.eventType === "INSERT") {
            // New ride assigned to this driver
            setCurrentRide(ride);
            setActiveRide(ride);
            locationTracker.setRideStatus(true, ride.id);
            startNewRideAlarm();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [driver?.id]);

  const lastLocationSaveRef = useRef(0);
  const watchIdRef = useRef<LiveLocationWatchHandle | null>(null);
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gpsChannelRef = useRef<any>(null);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const driverRef = useRef(driver);
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  const locationIntervalMsRef = useRef(1000); // Reducido a 1 segundo para movimiento fluido tipo Uber

  const saveLocation = useCallback((lat: number, lon: number) => {
    const d = driverRef.current;
    if (!d?.id) return;
    if (!lat || !lon || Math.abs(lat) < 0.001 || Math.abs(lon) < 0.001) return;
    const now = Date.now();
    // Throttle a 1 segundo para movimiento fluido tipo Uber/DiDi (optimizado de 5s)
    if (now - lastLocationSaveRef.current < locationIntervalMsRef.current) return;
    lastLocationSaveRef.current = now;
    // NOTE: GPS movement does NOT reset inactivity timer — only screen touch does.

    // Stream GPS instantly to admin UIs via websocket broadcast para sincronización en tiempo real
    gpsChannelRef.current?.send({
      type: "broadcast",
      event: "location",
      payload: {
        driver_id: d.id,
        latitude: lat,
        longitude: lon,
        status: d.status,
        sent_at: nowCDMX(),
      },
    }).catch(() => {});

    // Keep DB persistence as fallback/audit
    supabaseApi.drivers.update(d.id, { latitude: lat, longitude: lon, last_seen_at: nowCDMX() }).catch(() => {});
  }, []);

  const refreshDriverLocation = useCallback(async () => {
    try {
      const pos = await getCurrentLiveLocation();
      saveLocation(pos.coords.latitude, pos.coords.longitude);
      if (driver?.id) {
        queryClient.invalidateQueries({ queryKey: ["driverRides", driver.id] });
      }
    } catch (err) {
      console.warn("No se pudo actualizar ubicación:", err);
    }
  }, [saveLocation, driver?.id, queryClient]);

  useEffect(() => {
    if (!driver?.id) return;
    const channel = supabase.channel(`gps_driver_${driver.id}`).subscribe();
    gpsChannelRef.current = channel;
    return () => {
      gpsChannelRef.current = null;
      channel.unsubscribe();
    };
  }, [driver?.id]);

  useEffect(() => {
    if (!driver?.id) return;
    const startWatch = async () => {
      await clearLiveLocationWatch(watchIdRef.current);
      watchIdRef.current = await watchLiveLocation(
        (pos) => saveLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => console.warn("GPS error:", err.message)
      );
    };
    void startWatch();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void startWatch();
        void getCurrentLiveLocation()
          .then((pos) => {
            lastLocationSaveRef.current = 0;
            saveLocation(pos.coords.latitude, pos.coords.longitude);
          })
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      void clearLiveLocationWatch(watchIdRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
    };
  }, [driver?.id, saveLocation]);

  // Backup polling para asegurar actualizaciones de GPS incluso si watchPosition falla
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const data = await supabaseApi.settings.list();
      return data || [];
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
  const settings = settingsList[0] as AppSettings | undefined;

  const appLogo = settings?.logo_url;
  const appName = settings?.company_name;

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const company = appName?.trim() || "YAJA Asistencia";
    return syncBrandHead({
      title: `${company} Conductor`,
      logoUrl: appLogo,
      appName: `${company} Conductor`,
      cacheSeed: settings?.updated_at || settings?.updated_date || company,
    });
  }, [appLogo, appName, settings?.updated_at, settings?.updated_date]);

  useEffect(() => {
    if (settings?.timezone) setSystemTimezone(settings.timezone);
  }, [settings?.timezone]);

  useEffect(() => {
    locationIntervalMsRef.current = Math.max(1000, (settings?.driver_location_update_interval_seconds ?? 2) * 1000);
  }, [settings?.driver_location_update_interval_seconds]);

  const computeRideFinalPricing = useCallback(async (ride: Ride, actualEndCoords?: { lat: number; lon: number }) => {
    const fareProtectionEnabled = !!settingsRef.current?.fare_protection_enabled;
    const estimated = Number(ride.estimated_price || 0);

    if (fareProtectionEnabled) {
      return {
        finalPrice: parseFloat(estimated.toFixed(2)),
        distanceKm: Number(ride.distance_km || 0),
        durationMin: 0,
        base: estimated,
        perKm: 0,
        perMinute: 0,
        minimumFare: estimated,
        surgeMultiplier: 1,
        protectedFare: true,
      };
    }

    const serviceType = ride.service_type_id
      ? await supabaseApi.serviceTypes.get(ride.service_type_id).catch(() => null)
      : null;

    const base = Number(serviceType?.base_price ?? settingsRef.current?.base_fare ?? 0);
    const perKm = Number(serviceType?.price_per_km ?? settingsRef.current?.price_per_km ?? 0);
    const perMinute = Number(serviceType?.price_per_minute ?? settingsRef.current?.price_per_minute ?? 0);
    const minimumFare = Number(serviceType?.minimum_fare ?? 0);
    const surgeMultiplier = Number(serviceType?.surge_multiplier ?? 1);

    let durationMin = 0;
    const inProgressAt = ride.in_progress_at || ride.arrived_at || ride.en_route_at;
    if (inProgressAt) {
      const elapsedMs = Date.now() - new Date(inProgressAt).getTime();
      if (Number.isFinite(elapsedMs) && elapsedMs > 0) {
        durationMin = Math.max(1, Math.round(elapsedMs / 60000));
      }
    }

    let distanceKm = Number(ride.distance_km || 0);
    // Prefer actual GPS start/end if available for accurate real distance
    const startLat = (ride as any).actual_start_lat;
    const startLon = (ride as any).actual_start_lon;
    const endLat = actualEndCoords?.lat ?? (ride as any).actual_end_lat;
    const endLon = actualEndCoords?.lon ?? (ride as any).actual_end_lon;
    if (startLat && startLon && endLat && endLon) {
      distanceKm = getDistance(startLat, startLon, endLat, endLon);
    } else if ((!distanceKm || distanceKm <= 0) && ride.pickup_lat && ride.pickup_lon && ride.dropoff_lat && ride.dropoff_lon) {
      distanceKm = getDistance(ride.pickup_lat, ride.pickup_lon, ride.dropoff_lat, ride.dropoff_lon);
    }

    const selectedExtras = Array.isArray(ride.selected_extras)
      ? ride.selected_extras.reduce((sum: number, extra: any) => sum + Number(extra?.price || 0), 0)
      : 0;

    const variable = (base + perKm * Math.max(0, distanceKm) + perMinute * Math.max(0, durationMin)) * Math.max(1, surgeMultiplier);
    const computedFare = Math.max(variable, minimumFare) + selectedExtras;
    const finalPrice = parseFloat((computedFare > 0 ? computedFare : estimated).toFixed(2));

    return {
      finalPrice,
      distanceKm,
      durationMin,
      base,
      perKm,
      perMinute,
      minimumFare,
      surgeMultiplier,
      protectedFare: false,
    };
  }, []);

  const { data: rides = [] } = useQuery({
    queryKey: ["driverRides", driver?.id],
    queryFn: async () => {
      if (!driver?.id) return [];
      const data = await supabaseApi.rideRequests.list({ driver_id: driver.id });
      return data || [];
    },
    enabled: !!driver?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
    staleTime: 0,
  });

  // Calcular activeRides y hasActiveRide aquí para usar en el hook useDriverLocation
  const activeRides = rides.filter((r) => {
    if (["completed", "cancelled"].includes(r.status)) return false;
    if (r.status === "assigned") {
      return !!(r.driver_accepted_at || r.en_route_at || r.arrived_at || r.in_progress_at);
    }
    return true;
  });
  const hasActiveRide = activeRides.some((r) =>
    ["assigned", "admin_approved", "en_route", "arrived", "in_progress"].includes(r.status)
  );

  useEffect(() => {
    if (!driver?.id) return;
    if (driver.status !== "available" && !hasActiveRide) return;

    const backupGpsInterval = setInterval(() => {
      refreshDriverLocation();
    }, 3000);

    return () => clearInterval(backupGpsInterval);
  }, [driver?.id, driver?.status, hasActiveRide, refreshDriverLocation]);

  // Driver location tracking hook - mover aquí antes de los early returns
  const { forceUpdate: forceLocationUpdate } = useDriverLocation({
    driverId: driver?.id || null,
    hasActiveRide,
    rideId: hasActiveRide ? activeRides.find(r => ["assigned", "admin_approved", "en_route", "arrived", "in_progress"].includes(r.status))?.id || null : null,
    enabled: driver?.status === "available" || hasActiveRide,
  });

  useEffect(() => {
    if (!driver?.id) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["driverRides", driver.id] });
        queryClient.invalidateQueries({ queryKey: ["drivers"] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    if (document.visibilityState === "visible") onVisible();
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [driver?.id, queryClient]);

  useEffect(() => {
    if (!driver?.id) return;
    const intervalMs = (settings?.driver_location_update_interval_seconds ?? 20) * 1000;
    if (backupIntervalRef.current) clearInterval(backupIntervalRef.current);
    backupIntervalRef.current = setInterval(() => {
      void getCurrentLiveLocation()
        .then((pos) => saveLocation(pos.coords.latitude, pos.coords.longitude))
        .catch(() => {});
    }, intervalMs);
    return () => {
      if (backupIntervalRef.current) clearInterval(backupIntervalRef.current);
    };
  }, [driver?.id, settings?.driver_location_update_interval_seconds, saveLocation]);

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const data = await supabaseApi.cities.list();
      return data || [];
    },
    enabled: !!driver?.id,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
  });

  // Auto-asignacion activa tambien desde app conductor (no depende del panel admin abierto).
  useRideAutoAssign(settings as any, cities as any, true);

  const outsideGeofence = useGeofenceCheck(driver, cities);

  // Live sync driver
  useEffect(() => {
    if (!driver?.id) return;
    const channel = supabase
      .channel(`driver:${driver.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Driver", filter: `id=eq.${driver.id}` },
        (payload) => {
          const evt = payload.new as Driver;
          if (evt?.id === driver.id) {
            const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
            if (savedToken && evt.access_code && evt.access_code !== savedToken) {
              localStorage.removeItem(SESSION_KEY);
              localStorage.removeItem(SESSION_TOKEN_KEY);
              setDriver(null);
              setSessionKickedOut(true);
              return;
            }
            setDriver((prev) => (prev ? { ...prev, ...evt } : prev));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [driver?.id]);

  useEffect(() => {
    if (!driver?.id) return;

    const verifySession = async () => {
      const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!savedToken) return;
      const current = await supabaseApi.drivers.get(driver.id) as Driver;
      if (current.access_code && current.access_code !== savedToken) {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setDriver(null);
        setSessionKickedOut(true);
      }
    };

    const interval = setInterval(verifySession, 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") verifySession();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [driver?.id]);

  // ─── UNIFIED real-time ride subscription ─────────────────────────────────
  const initializedRef = useRef(false);
  const shownRideAssignmentsRef = useRef<Record<string, string>>({});
  const acceptedRideIdsRef = useRef(new Set<string>());
  const rejectedRideSignalsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!driver?.id) return;
    initializedRef.current = false;
    shownRideAssignmentsRef.current = {};
    acceptedRideIdsRef.current = new Set();
    rejectedRideSignalsRef.current = {};
  }, [driver?.id]);

  useEffect(() => {
    if (!driver?.id) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    rides
      .filter((r) => r.status === "assigned" && r.driver_id === driver.id)
      .forEach((r) => {
        shownRideAssignmentsRef.current[r.id] = getAssignmentSignal(r);
        if (r.driver_accepted_at || r.en_route_at || r.arrived_at || r.in_progress_at) {
          acceptedRideIdsRef.current.add(r.id);
        }
      });
  }, [rides.length > 0 || initializedRef.current, driver?.id, getAssignmentSignal]);

  useEffect(() => {
    if (!driver?.id) return;
    const driverId = driver.id;

    const channel = supabase
      .channel(`ride_updates:${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
        },
        (payload: any) => {
          const eventType = payload.eventType || payload.type;
          const data = (payload.new || null) as Ride | null;
          const oldData = (payload.old || null) as Ride | null;
          const rideId = data?.id || oldData?.id;
          if (!rideId) return;
          const belongsNow = data?.driver_id === driverId;
          const belongedBefore = oldData?.driver_id === driverId;
          const belongsToDriver = belongsNow || belongedBefore;

          // ── 1. Sync cache for rides belonging to this driver ──────────────────
          if (eventType === "DELETE") {
            queryClient.setQueryData(["driverRides", driverId], (old: any[] = []) =>
              old.filter((r) => r.id !== rideId)
            );
          }
          if (eventType === "UPDATE" && belongedBefore && !belongsNow) {
            queryClient.setQueryData(["driverRides", driverId], (old: any[] = []) =>
              old.filter((r) => r.id !== rideId)
            );
          }
          if ((eventType === "INSERT" || eventType === "UPDATE") && belongsNow && data) {
            queryClient.setQueryData(["driverRides", driverId], (old: any[] = []) => {
              if (eventType === "DELETE") return old.filter((r) => r.id !== rideId);
              const idx = old.findIndex((r) => r.id === data.id);
              if (idx === -1) return data.driver_id === driverId ? [data, ...old] : old;
              return old.map((r) => (r.id === data.id ? { ...r, ...data } : r));
            });
          }
          if (
            eventType === "UPDATE" &&
            belongsNow &&
            data &&
            !["completed", "cancelled"].includes(data.status)
          ) {
            queryClient.invalidateQueries({ queryKey: ["driverRides", driverId] });
          }

          // Cancellation from passenger/admin: show breakdown and let driver accept before going online.
          if (eventType === "UPDATE" && data?.status === "cancelled" && belongsToDriver) {
            setIncomingRide((prev) => {
              if (prev?.id === rideId) {
                stopNewRideAlarm(prev.id);
              }
              return prev?.id === rideId ? null : prev;
            });

            if (data.cancelled_by !== "driver") {
              // Show cancellation notice with breakdown; driver must tap "Aceptar" to go back online.
              const pmConfig = { auto_charge: false, require_driver_confirmation: false };
              setRideSummary({ ride: data, paymentMethodConfig: pmConfig, needsRelease: true });
            } else {
              // Driver cancelled themselves — release immediately (handled elsewhere too).
              void releaseDriverToAvailable();
            }
            queryClient.invalidateQueries({ queryKey: ["driverRides", driverId] });
            return;
          }

          if (!data) return;

          // ── 2. Auction ride: show alert to this driver ────────────────────────
          if (
            (eventType === "INSERT" || eventType === "UPDATE") &&
            data.status === "auction" &&
            isAuctionTargetedToDriver(data, driverId)
          ) {
            const prevShown = shownRideAssignmentsRef.current[data.id];
            const isNew = !prevShown || prevShown !== (data.auction_expires_at || data.requested_at);
            if (isNew) {
              shownRideAssignmentsRef.current[data.id] = data.auction_expires_at || data.requested_at || "";
              stopNewRideAlarm(data.id);
              startNewRideAlarm(data.id);
              showDriverNotification({
                title: "🚗 ¡Nuevo servicio disponible!",
                body: `${data.passenger_name || "Pasajero"} · ${data.pickup_address || ""}`,
                rideId: data.id,
              });
              const auctionTimeoutMs = getDriverOfferTimeoutMs(data);
              startSWRideTimer(data.id, auctionTimeoutMs, data.passenger_name, data.pickup_address);
              setIncomingRide(data);
            }
            return;
          }

          // ── 3. Direct assignment (auto/manual): show alert ────────────────────
          if (eventType === "UPDATE" && data.status === "assigned" && data.driver_id === driverId) {
            const prevShownAt = shownRideAssignmentsRef.current[data.id];
            const thisAssignmentAt = getAssignmentSignal(data);
            const isNewAssignment = !prevShownAt || prevShownAt !== thisAssignmentAt;
            const alreadyAccepted = acceptedRideIdsRef.current.has(data.id);
            const wasRejectedThisAssignment = rejectedRideSignalsRef.current[data.id] === thisAssignmentAt;
            if (isNewAssignment && !alreadyAccepted) {
              const isManualAssignment = data.assignment_mode === "manual";
              shownRideAssignmentsRef.current[data.id] = thisAssignmentAt || "";
              if (rejectedRideSignalsRef.current[data.id] && rejectedRideSignalsRef.current[data.id] !== thisAssignmentAt) {
                delete rejectedRideSignalsRef.current[data.id];
              }
              if (wasRejectedThisAssignment) return;
              stopNewRideAlarm(data.id);
              startNewRideAlarm(data.id);
              showDriverNotification({
                title: isManualAssignment ? "🚗 ¡Nuevo servicio!" : "🚗 ¡Servicio asignado!",
                body: isManualAssignment
                  ? `${data.passenger_name || "Pasajero"} · ${data.pickup_address || ""}`
                  : `Recoge a ${data.passenger_name || "Pasajero"} · ${data.pickup_address || ""}`,
                rideId: data.id,
              });
              const assignTimeoutMs = getDriverOfferTimeoutMs(data);
              startSWRideTimer(data.id, assignTimeoutMs, data.passenger_name, data.pickup_address);
              setIncomingRide(data);
            }
            return;
          }

          // ── 4. Ride no longer available for this driver ──
          if (eventType === "UPDATE") {
            if (data.driver_id && data.driver_id !== driverId && data.status === "assigned") {
              delete shownRideAssignmentsRef.current[data.id];
              acceptedRideIdsRef.current.delete(data.id);
              delete rejectedRideSignalsRef.current[data.id];
            }

            setIncomingRide((prev) => {
              if (!prev || prev.id !== data.id) return prev;
              const takenByOther = data.status === "assigned" && data.driver_id && data.driver_id !== driverId;
              const noLongerAuction =
                prev.status === "auction" && data.status !== "auction" && data.driver_id !== driverId;
              const cancelled = data.status === "cancelled";
              const revertedToPending = data.status === "pending" && !data.driver_id;
              if (takenByOther || noLongerAuction || cancelled || revertedToPending) {
                stopNewRideAlarm(prev.id);
                if (driverRef.current?.status === "busy") {
                  void releaseDriverToAvailable();
                }
                return null;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [driver?.id, queryClient, getAssignmentSignal, releaseDriverToAvailable]);

  // ─── REAL-TIME incoming ride notifications channel ─────────────────────
  useEffect(() => {
    if (!driver?.id) return;
    const driverId = driver.id;

    const handleBroadcast = async (message: any) => {
      const payload = message?.payload || {};
      const broadcastRide = payload?.new || payload?.record || null;

      let notificationType = payload?.notification_type as string | undefined;
      let rideId = payload?.ride_id as string | undefined;
      let rideData = payload?.ride_data as any;

      // Support payloads emitted by realtime.broadcast_changes (event: UPDATE)
      if (!rideId && broadcastRide?.id) {
        rideId = broadcastRide.id;
        rideData = broadcastRide;

        if (
          broadcastRide.status === "assigned" &&
          broadcastRide.driver_id === driverId
        ) {
          notificationType = "ride_assigned";
        } else if (
          broadcastRide.status === "auction" &&
          isAuctionTargetedToDriver(broadcastRide, driverId)
        ) {
          notificationType = "ride_offer";
        }
      }

      if (!rideId || !notificationType) return;

      queryClient.invalidateQueries({ queryKey: ["driverRides", driverId] });

      if (notificationType === "ride_assigned") {
        const isManualAssignment = rideData?.assignment_mode === "manual";
        showDriverNotification({
          title: isManualAssignment ? "🚗 ¡Nuevo servicio!" : "🚗 ¡Servicio asignado!",
          body: isManualAssignment
            ? `${rideData?.passenger_name || "Pasajero"} · ${rideData?.pickup_address || ""}`
            : `Recoge a ${rideData?.passenger_name || "Pasajero"} · ${rideData?.pickup_address || ""}`,
          rideId,
        });
        const current = await supabaseApi.rideRequests.get(rideId).catch(() => null);
        if (current?.status === "assigned" && current?.driver_id === driverId) {
          const assignmentSignal = getAssignmentSignal(current);
          if (rejectedRideSignalsRef.current[rideId] === assignmentSignal) return;
          setIncomingRide(current);
        }
        startNewRideAlarm(rideId);
        const assignTimeoutMs = getDriverOfferTimeoutMs(current || rideData);
        startSWRideTimer(
          rideId,
          assignTimeoutMs,
          rideData?.passenger_name || "Pasajero",
          rideData?.pickup_address || ""
        );
        return;
      }

      if (notificationType === "ride_offer") {
        showDriverNotification({
          title: "🚗 ¡Nuevo servicio disponible!",
          body: `${rideData?.passenger_name || "Pasajero"} · ${rideData?.pickup_address || ""}`,
          rideId,
        });
        const current = await supabaseApi.rideRequests.get(rideId).catch(() => null);
        if (
          current?.status === "auction" &&
          isAuctionTargetedToDriver(current, driverId)
        ) {
          setIncomingRide(current);
        }
        startNewRideAlarm(rideId);
        const auctionTimeoutMs = getDriverOfferTimeoutMs(current || rideData);
        startSWRideTimer(
          rideId,
          auctionTimeoutMs,
          rideData?.passenger_name || "Pasajero",
          rideData?.pickup_address || ""
        );
      }
    };

    const notificationChannel = supabase
      .channel(`driver:${driverId}:incoming-rides`)
      .on("broadcast", { event: "new_ride_notification" }, handleBroadcast)
      .on("broadcast", { event: "UPDATE" }, handleBroadcast)
      .subscribe();

    return () => {
      notificationChannel.unsubscribe();
    };
  }, [driver?.id, queryClient]);

  // Fallback: if realtime misses an auction UPDATE/INSERT, poll active auctions briefly
  // and surface the offer to drivers included in auction_driver_ids.
  useEffect(() => {
    if (!driver?.id) return;
    const driverId = driver.id;
    let cancelled = false;

    const pollAuctionOffers = async () => {
      try {
        const auctions = await supabaseApi.rideRequests.list({ status: "auction" });
        if (cancelled || !Array.isArray(auctions) || auctions.length === 0) return;

        const now = Date.now();
        const candidate = auctions
          .filter((r: any) => isAuctionTargetedToDriver(r, driverId))
          .filter((r: any) => {
            if (!r?.auction_expires_at) return true;
            return new Date(r.auction_expires_at).getTime() > now;
          })
          .sort((a: any, b: any) => {
            const ta = new Date(a.updated_at || a.requested_at || 0).getTime();
            const tb = new Date(b.updated_at || b.requested_at || 0).getTime();
            return tb - ta;
          })[0];

        if (!candidate) return;

        const signature = candidate.auction_expires_at || candidate.requested_at || "";
        const prevShown = shownRideAssignmentsRef.current[candidate.id];
        if (prevShown === signature) return;

        shownRideAssignmentsRef.current[candidate.id] = signature;
        stopNewRideAlarm(candidate.id);
        startNewRideAlarm(candidate.id);
        showDriverNotification({
          title: "🚗 ¡Nuevo servicio disponible!",
          body: `${candidate.passenger_name || "Pasajero"} · ${candidate.pickup_address || ""}`,
          rideId: candidate.id,
        });
        const auctionTimeoutMs = getDriverOfferTimeoutMs(candidate);
        startSWRideTimer(candidate.id, auctionTimeoutMs, candidate.passenger_name, candidate.pickup_address);
        setIncomingRide((prev) => (prev?.id === candidate.id ? { ...prev, ...candidate } : candidate));
      } catch {
      }
    };

    void pollAuctionOffers();
    const iv = setInterval(pollAuctionOffers, 5000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [driver?.id, getDriverOfferTimeoutMs, isAuctionTargetedToDriver]);

  const { data: surveys = [] } = useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const data = await supabaseApi.surveys.list();
      return data || [];
    },
    enabled: !!driver?.id,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const processOfflineAction = useCallback(async (action: OfflineOutboxAction) => {
    if (action.actionType !== "ride_update") return true;
    const currentRide = await supabaseApi.rideRequests.get(action.rideId).catch(() => null);
    if (!currentRide) return false;
    const mergedExtra = buildReconciliationExtra(currentRide.extra_charges, action);
    await supabaseApi.rideRequests.update(action.rideId, {
      ...action.updates,
      extra_charges: mergedExtra,
    });
    return true;
  }, []);

  useEffect(() => {
    if (!driver?.id) return;

    const sync = async () => {
      if (!isOnlineNow()) return;
      await flushOfflineOutbox(processOfflineAction);
      queryClient.invalidateQueries({ queryKey: ["driverRides", driver.id] });
    };

    sync();
    const onOnline = () => {
      sync();
      toast.success("Conexion recuperada. Sincronizando acciones pendientes...");
    };
    window.addEventListener("online", onOnline);
    const iv = setInterval(sync, 45 * 1000);

    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(iv);
    };
  }, [driver?.id, processOfflineAction, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ride, newStatus }: { ride: Ride; newStatus: string }) => {
      const online = isOnlineNow();
      const irreversible = newStatus === "completed";
      if (!online && irreversible) {
        throw new Error("Sin internet: no puedes completar un viaje offline por seguridad.");
      }

      const now = nowCDMX();
      const updates: any = { status: newStatus };
      if (newStatus === "en_route") {
        updates.driver_accepted_at = ride.driver_accepted_at || now;
        updates.en_route_at = now;
      }
      if (newStatus === "arrived") updates.arrived_at = now;
      if (newStatus === "in_progress") {
        updates.in_progress_at = now;
        try {
          const pos = await getCurrentLiveLocation();
          updates.actual_start_lat = pos.coords.latitude;
          updates.actual_start_lon = pos.coords.longitude;
        } catch { /* GPS optional */ }
      }
      if (newStatus === "completed") {
        let actualEndCoords: { lat: number; lon: number } | undefined;
        try {
          const pos = await getCurrentLiveLocation();
          actualEndCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          updates.actual_end_lat = pos.coords.latitude;
          updates.actual_end_lon = pos.coords.longitude;
        } catch { /* GPS optional */ }
        const pricing = await computeRideFinalPricing(ride, actualEndCoords);
        updates.completed_at = now;
        const commissionRate = driver?.commission_rate ?? settings?.platform_commission_pct ?? 20;
        const price = pricing.finalPrice;
        const driverEarnings = parseFloat((price * (1 - commissionRate / 100)).toFixed(2));
        updates.final_price = price;
        updates.driver_earnings = driverEarnings;
        updates.platform_commission = parseFloat((price * (commissionRate / 100)).toFixed(2));
        updates.rating_window_expires_at = futureCDMX((settings?.rating_window_minutes ?? 1440) * 60000);
        updates.extra_charges = {
          ...(ride.extra_charges && typeof ride.extra_charges === "object" ? ride.extra_charges : {}),
          pricing_audit: {
            mode: pricing.protectedFare ? "protected" : "dynamic",
            distance_km: pricing.distanceKm,
            duration_min: pricing.durationMin,
            base: pricing.base,
            per_km: pricing.perKm,
            per_minute: pricing.perMinute,
            minimum_fare: pricing.minimumFare,
            surge_multiplier: pricing.surgeMultiplier,
            actual_start_lat: updates.actual_start_lat ?? (ride as any).actual_start_lat,
            actual_start_lon: updates.actual_start_lon ?? (ride as any).actual_start_lon,
            actual_end_lat: updates.actual_end_lat,
            actual_end_lon: updates.actual_end_lon,
          },
        };

        await supabaseApi.drivers.update(driver?.id || "", {
            status: "available",
            total_rides: (driver?.total_rides || 0) + 1,
            total_earnings: (driver?.total_earnings || 0) + driverEarnings,
          });

        setDriver((prev) =>
          prev
            ? {
                ...prev,
                status: "available",
                total_rides: (prev.total_rides || 0) + 1,
              }
            : prev
        );
      }

      if (!online) {
        await enqueueRideUpdateOffline({
          role: "driver",
          rideId: ride.id,
          updates,
        });
        toast.warning("Sin internet: accion guardada para sincronizacion.");
        return { queued: true };
      }

      await supabaseApi.rideRequests.update(ride.id, updates);
      return { queued: false };
    },
    onMutate: async ({ ride, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["driverRides", driver?.id] });
      const prev = queryClient.getQueryData(["driverRides", driver?.id]);
      queryClient.setQueryData(["driverRides", driver?.id], (old: any[] = []) =>
        old.map((r) => (r.id === ride.id ? { ...r, status: newStatus } : r))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["driverRides", driver?.id], ctx.prev);
    },
    onSettled: (data) => {
      if (!data?.queued) {
        queryClient.invalidateQueries({ queryKey: ["driverRides"] });
      }
    },
  });

  const getPaymentMethodConfig = useCallback(
    (paymentMethod: string) => {
      const pms = settings?.payment_methods || [];
      const pm = pms.find((m) => m.key === paymentMethod);
      if (!pm) {
        return {
          auto_charge: paymentMethod === "company" || paymentMethod === "transfer",
          require_driver_confirmation: paymentMethod === "cash",
        };
      }
      return {
        auto_charge: !!pm.auto_charge,
        require_driver_confirmation: pm.require_driver_confirmation !== false && !pm.auto_charge,
      };
    },
    [settings?.payment_methods]
  );

  const handleUpdateStatus = useCallback(
    async (ride: Ride, newStatus: string) => {
      if (newStatus === "completed" && ride.company_id) {
        let survey = surveys.find(
          (s) => s.is_active !== false && (s.company_ids || []).includes(ride.company_id)
        );
        if (!survey) {
          const comps = await supabaseApi.companies.get(ride.company_id).catch(() => null);
          if (comps?.survey_id) {
            survey = surveys.find(
              (s) => s.id === comps.survey_id && s.is_active !== false
            );
          }
        }
        if (survey) {
          const existing = await supabaseApi.surveyResponses.list();
          const rideResponses = existing.filter((r: any) => r.ride_id === ride.id);

          if (rideResponses.length === 0) {
            setPendingSurvey({ survey, ride });
            return;
          }
        }
      }
      await updateStatusMutation.mutateAsync({ ride, newStatus });
      if (newStatus === "completed") {
        const pricing = await computeRideFinalPricing(ride);
        const pmConfig = getPaymentMethodConfig(ride.payment_method || "cash");
        const commissionRate = driver?.commission_rate ?? settings?.platform_commission_pct ?? 20;
        const price = pricing.finalPrice;
        const driverEarnings = parseFloat((price * (1 - commissionRate / 100)).toFixed(2));
        const platformCommission = parseFloat((price * (commissionRate / 100)).toFixed(2));
        const completedRide = {
          ...ride,
          status: "completed",
          final_price: price,
          driver_earnings: driverEarnings,
          platform_commission: platformCommission,
          commission_rate: commissionRate,
        };
        setRideSummary({ ride: completedRide, paymentMethodConfig: pmConfig });
      }
    },
    [updateStatusMutation, surveys, getPaymentMethodConfig, driver?.id, settings, queryClient, computeRideFinalPricing]
  );

  const handleAcceptRide = async () => {
    if (!incomingRide) return;
    const ride = incomingRide;
    const acceptedAt = nowCDMX();
    stopNewRideAlarm(ride.id);
    cancelSWRideTimer(ride.id);
    setIncomingRide(null);

    acceptedRideIdsRef.current.add(ride.id);
    delete rejectedRideSignalsRef.current[ride.id];

    // Optimistic update to avoid the banner reopening with stale data.
    queryClient.setQueryData(["driverRides", driver?.id], (old: Ride[] = []) =>
      old.map((r) =>
        r.id === ride.id
          ? {
              ...r,
              status: ride.status === "auction" ? "assigned" : r.status,
              driver_id: driver?.id,
              driver_name: driver?.full_name,
              assignment_mode: ride.status === "auction" ? "auction" : r.assignment_mode,
              driver_accepted_at: acceptedAt,
            }
          : r
      )
    );

    if (ride.status === "auction") {
      const current = await supabaseApi.rideRequests.get(ride.id).catch(() => null);

      if (!current || current.status !== "auction") return;

      await Promise.all([
        supabaseApi.rideRequests.update(ride.id, {
            status: "assigned",
            driver_id: driver?.id,
            driver_name: driver?.full_name,
            assignment_mode: "auction",
            driver_accepted_at: acceptedAt,
          }),
        supabaseApi.drivers.update(driver?.id || "", { status: "busy" })
      ]);
    } else if (ride.status === "assigned" && ride.driver_id === driver?.id) {
      await Promise.all([
        supabaseApi.rideRequests.update(ride.id, {
          driver_accepted_at: acceptedAt,
        }),
        supabaseApi.drivers.update(driver?.id || "", { status: "busy" })
      ]);
    }

    // Update local driver state
    setDriver((prev) => (prev ? { ...prev, status: "busy" } : prev));
    await registerDriverOfferResult("accepted");

    playAcceptedSound();
    queryClient.invalidateQueries({ queryKey: ["driverRides", driver?.id] });
  };

  const handleRejectRide = async (ride: Ride | null, reason: string = "driver_declined", cancellationFeeAmount: number = 0) => {
    if (ride?.id) {
      rejectedRideSignalsRef.current[ride.id] = getAssignmentSignal(ride);
      stopNewRideAlarm(ride.id);
      cancelSWRideTimer(ride.id);
    }
    setIncomingRide(null);

    const online = isOnlineNow();
    if (!online && (reason === "wait_time_expired" || reason === "driver_cancelled")) {
      toast.error("Sin internet: no puedes cancelar este viaje offline por seguridad.");
      return;
    }

    // ─── Wait time expired cancellation (no suspension, fee applied) ──────────
    const isWaitTimeExpired = reason === "wait_time_expired" && ride?.id && ride?.status === "arrived";
    if (isWaitTimeExpired) {
      const commissionRate = driver?.commission_rate ?? settingsRef.current?.platform_commission_pct ?? 20;
      const driverEarnings = parseFloat((cancellationFeeAmount * (1 - commissionRate / 100)).toFixed(2));
      const platformCommission = parseFloat((cancellationFeeAmount * (commissionRate / 100)).toFixed(2));
      const cancelledRide = {
        ...ride,
        status: "cancelled",
        cancelled_by: "driver",
        cancellation_reason: "Tiempo de espera agotado",
        cancellation_fee: cancellationFeeAmount,
        final_price: cancellationFeeAmount,
        driver_earnings: driverEarnings,
        platform_commission: platformCommission,
      };
      await supabaseApi.rideRequests.update(ride.id, {
        status: "cancelled",
        cancelled_by: "driver",
        cancellation_reason: "Tiempo de espera agotado",
        cancellation_fee: cancellationFeeAmount,
        final_price: cancellationFeeAmount,
        driver_earnings: driverEarnings,
        platform_commission: platformCommission,
      });
      await supabaseApi.drivers.update(driver?.id || "", { status: "available" });
      setDriver((prev) => (prev ? { ...prev, status: "available" } : prev));
      const pms = settingsRef.current?.payment_methods || [];
      const pm = pms.find((m: any) => m.key === (ride?.payment_method || "cash"));
      const pmConfig = pm
        ? { auto_charge: !!pm.auto_charge, require_driver_confirmation: pm.require_driver_confirmation !== false && !pm.auto_charge }
        : { auto_charge: false, require_driver_confirmation: true };
      setTimeout(() => setRideSummary({ ride: cancelledRide, paymentMethodConfig: pmConfig }), 500);
      queryClient.invalidateQueries({ queryKey: ["driverRides"] });
      return;
    }

    const isActiveCancellation =
      reason === "driver_cancelled" &&
      ride?.id &&
      ["en_route", "arrived", "in_progress", "assigned", "admin_approved"].includes(ride?.status);

    if (isActiveCancellation) {
      const cancelledRide = {
        ...ride,
        status: "cancelled",
        cancelled_by: "driver",
        cancellation_reason: "Cancelado por el conductor",
      };
      const pms = settingsRef.current?.payment_methods || [];
      const pm = pms.find((m) => m.key === (ride?.payment_method || "cash"));
      const pmConfig = pm
        ? {
            auto_charge: !!pm.auto_charge,
            require_driver_confirmation: pm.require_driver_confirmation !== false && !pm.auto_charge,
          }
        : { auto_charge: false, require_driver_confirmation: true };
      setTimeout(() => setRideSummary({ ride: cancelledRide, paymentMethodConfig: pmConfig }), 500);
    }

    const isCancelByDriver = reason === "driver_cancelled";
    const isOfferRejection = !["wait_time_expired", "driver_cancelled", "assigned"].includes(String(reason || ""));
    const suspensionMinutes = Number(settingsRef.current?.driver_cancel_suspension_minutes ?? 30);
    const suspensionMs = Math.max(1, suspensionMinutes) * 60 * 1000;

    if (isOfferRejection) {
      await registerDriverOfferResult("rejected", reason || "other");
    }

    if (
      isCancelByDriver &&
      ride?.id &&
      ["en_route", "arrived", "in_progress", "assigned", "admin_approved"].includes(ride?.status)
    ) {
      await supabaseApi.rideRequests.update(ride.id, {
          status: "cancelled",
          cancelled_by: "driver",
          cancellation_reason: "Cancelado por el conductor",
          cancellation_fee: 0,
          final_price: 0,
          driver_earnings: 0,
          platform_commission: 0,
        });

      const suspendUntil = Date.now() + suspensionMs;
      const suspendUntilISO = futureCDMX(suspensionMs);
      await supabaseApi.drivers.update(driver?.id || "", { status: "offline", suspended_until: suspendUntilISO });

      setDriver((prev) => (prev ? { ...prev, status: "offline", suspended_until: suspendUntilISO } : prev));
      setSuspendedUntil(suspendUntil);
      localStorage.setItem("driver_suspended_until", String(suspendUntil));
      queryClient.invalidateQueries({ queryKey: ["driverRides"] });
      return;
    }

    if (ride?.status === "auction") {
      if (isOfferRejection) {
        if (driver?.status !== "available") {
          await supabaseApi.drivers.update(driver?.id || "", { status: "available" });
          setDriver((prev) => (prev ? { ...prev, status: "available" } : prev));
        }
      }
      return;
    }

    const prevExcluded = Array.isArray(ride?._excluded_driver_ids) ? ride._excluded_driver_ids : [];
    const excludedIds = [...new Set([...(prevExcluded || []), ride?.driver_id || driver?.id].filter(Boolean))];

    // Reset ride to pending so it can be reassigned
    const pendingUpdate = {
      status: "pending",
      driver_id: null,
      driver_name: null,
      _excluded_driver_ids: excludedIds,
    };

    if (!online) {
      await enqueueRideUpdateOffline({
        role: "driver",
        rideId: ride?.id || "",
        updates: pendingUpdate,
      });
      toast.warning("Sin internet: rechazo guardado para sincronizacion.");
    } else {
      await supabaseApi.rideRequests.update(ride?.id || "", pendingUpdate);
    }

    if (isCancelByDriver) {
      const suspendUntil = Date.now() + suspensionMs;
      const suspendUntilISO = futureCDMX(suspensionMs);
      await supabaseApi.drivers.update(driver?.id || "", { status: "offline", suspended_until: suspendUntilISO });
      setDriver((prev) => (prev ? { ...prev, status: "offline", suspended_until: suspendUntilISO } : prev));
      setSuspendedUntil(suspendUntil);
      localStorage.setItem("driver_suspended_until", String(suspendUntil));
    } else if (isOfferRejection) {
      await supabaseApi.drivers.update(driver?.id || "", { status: "available" });
      setDriver((prev) => (prev ? { ...prev, status: "available" } : prev));
    } else if (reason && !["timeout", "assigned"].includes(reason)) {
      await supabaseApi.drivers.update(driver?.id || "", { status: "available" });
      setDriver((prev) => (prev ? { ...prev, status: "available" } : prev));
    } else {
      await supabaseApi.drivers.update(driver?.id || "", { status: "available" });
    }
    queryClient.invalidateQueries({ queryKey: ["driverRides"] });
  };

  useEffect(() => {
    handleRejectRideRef.current = handleRejectRide;
  }, [handleRejectRide]);

  const handleSelectVehicle = async (v: any) => {
    const vehicles = (driver?.vehicles || []).map((x) => ({ ...x, is_active: x.id === v.id }));
    const vf = {
      vehicle_brand: v.brand,
      vehicle_model: v.model,
      vehicle_year: v.year,
      vehicle_color: v.color,
      license_plate: v.plates,
    };
    await supabaseApi.drivers.update(driver?.id || "", { status: "available", vehicles, ...vf });
    setDriver((prev) => (prev ? { ...prev, status: "available", vehicles, ...vf } : prev));
    setShowVehicleSelector(false);
  };

  const toggleOnline = async () => {
    if (driver?.status === "suspended" || driver?.status === "blocked") return;
    if (driver?.status !== "available") {
      // Revalida en tiempo real para evitar bloqueos falsos por estado local desactualizado.
      const liveLocationPermission = await getLocationPermissionState();
      if (liveLocationPermission !== "granted") {
        setShowPermissionsOnboarding(true);
        return;
      }

      if ((await getNotificationPermissionState()) !== "granted") {
        await requestNotificationPermission(driver?.id || undefined);
      }

      const personalDocs = settings?.driver_required_docs || [];
      const docExpiries = driver?.doc_expiries || {};
      const expiredPersonalDoc = personalDocs.find((doc) => {
        if (doc.require_expiry === false) return false;
        const expiry = docExpiries[doc.key];
        if (!expiry) return false;
        return new Date(expiry) < new Date();
      });
      if (expiredPersonalDoc) {
        import("sonner").then(({ toast }) =>
          toast.error(
            `❌ No puedes conectarte: "${expiredPersonalDoc.label}" está vencido. Actualiza el documento y espera aprobación del administrador.`,
            { duration: 8000 }
          )
        );
        return;
      }

      const vehicles = driver?.vehicles || [];
      const vehicleDocs = settings?.driver_vehicle_docs || [];
      let targetVehicles = vehicles.length > 1 ? undefined : vehicles;

      if (vehicles.length > 1) {
        setShowVehicleSelector(true);
        return;
      }

      const av = vehicles.find((v) => v.is_active) || vehicles[0];
      if (av && vehicleDocs.length > 0) {
        const vtype = av.vehicle_type || "car";
        const docs = vehicleDocs.filter(
          (d) =>
            d.require_expiry !== false &&
            (!d.applies_to || d.applies_to === "both" || d.applies_to === vtype)
        );
        const expiredVehicleDoc = docs.find((doc) => {
          const expiry = av[`doc_${doc.key}_expiry`];
          if (!expiry) return false;
          return new Date(expiry) < new Date();
        });
        if (expiredVehicleDoc) {
          import("sonner").then(({ toast }) =>
            toast.error(
              `❌ No puedes conectarte: "${expiredVehicleDoc.label}" del vehículo está vencido. Actualiza el documento en tu perfil.`,
              { duration: 8000 }
            )
          );
          return;
        }
      }

      const vf = av
        ? {
            vehicle_brand: av.brand,
            vehicle_model: av.model,
            vehicle_year: av.year,
            vehicle_color: av.color,
            license_plate: av.plates,
          }
        : {};

      if (driver?.rest_required_until && new Date(driver.rest_required_until) > new Date()) {
        const until = new Date(driver.rest_required_until).toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        });
        import("sonner").then(({ toast }) =>
          toast.error(`⛔ Debes descansar hasta las ${until} antes de reconectarte.`, {
            duration: 8000,
          })
        );
        return;
      }

      try {
        await supabaseApi.drivers.update(driver?.id || "", { status: "available", online_since: nowCDMX(), ...vf });
        setDriver((prev) => (prev ? { ...prev, status: "available", ...vf } : prev));
        // Start location tracking
        await locationTracker.start(driver?.id || "");
        // Force immediate location update
        await locationTracker.forceUpdate();
      } catch (e) {
        import("sonner").then(({ toast }) =>
          toast.error("Error al conectarte. Intenta de nuevo.")
        );
        return;
      }

      lastLocationSaveRef.current = 0;
      void getCurrentLiveLocation()
        .then((pos) => saveLocation(pos.coords.latitude, pos.coords.longitude))
        .catch(() => {});
      return;
    }

    if (driver?.online_since) {
      const worked = Math.round((Date.now() - new Date(driver.online_since).getTime()) / 60000);
      const newAccumulated = (driver.accumulated_work_minutes || 0) + worked;
      const s = settingsRef.current;
      const workMaxMins = (s?.work_max_hours ?? 12) * 60;
      const restRatio = Number(s?.work_rest_ratio ?? 0.5);
      const restTriggerMins = s?.work_rest_trigger_minutes ?? 60;
      const longRestMins = s?.work_long_rest_minutes ?? 360;

      let restUntil = null;
      let resetAccumulated = false;

      if (newAccumulated >= workMaxMins) {
        restUntil = futureCDMX(longRestMins * 60000);
        resetAccumulated = true;
      } else {
        const restPerTriggerMins = restRatio <= 1 ? restTriggerMins * restRatio : restRatio;
        const earnedRestMins = Math.floor(worked / restTriggerMins) * restPerTriggerMins;
        if (earnedRestMins > 0) {
          restUntil = futureCDMX(earnedRestMins * 60000);
        }
      }

      await supabaseApi.drivers.update(driver?.id || "", {
          status: "offline",
          online_since: null,
          accumulated_work_minutes: resetAccumulated ? 0 : newAccumulated,
          ...(restUntil ? { rest_required_until: restUntil } : {}),
        });

      setDriver((prev) =>
        prev
          ? {
              ...prev,
              status: "offline",
              online_since: null,
              accumulated_work_minutes: resetAccumulated ? 0 : newAccumulated,
              ...(restUntil ? { rest_required_until: restUntil } : {}),
            }
          : prev
      );
      // Stop location tracking
      await locationTracker.stop();
    } else {
      await supabaseApi.drivers.update(driver?.id || "", { status: "offline" });
      setDriver((prev) => (prev ? { ...prev, status: "offline" } : prev));
      // Stop location tracking
      await locationTracker.stop();
    }
  };

  const handleSelectVehicleWithCheck = async (v: any) => {
    const vehicleDocs = settings?.driver_vehicle_docs || [];
    const vtype = v.vehicle_type || "car";
    const docs = vehicleDocs.filter(
      (d) =>
        d.require_expiry !== false &&
        (!d.applies_to || d.applies_to === "both" || d.applies_to === vtype)
    );
    const expiredVehicleDoc = docs.find((doc) => {
      const expiry = v[`doc_${doc.key}_expiry`];
      if (!expiry) return false;
      return new Date(expiry) < new Date();
    });
    if (expiredVehicleDoc) {
      import("sonner").then(({ toast }) =>
        toast.error(
          `❌ Este vehículo tiene "${expiredVehicleDoc.label}" vencido. Actualiza el documento antes de usarlo.`,
          { duration: 8000 }
        )
      );
      return;
    }
    await handleSelectVehicle(v);
  };

  const handleInactivityDisconnect = useCallback(async () => {
    if (!driver?.id || driver.status !== "available") return;
    const reason = "Desconexión automática por inactividad";
    await supabaseApi.drivers.update(driver.id, { status: "offline", last_disconnect_reason: reason });
    setDriver((prev) => (prev ? { ...prev, status: "offline", last_disconnect_reason: reason } : prev));
    setInactivityWarning(false);
    stopDriverHeartbeat();
    import("sonner").then(({ toast }) => toast.warning("⚠️ " + reason, { duration: 10000 }));
    showDriverNotification({
      title: "⚠️ Desconexión automática",
      body: reason,
      tag: "inactivity-disconnect",
    });
  }, [driver?.id, driver?.status]);

  useEffect(() => {
    handleInactivityDisconnectRef.current = handleInactivityDisconnect;
  }, [handleInactivityDisconnect]);

  useEffect(() => {
    if (!driver?.id || driver.status !== "available") {
      stopDriverHeartbeat();
      return;
    }
    const inactivityMs = (settings?.driver_inactivity_timeout_minutes ?? 30) * 60 * 1000;

    const syncHeartbeat = () => {
      const idleMs = Date.now() - _lastActivity.t;
      const remainingMs = Math.max(1000, inactivityMs - idleMs);
      sendDriverHeartbeat(remainingMs);
    };

    syncHeartbeat();
    const iv = setInterval(syncHeartbeat, 60 * 1000);
    return () => {
      clearInterval(iv);
    };
  }, [driver?.id, driver?.status, settings?.driver_inactivity_timeout_minutes]);

  useInactivityAutoDisconnect({
    driver,
    settings,
    onDisconnect: handleInactivityDisconnect,
    onWarn: () => setInactivityWarning(true),
  });

  useEffect(() => {
    if (!driver?.id || driver.status !== "available") return;
    const checkExpiredDocs = () => {
      const d = driverRef.current;
      if (!d || d.status !== "available") return;
      const s = settingsRef.current;

      const personalDocs = s?.driver_required_docs || [];
      const docExpiries = d.doc_expiries || {};
      const expiredPersonal = personalDocs.find((doc) => {
        if (doc.require_expiry === false) return false;
        const expiry = docExpiries[doc.key];
        return expiry && new Date(expiry) < new Date();
      });
      if (expiredPersonal) {
        const reason = `Desconexión automática: "${expiredPersonal.label}" está vencido`;
        supabaseApi.drivers.update(d.id, { status: "offline", last_disconnect_reason: reason });
        setDriver((prev) =>
          prev ? { ...prev, status: "offline", last_disconnect_reason: reason } : prev
        );
        import("sonner").then(({ toast }) =>
          toast.error(`⚠️ ${reason}. Actualiza el documento y espera aprobación.`, {
            duration: 10000,
          })
        );
        return;
      }

      const vehicles = d.vehicles || [];
      const av = vehicles.find((v) => v.is_active) || vehicles[0];
      if (!av) return;
      const vehicleDocs = s?.driver_vehicle_docs || [];
      const vtype = av.vehicle_type || "car";
      const docs = vehicleDocs.filter(
        (doc) =>
          doc.require_expiry !== false &&
          (!doc.applies_to || doc.applies_to === "both" || doc.applies_to === vtype)
      );
      const expiredVehicle = docs.find((doc) => {
        const expiry = av[`doc_${doc.key}_expiry`];
        return expiry && new Date(expiry) < new Date();
      });
      if (expiredVehicle) {
        const reason = `Desconexión automática: "${expiredVehicle.label}" del vehículo está vencido`;
        supabaseApi.drivers.update(d.id, { status: "offline", last_disconnect_reason: reason });
        setDriver((prev) =>
          prev ? { ...prev, status: "offline", last_disconnect_reason: reason } : prev
        );
        import("sonner").then(({ toast }) =>
          toast.error(`⚠️ ${reason}. Actualiza el documento en tu perfil.`, {
            duration: 10000,
          })
        );
      }
    };
    const iv = setInterval(checkExpiredDocs, 60 * 1000);
    return () => clearInterval(iv);
  }, [driver?.id, driver?.status]);

  const handleLogout = async () => {
    const msg = hasActiveRide
      ? "Tienes un servicio activo. ¿Seguro que deseas cerrar sesión?"
      : "¿Deseas cerrar sesión?";
    if (!window.confirm(msg)) return;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    if (driver?.id) {
      await supabaseApi.drivers.update(driver.id, { status: "offline", access_code: null });
    }
    setDriver(null);
  };

  const sendSOS = async () => {
    if (!window.confirm("¿Enviar alerta de emergencia SOS al administrador?")) return;
    let lat = null,
      lon = null;
    try {
      const pos = await getCurrentLiveLocation();
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {}
    await supabaseApi.sosAlerts.create({
          driver_id: driver?.id,
          driver_name: driver?.full_name,
          message: "El conductor ha enviado una alerta de emergencia SOS",
          status: "active",
          latitude: lat,
          longitude: lon,
        });
    alert("✅ Alerta SOS enviada. El administrador fue notificado.");
  };

  useEffect(() => {
    if (!driver?.id) return;
    if (incomingRide) return;

    const assignedPendingAcceptance = [...rides]
      .filter((r) =>
        r.driver_id === driver.id &&
        r.status === "assigned" &&
        !(r.driver_accepted_at || r.en_route_at || r.arrived_at || r.in_progress_at) &&
        !acceptedRideIdsRef.current.has(r.id) &&
        rejectedRideSignalsRef.current[r.id] !== getAssignmentSignal(r)
      )
      .sort((a, b) => {
        const aTs = new Date(a.updated_at || a.requested_at || 0).getTime();
        const bTs = new Date(b.updated_at || b.requested_at || 0).getTime();
        return bTs - aTs;
      })[0];

    if (assignedPendingAcceptance) {
      setIncomingRide(assignedPendingAcceptance);
    }
  }, [rides, driver?.id, incomingRide]);

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (locationPermission === "denied") return <LocationPermissionScreen onGranted={() => {}} onDenied={() => {}} />;
  if (sessionLoading)
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  if (sessionKickedOut)
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center px-6 text-center"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="w-20 h-20 bg-red-500/20 border-2 border-red-400/40 rounded-3xl flex items-center justify-center mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-white font-black text-2xl mb-2">Sesión cerrada</h2>
        <p className="text-white/50 text-sm mb-8 leading-relaxed max-w-xs">
          Tu sesión fue cerrada porque ingresaste desde otro dispositivo. Solo se permite una sesión activa a la vez.
        </p>
        <button
          onClick={() => setSessionKickedOut(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl text-base min-h-[52px]"
        >
          Iniciar sesión nuevamente
        </button>
      </div>
    );
  if (!driver) return <DriverLoginScreen onLogin={setDriver} prefilledEmail={prefilledEmail} appLogo={appLogo} appName={appName} />;
  if (showPermissionsOnboarding)
    return (
      <PermissionsOnboarding
        role="driver"
        userId={driver?.id}
        onDone={() => {
          localStorage.setItem("driver_perms_done", "1");
          setShowPermissionsOnboarding(false);
        }}
      />
    );

  const handleStatusLogout = () => {
    if (!window.confirm("¿Deseas cerrar sesión?")) return;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setDriver(null);
  };

  if (driver.approval_status === "pending")
    return <ApprovalPendingScreen onLogout={handleStatusLogout} />;
  if (driver.approval_status === "rejected")
    return <ApprovalRejectedScreen driver={driver} onLogout={handleStatusLogout} />;
  if (driver.status === "blocked")
    return <BlockedScreen driver={driver} onLogout={handleStatusLogout} />;
  if (driver.status === "suspended" && !suspendedUntil)
    return (
      <AdminSuspendedScreen
        driver={driver}
        whatsapp={settings?.support_whatsapp_number}
        onLogout={handleStatusLogout}
      />
    );
  if (suspendedUntil && suspendedUntil > Date.now())
    return (
      <SuspendedScreen
        suspendedUntil={suspendedUntil}
        whatsapp={settings?.support_whatsapp_number}
        reason={`Cancelaste un servicio. Debes esperar ${Number(settings?.driver_cancel_suspension_minutes ?? 30)} minutos antes de volver a conectarte.`}
        onReady={async () => {
          localStorage.removeItem("driver_suspended_until");
          setSuspendedUntil(null);
          await supabaseApi.drivers.update(driver.id, { status: "available", suspended_until: null });
          setDriver((prev) =>
            prev ? { ...prev, status: "available", suspended_until: null } : prev
          );
        }}
      />
    );

  const isSuspended = driver.status === "suspended" || driver.status === "blocked";
  const completedRides = rides.filter((r) => ["completed", "cancelled"].includes(r.status));

  return (
    <div
      className="min-h-screen bg-slate-900 select-none"
      style={{ overscrollBehavior: "none", touchAction: "pan-y" }}
    >
      <AnnouncementModal audience="drivers" cityId={driver?.city_id} serviceTypeId="ride" storageKey="driver_shown_announcements" />
      <IncomingRideAlert
        ride={incomingRide}
        driver={driver}
        settings={settings}
        onAccept={handleAcceptRide}
        onReject={handleRejectRide}
        timeoutSeconds={Math.max(5, Number(settings?.driver_offer_timeout_seconds ?? settings?.auction_timeout_seconds ?? 30))}
        rejectCountToday={Number(driver?.rejection_count || 0)}
      />

      {/* Header compacto flotante */}
      <div className="fixed top-0 left-0 right-0 z-20 select-none" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="bg-black/80 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between border-b border-white/10">
          <button
            className="flex items-center gap-2.5 active:opacity-70 transition-opacity"
            onClick={() => setShowMenu(true)}
          >
            {appLogo && <img src={appLogo} alt="Logo" className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />}
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center text-sm font-black text-white flex-shrink-0">
              {driver.photo_url ? (
                <img src={driver.photo_url} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                driver.full_name?.charAt(0)
              )}
            </div>
            <div className="text-left">
              <p className="font-bold text-white text-sm leading-tight">{driver.full_name?.split(" ")[0]}</p>
              <div className="flex items-center gap-1.5">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                <span className="text-[10px] text-slate-300">
                  {driver.rating || 5} · {driver.total_rides || 0} viajes
                </span>
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <DriverNotificationsPanel driver={driver} />
            {/* Status pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                hasActiveRide
                  ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                  : driver.status === "available"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                    : "bg-slate-700 text-slate-400 border border-slate-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasActiveRide
                    ? "bg-blue-400 animate-pulse"
                    : driver.status === "available"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-slate-500"
                }`}
              />
              {hasActiveRide ? "En servicio" : driver.status === "available" ? "En línea" : "Offline"}
            </div>
          </div>
        </div>

        {/* Alertas compactas debajo del header */}
        {isSuspended && (
          <div className="mx-4 mt-1 bg-red-500/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-white flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Cuenta {driver.status === "blocked" ? "bloqueada" : "suspendida"}. Contacta al administrador.
          </div>
        )}
        {outsideGeofence && driver.status === "available" && (
          <div className="mx-4 mt-1 bg-amber-500/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-white flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Fuera del área de servicio. No recibirás viajes.
          </div>
        )}
        {inactivityWarning && driver.status === "available" && (
          <InactivityWarningBanner
            timeoutMinutes={settings?.driver_inactivity_timeout_minutes ?? 30}
            warnMinutes={settings?.driver_inactivity_warn_minutes ?? Math.max(1, (settings?.driver_inactivity_timeout_minutes ?? 30) - 3)}
            onStillHere={() => {
              _lastActivity.t = Date.now();
              setInactivityWarning(false);
            }}
          />
        )}
        <div className="mx-4">
          <InstallAppBanner settings={settings} />
          <PushPermissionBanner driverId={driver?.id} />
          <DocumentExpiryBanner driver={driver} />
        </div>
        {settings?.driver_app_instructions && (
          <div className="mx-3 mt-1 bg-blue-500/80 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-white">
            {settings.driver_app_instructions}
          </div>
        )}
      </div>

      {/* Pantalla principal */}
      <div className="fixed inset-0">
        {activeRides.length > 0 ? (
          <div className="fixed inset-0" style={{ zIndex: 5 }}>
            <AnimatePresence>
              {activeRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onUpdateStatus={handleUpdateStatus}
                  onRejectRide={handleRejectRide}
                  settings={settings}
                  driver={driver}
                  hideMap={!!incomingRide}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="fixed inset-0 overflow-hidden" style={{ paddingTop: "calc(env(safe-area-inset-top) + 64px)" }}>
            <HomeMap
              driver={driver}
              allRides={rides}
              settings={settings}
              onToggleOnline={toggleOnline}
              onRefreshLocation={refreshDriverLocation}
              isSuspended={isSuspended}
              hasActiveRide={hasActiveRide}
              todayEarnings={(() => {
                const today = new Date().toDateString();
                const commissionRate = driver?.commission_rate ?? settings?.platform_commission_pct ?? 20;
                return rides
                  .filter(
                    (r) =>
                      r.status === "completed" &&
                      new Date(r.completed_at || r.requested_at || "").toDateString() ===
                        today
                  )
                  .reduce((sum, r) => {
                    const price = r.final_price || r.estimated_price || 0;
                    const earning =
                      r.driver_earnings != null
                        ? r.driver_earnings
                        : parseFloat((price * (1 - commissionRate / 100)).toFixed(2));
                    return sum + earning;
                  }, 0);
              })()}
            />
            {driver.license_plate && (
              <div className="absolute left-0 right-0 z-10 flex justify-center" style={{ top: 8 }}>
                <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2 text-xs text-slate-300 mt-2">
                  <Car className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {driver.vehicle_brand} {driver.vehicle_model} ·{" "}
                    <span className="text-white font-bold">{driver.license_plate}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Menú desplegable */}
      <AnimatePresence>
        {showMenu && (
          <DriverMenu
            driver={driver}
            hasActiveRide={hasActiveRide}
            onClose={() => setShowMenu(false)}
            onOpenEarnings={() => setActiveTab("earnings")}
            onOpenProfile={() => setActiveTab("profile")}
            onOpenTickets={() => setShowTickets(true)}
            onLogout={handleLogout}
            onSOS={sendSOS}
          />
        )}
      </AnimatePresence>

      {/* Vistas de ganancias y perfil */}
      <AnimatePresence>
        {activeTab === "earnings" && (
          <motion.div
            key="earnings"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-0 bg-slate-900 z-[60] flex flex-col"
          >
            <div
              className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-900 flex-shrink-0"
              style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top) + 12px))" }}
            >
              <button
                onClick={() => setActiveTab("rides")}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-white font-bold">Ganancias</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PullToRefresh
                onRefresh={() =>
                  queryClient.invalidateQueries({ queryKey: ["driverRides", driver?.id] })
                }
              >
                <DriverEarningsTab driver={driver} rides={rides} onShowHistory={() => setShowHistory(true)} />
              </PullToRefresh>
            </div>
          </motion.div>
        )}
        {activeTab === "profile" && (
          <motion.div
            key="profile"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-0 bg-slate-900 z-[60] flex flex-col"
          >
            <div
              className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-900 flex-shrink-0"
              style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top) + 12px))" }}
            >
              <button
                onClick={() => setActiveTab("rides")}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-white font-bold">Mi perfil</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DriverProfileTab
                driver={driver}
                onPhotoUpdate={(url) => setDriver((prev) => (prev ? { ...prev, photo_url: url } : prev))}
                onLogout={handleLogout}
                onDeleteAccount={() => setDriver(null)}
                onDriverUpdate={(updated) => setDriver(updated)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <RideHistoryModal rides={completedRides} driver={driver} settings={settings} onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showHelp && (
          <DriverHelpTicket
            driver={driver}
            rideContext={helpRideContext}
            onClose={() => {
              setShowHelp(false);
              setHelpRideContext(null);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTickets && (
          <DriverHelpTicket driver={driver} rideContext={null} onClose={() => setShowTickets(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showVehicleSelector && (
          <VehicleSelectorModal
            vehicles={driver.vehicles || []}
            vehicleDocs={settings?.driver_vehicle_docs || []}
            onSelect={handleSelectVehicleWithCheck}
            onClose={() => setShowVehicleSelector(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingSurvey && (
          <DriverSurveyModal
            survey={pendingSurvey.survey}
            ride={pendingSurvey.ride}
            driver={driver}
            onComplete={async () => {
              const { ride } = pendingSurvey;
              setPendingSurvey(null);
              // Route through handleUpdateStatus so final pricing is computed
              // and setRideSummary is called (showing payment confirmation to driver).
              await handleUpdateStatus(ride, "completed");
            }}
            onClose={() => setPendingSurvey(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rideSummary && (
          <RideSummaryScreen
            ride={rideSummary.ride}
            driver={driver}
            paymentMethodConfig={rideSummary.paymentMethodConfig}
            onDone={() => {
              const finishedRideId = rideSummary.ride?.id;
              const needsRelease = rideSummary.needsRelease;
              setRideSummary(null);
              if (finishedRideId) {
                queryClient.setQueryData(["driverRides", driver?.id], (old: any[] = []) =>
                  old.filter((r) => r.id !== finishedRideId)
                );
              }
              if (needsRelease) {
                void releaseDriverToAvailable();
              }
              queryClient.invalidateQueries({ queryKey: ["driverRides", driver?.id] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Status Screens ───────────────────────────────────────────────────────────
function ApprovalPendingScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div
      className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none"
      style={{
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <div className="w-24 h-24 bg-amber-500/20 border-2 border-amber-400/40 rounded-3xl flex items-center justify-center mx-auto">
          <Clock className="w-12 h-12 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Solicitud en revisión</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Tu cuenta está siendo revisada por el equipo de administración. Te notificaremos cuando sea
            aprobada.
          </p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left space-y-1.5">
          <p className="text-amber-300 text-xs">📋 Tu solicitud fue recibida correctamente.</p>
          <p className="text-amber-300/70 text-xs">El proceso de revisión puede tomar 24-48 horas hábiles.</p>
        </div>
        <button
          onClick={onLogout}
          className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-2xl min-h-[48px] flex items-center justify-center gap-2 transition-all"
        >
          Cerrar sesión
        </button>
      </motion.div>
    </div>
  );
}

function ApprovalRejectedScreen({ driver, onLogout }: { driver: Driver; onLogout: () => void }) {
  return (
    <div
      className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none"
      style={{
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <div className="w-24 h-24 bg-red-500/20 border-2 border-red-400/40 rounded-3xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-12 h-12 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Solicitud rechazada</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            {driver.rejection_reason
              ? `Motivo: ${driver.rejection_reason}`
              : "Tu solicitud de registro fue rechazada. Por favor contacta al administrador."}
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-left">
          <p className="text-red-300 text-xs">
            Si crees que esto es un error, comunícate con soporte para revisar tu caso.
          </p>
        </div>
        <button
          onClick={onLogout}
          className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-2xl min-h-[48px] flex items-center justify-center gap-2 transition-all"
        >
          Cerrar sesión
        </button>
      </motion.div>
    </div>
  );
}

function BlockedScreen({ driver, onLogout }: { driver: Driver; onLogout: () => void }) {
  return (
    <div
      className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none"
      style={{
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <div className="w-24 h-24 bg-red-700/20 border-2 border-red-600/40 rounded-3xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Cuenta bloqueada</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Tu cuenta ha sido bloqueada permanentemente. Por favor contacta al administrador para resolver
            esta situación.
          </p>
        </div>
        {driver.admin_notes && (
          <div className="bg-red-700/10 border border-red-600/30 rounded-2xl p-4 text-left">
            <p className="text-red-300 text-xs">{driver.admin_notes}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-2xl min-h-[48px] flex items-center justify-center gap-2 transition-all"
        >
          Cerrar sesión
        </button>
      </motion.div>
    </div>
  );
}

// ─── Inactivity Warning Banner ────────────────────────────────────────────────
function InactivityWarningBanner({
  timeoutMinutes,
  warnMinutes,
  onStillHere,
}: {
  timeoutMinutes: number;
  warnMinutes: number;
  onStillHere: () => void;
}) {
  const [secsLeft, setSecsLeft] = React.useState(() => {
    const idleSec = (Date.now() - _lastActivity.t) / 1000;
    return Math.max(0, Math.round(timeoutMinutes * 60 - idleSec));
  });

  React.useEffect(() => {
    const iv = setInterval(() => {
      const idleSec = (Date.now() - _lastActivity.t) / 1000;
      const left = Math.max(0, Math.round(timeoutMinutes * 60 - idleSec));
      setSecsLeft(left);
    }, 1000);
    return () => clearInterval(iv);
  }, [timeoutMinutes]);

  const mm = Math.floor(secsLeft / 60);
  const ss = secsLeft % 60;
  const countdown = secsLeft > 60
    ? `${mm} min ${ss.toString().padStart(2, "0")} s`
    : `${secsLeft} seg`;

  return (
    <div className="mx-4 mt-1 bg-orange-500/90 backdrop-blur-sm rounded-xl px-3 py-2.5 text-xs text-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <p className="font-semibold">¿Sigues activo?</p>
            <p className="text-white/80 text-[11px]">
              Sin actividad en pantalla. Te desconectarás en{" "}
              <span className="font-bold text-white">{countdown}</span>.
            </p>
          </div>
        </div>
        <button
          onClick={onStillHere}
          className="shrink-0 bg-white text-orange-600 rounded-lg px-3 py-1.5 text-[11px] font-bold whitespace-nowrap active:scale-95 transition-transform"
        >
          Sigo aquí
        </button>
      </div>
    </div>
  );
}
