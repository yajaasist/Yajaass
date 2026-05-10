import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, User, LogOut, Trash2, ChevronRight, Star, X, MessageSquare, Clock, Battery, MapPin, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseApi } from "@/lib/supabaseApi";
import DriverVehiclesPanel from "@/components/driver/DriverVehiclesPanel";
import { useQuery } from "@tanstack/react-query";
import { getLocationPermissionState, requestLocationPermission, getNotificationPermissionState, requestNotificationPermission, openAppSettings } from "@/lib/permissionsService";
import type { AppPermissionState } from "@/lib/permissionsService";

function formatMinutes(mins) {
  const m = Math.floor(mins);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}min` : `${m}min`;
}

function RatingsHistoryPanel({ rides = [], role, onClose, darkMode = false }) {
  const isDriver = role === "driver";
  const rated = rides.filter(r => isDriver ? r.passenger_rating_for_driver > 0 : r.driver_rating_for_passenger > 0)
    .sort((a, b) => new Date(b.completed_at || b.updated_date).getTime() - new Date(a.completed_at || a.updated_date).getTime());
  const avg = rated.length > 0
    ? (rated.reduce((s, r) => s + (isDriver ? r.passenger_rating_for_driver : r.driver_rating_for_passenger), 0) / rated.length).toFixed(1)
    : null;
  const bg = darkMode ? "bg-slate-900" : "bg-white";
  const card = darkMode ? "bg-white/5 border border-white/10" : "bg-slate-50 border border-slate-100";
  const text = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-white/50" : "text-slate-400";
  const textSub = darkMode ? "text-white/70" : "text-slate-600";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/60 flex items-end" onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className={`w-full ${bg} rounded-t-3xl flex flex-col`}
        style={{ maxHeight: "85vh", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div>
            <h3 className={`font-bold text-xl ${text}`}>Mis calificaciones</h3>
            {avg && (
              <div className="flex items-center gap-1.5 mt-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-bold text-lg text-amber-500">{avg}</span>
                <span className={`text-sm ${textMuted}`}>· {rated.length} reseña{rated.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className={`w-9 h-9 rounded-full flex items-center justify-center ${darkMode ? "bg-white/10" : "bg-slate-100"}`}>
            <X className={`w-4 h-4 ${textMuted}`} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {rated.length === 0 ? (
            <div className="text-center py-16">
              <Star className={`w-12 h-12 mx-auto mb-3 ${textMuted} opacity-30`} />
              <p className={`text-sm ${textMuted}`}>Aún no tienes calificaciones</p>
            </div>
          ) : rated.map(ride => {
            const rating = isDriver ? ride.passenger_rating_for_driver : ride.driver_rating_for_passenger;
            const comment = isDriver ? ride.passenger_rating_comment : ride.driver_rating_comment;
            const raterName = isDriver ? ride.passenger_name : ride.driver_name;
            const date = new Date(ride.completed_at || ride.updated_date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
            return (
              <div key={ride.id} className={`${card} rounded-2xl p-4 space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${darkMode ? "bg-blue-500/20" : "bg-blue-50"}`}>
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${text}`}>{raterName || "—"}</p>
                      <p className={`text-xs ${textMuted}`}>{date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= rating ? "fill-amber-400 text-amber-400" : darkMode ? "text-white/20" : "text-slate-200"}`} />)}
                  </div>
                </div>
                {comment && (
                  <div className={`flex items-start gap-2 pt-2 border-t ${darkMode ? "border-white/10" : "border-slate-100"}`}>
                    <MessageSquare className={`w-3.5 h-3.5 ${textMuted} flex-shrink-0 mt-0.5`} />
                    <p className={`text-xs ${textSub} leading-relaxed`}>{comment}</p>
                  </div>
                )}
                <p className={`text-xs ${textMuted} truncate`}>{ride.pickup_address}{ride.dropoff_address ? ` → ${ride.dropoff_address}` : ""}</p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

const SESSION_KEY = "driver_session_id";

export default function DriverProfileTab({ driver, onPhotoUpdate, onLogout, onDeleteAccount, onDriverUpdate }) {
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("info");
  const [showRatings, setShowRatings] = useState(false);
  const [onlineElapsed, setOnlineElapsed] = useState(0);
  const [locationPermission, setLocationPermission] = useState<AppPermissionState>("checking");
  const [notificationPermission, setNotificationPermission] = useState<AppPermissionState>("checking");

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const settings = settingsList[0];
  const vehicleDocs = settings?.driver_vehicle_docs || [];

  useEffect(() => {
    const isOnline = driver?.status === "available" || driver?.status === "busy";
    if (!isOnline || !driver?.online_since) { setOnlineElapsed(0); return; }
    const update = () => {
      const diff = (Date.now() - new Date(driver.online_since).getTime()) / 60000;
      setOnlineElapsed(Math.max(0, diff));
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [driver?.status, driver?.online_since]);

  useEffect(() => {
    if (activeSection === "permissions") {
      getLocationPermissionState().then(setLocationPermission);
      getNotificationPermissionState().then(setNotificationPermission);
    }
  }, [activeSection]);

  const { data: driverRides = [] } = useQuery({
    queryKey: ["driverAllRides", driver?.id],
    queryFn: () => supabaseApi.rideRequests.list({ driver_id: driver?.id }),
    enabled: !!driver?.id && showRatings,
    staleTime: 60000,
  });

  const handlePhotoUpload = async (file) => {
    setUploadingPhoto(true);
    setPhotoUploadError(null);
    try {
      const { file_url } = await supabaseApi.uploads.uploadFile({ file });
      if (!file_url) throw new Error("No se obtuvo URL de la foto");
      await supabaseApi.drivers.update(driver.id, { photo_url: file_url });
      onPhotoUpdate(file_url);
    } catch (error: any) {
      setPhotoUploadError(error?.message || "No se pudo subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "ELIMINAR") return;
    setDeleting(true);
    await supabaseApi.drivers.delete(driver.id);
    localStorage.removeItem(SESSION_KEY);
    onDeleteAccount();
    setDeleting(false);
  };

  return (
    <div className="p-5 space-y-5 pb-28">
      {/* Section toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
        <button onClick={() => setActiveSection("info")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === "info" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Mi perfil
        </button>
        <button onClick={() => setActiveSection("vehicles")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === "vehicles" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Vehículos
        </button>
        <button onClick={() => setActiveSection("permissions")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === "permissions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Permisos
        </button>
        <button onClick={() => { setActiveSection("ratings"); setShowRatings(true); }}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === "ratings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Calificaciones
        </button>
      </div>

      {activeSection === "vehicles" && (
        <DriverVehiclesPanel driver={driver} onDriverUpdate={onDriverUpdate} vehicleDocs={vehicleDocs} />
      )}

      {activeSection === "permissions" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Permisos de la aplicación</h3>
          <p className="text-sm text-slate-500">Gestiona los permisos necesarios para el funcionamiento de la app.</p>

          {/* Permiso de Ubicación */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${locationPermission === "granted" ? "bg-green-100" : locationPermission === "denied" ? "bg-red-100" : "bg-amber-100"}`}>
                <MapPin className={`w-5 h-5 ${locationPermission === "granted" ? "text-green-600" : locationPermission === "denied" ? "text-red-600" : "text-amber-600"}`} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">Ubicación</h4>
                <p className="text-xs text-slate-500">Necesario para mostrar tu posición en el mapa y conectar con pasajeros.</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-medium ${locationPermission === "granted" ? "text-green-600" : locationPermission === "denied" ? "text-red-600" : "text-amber-600"}`}>
                  {locationPermission === "granted" ? "Concedido" : locationPermission === "denied" ? "Denegado" : locationPermission === "prompt" ? "Preguntar" : "Verificando..."}
                </span>
              </div>
            </div>
            {locationPermission === "denied" && (
              <Button onClick={() => openAppSettings()} className="w-full bg-slate-600 hover:bg-slate-700 rounded-xl min-h-[44px]">
                <Settings className="w-4 h-4 mr-2" />
                Abrir configuración
              </Button>
            )}
            {locationPermission === "prompt" && (
              <Button onClick={async () => {
                const granted = await requestLocationPermission();
                setLocationPermission(granted ? "granted" : "denied");
              }} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px]">
                Solicitar permiso
              </Button>
            )}
          </div>

          {/* Permiso de Notificaciones */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${notificationPermission === "granted" ? "bg-green-100" : notificationPermission === "denied" ? "bg-red-100" : notificationPermission === "unsupported" ? "bg-gray-100" : "bg-amber-100"}`}>
                <Bell className={`w-5 h-5 ${notificationPermission === "granted" ? "text-green-600" : notificationPermission === "denied" ? "text-red-600" : notificationPermission === "unsupported" ? "text-gray-600" : "text-amber-600"}`} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">Notificaciones</h4>
                <p className="text-xs text-slate-500">Recibe alertas de nuevos viajes y actualizaciones importantes.</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-medium ${notificationPermission === "granted" ? "text-green-600" : notificationPermission === "denied" ? "text-red-600" : notificationPermission === "unsupported" ? "text-gray-600" : "text-amber-600"}`}>
                  {notificationPermission === "granted" ? "Concedido" : notificationPermission === "denied" ? "Denegado" : notificationPermission === "unsupported" ? "No soportado" : notificationPermission === "prompt" ? "Preguntar" : "Verificando..."}
                </span>
              </div>
            </div>
            {notificationPermission === "denied" && (
              <Button onClick={() => openAppSettings()} className="w-full bg-slate-600 hover:bg-slate-700 rounded-xl min-h-[44px]">
                <Settings className="w-4 h-4 mr-2" />
                Abrir configuración
              </Button>
            )}
            {notificationPermission === "prompt" && (
              <Button onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotificationPermission(granted ? "granted" : "denied");
              }} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px]">
                Solicitar permiso
              </Button>
            )}
          </div>
        </div>
      )}

      {activeSection === "ratings" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-slate-900">Tu calificación</span>
              <span className="font-black text-lg text-amber-500">{driver.rating || 5}</span>
            </div>
          </div>
          <button
            onClick={() => setShowRatings(true)}
            className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-3 min-h-[52px] transition-colors border border-slate-100"
          >
            <span className="text-sm font-medium text-slate-700">Ver historial de calificaciones</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {activeSection === "info" && (<>
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg">
              {driver.photo_url ? (
                <img src={driver.photo_url} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-slate-300" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer shadow-md select-none">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(f);
                  e.currentTarget.value = "";
                }}
              />
              <Camera className="w-4 h-4 text-white" />
            </label>
          </div>
          {uploadingPhoto && <p className="text-xs text-blue-500 mt-2">Subiendo foto...</p>}
          {photoUploadError && <p className="text-xs text-red-500 mt-2">{photoUploadError}</p>}
          <h2 className="text-lg font-bold text-slate-900 mt-3">{driver.full_name}</h2>
          <p className="text-sm text-slate-400">{driver.email}</p>
        </div>

        {/* Tiempo en línea y jornada */}
        {(driver?.status === "available" || driver?.status === "busy") && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Jornada actual</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-700">Tiempo en línea ahora</span>
              <span className="font-bold text-emerald-700">{formatMinutes(onlineElapsed)}</span>
            </div>
            {(driver?.accumulated_work_minutes || 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-700">Acumulado del día</span>
                <span className="font-bold text-emerald-700">{formatMinutes((driver.accumulated_work_minutes || 0) + onlineElapsed)}</span>
              </div>
            )}
            {settings?.work_max_hours && (() => {
              const maxMins = (settings.work_max_hours || 12) * 60;
              const totalMins = (driver.accumulated_work_minutes || 0) + onlineElapsed;
              const pct = Math.min(100, (totalMins / maxMins) * 100);
              const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";
              return (
                <div>
                  <div className="flex justify-between text-[10px] text-emerald-600 mb-1">
                    <span>Límite diario: {formatMinutes(maxMins)}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {driver?.rest_required_until && new Date(driver.rest_required_until) > new Date() && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Battery className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Descanso requerido</span>
            </div>
            <p className="text-xs text-amber-700">
              Debes descansar hasta las{" "}
              <strong>{new Date(driver.rest_required_until).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</strong>
            </p>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between min-h-[36px] items-center"><span className="text-sm text-slate-500">Teléfono</span><span className="text-sm font-medium">{driver.phone || "—"}</span></div>
          <div className="flex justify-between min-h-[36px] items-center"><span className="text-sm text-slate-500">Ciudad</span><span className="text-sm font-medium">{driver.city_name || "—"}</span></div>
          <div className="flex justify-between min-h-[36px] items-center"><span className="text-sm text-slate-500">Servicios</span><span className="text-sm font-medium">{(driver.service_type_names || []).join(", ") || "—"}</span></div>
          {driver.license_plate && (
            <div className="flex justify-between min-h-[36px] items-center border-t border-slate-200 pt-3">
              <span className="text-sm text-slate-500">Vehículo activo</span>
              <span className="text-sm font-medium">{driver.vehicle_brand} {driver.vehicle_model} · <span className="font-mono">{driver.license_plate}</span></span>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 text-center -mt-2">Para agregar o cambiar vehículos ve a la pestaña <strong>Mis vehículos</strong></p>

        <div className="space-y-2">
          <button onClick={onLogout} className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-3 min-h-[52px] select-none transition-colors">
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Cerrar sesión</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-between bg-red-50 hover:bg-red-100 rounded-xl px-4 py-3 min-h-[52px] select-none transition-colors">
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-600">Eliminar cuenta</span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400" />
          </button>
        </div>

        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setShowDeleteConfirm(false)}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="w-full bg-white rounded-t-3xl p-6 space-y-4"
                onClick={e => e.stopPropagation()}
                style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
                <div className="text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Trash2 className="w-7 h-7 text-red-500" />
                  </div>
                  <h3 className="font-bold text-xl text-slate-900">Eliminar cuenta</h3>
                  <p className="text-sm text-slate-500 mt-2">Esta acción es irreversible.</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Escribe <strong>ELIMINAR</strong> para confirmar:</p>
                  <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="ELIMINAR" className="w-full border border-red-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <Button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "ELIMINAR" || deleting}
                  className="w-full bg-red-600 hover:bg-red-700 rounded-xl min-h-[44px] select-none">
                  {deleting ? "Eliminando..." : "Eliminar mi cuenta definitivamente"}
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="w-full rounded-xl min-h-[44px] select-none">
                  Cancelar
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>)}

      {/* Ratings modal — rendered at root level so it works from any tab */}
      <AnimatePresence>
        {showRatings && (
          <RatingsHistoryPanel
            rides={driverRides}
            role="driver"
            onClose={() => setShowRatings(false)}
            darkMode={false}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
