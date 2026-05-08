import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Bell, CheckCircle2, AlertTriangle, Settings, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocationPermissionState, getNotificationPermissionState, openNativeAppSettings, requestLocationPermissionAccess } from "@/lib/nativeMobile";
import { initDriverPush } from "@/components/shared/usePushNotifications";

// Try to open system settings — works on iOS, shows instructions on Android
function openAppSettings() {
  // iOS PWA
  try { window.location.href = "app-settings:"; } catch {}
}

type PermissionsOnboardingProps = {
  onDone: () => void;
  driverId?: string;
};

export default function PermissionsOnboarding({ onDone, driverId }: PermissionsOnboardingProps) {
  const [step, setStep] = useState("location"); // "location" | "notifications" | "done"
  const [requesting, setRequesting] = useState(false);
  const [locationStatus, setLocationStatus] = useState("unknown");
  const [notifStatus, setNotifStatus] = useState("unknown");

  useEffect(() => {
    const loadStates = async () => {
      setLocationStatus(await getLocationPermissionState());
      setNotifStatus(await getNotificationPermissionState());
    };
    loadStates();
  }, []);

  // Auto-skip si ambos permisos ya están activos
  useEffect(() => {
    const locOk = locationStatus === "granted";
    const notifOk = notifStatus === "granted" || notifStatus === "unsupported";
    if (locOk && notifOk) {
      localStorage.setItem("driver_perms_done", "1");
      onDone();
    }
  }, [locationStatus, notifStatus]);

  const requestLocation = () => {
    setRequesting(true);
    requestLocationPermissionAccess()
      .then((state) => setLocationStatus(state))
      .finally(() => setRequesting(false));
  };

  const requestNotifications = async () => {
    setRequesting(true);
    try {
      const r = await initDriverPush(driverId);
      setNotifStatus(r);
    } catch {}
    setRequesting(false);
  };

  const locationGranted = locationStatus === "granted";
  const locationDenied = locationStatus === "denied";
  const notifGranted = notifStatus === "granted";

  // Location is REQUIRED — cannot proceed without it
  const canFinish = locationGranted;

  return (
    <div
      className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {["location", "notifications", "done"].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? "w-8 bg-blue-400" : "w-4 bg-white/20"}`} />
          ))}
        </div>

        {/* ── STEP: LOCATION ── */}
        {step === "location" && (
          <motion.div key="location" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className={`w-24 h-24 border-2 rounded-3xl flex items-center justify-center mx-auto relative ${locationGranted ? "bg-emerald-500/20 border-emerald-400/40" : locationDenied ? "bg-red-500/20 border-red-400/40" : "bg-blue-500/20 border-blue-400/40"}`}>
              <MapPin className={`w-12 h-12 ${locationGranted ? "text-emerald-400" : locationDenied ? "text-red-400" : "text-blue-400"}`} />
              {locationGranted && (
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Permiso de ubicación</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                La ubicación es <strong className="text-white">obligatoria</strong> para recibir servicios. Debes activarla para poder conectarte.
              </p>
            </div>

            {locationGranted && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-300 text-sm font-medium">¡Ubicación activada correctamente!</p>
              </div>
            )}

            {locationDenied && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-xs font-semibold">Ubicación bloqueada — debes activarla manualmente</p>
                </div>
                <div className="space-y-2 text-xs text-slate-400">
                  <p>🤖 <strong className="text-slate-300">Android Chrome:</strong> Toca el ícono 🔒 en la barra de URL → Permisos → Ubicación → Permitir</p>
                  <p>📱 <strong className="text-slate-300">iOS Safari:</strong> Configuración → Safari → Ubicación → Permitir</p>
                </div>
                <button
                  onClick={async () => { const opened = await openNativeAppSettings(); if (!opened) openAppSettings(); setTimeout(requestLocation, 3000); }}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl py-2.5 text-xs font-semibold"
                >
                  <Settings className="w-4 h-4" /> Abrir configuración del sistema
                </button>
              </div>
            )}

            {!locationGranted && !locationDenied && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-1 text-xs text-slate-400">
                <p className="text-amber-300 text-xs font-semibold mb-1">Para activar "siempre":</p>
                <p>🤖 <strong className="text-slate-300">Android:</strong> Permisos → Ubicación → Permitir siempre</p>
                <p>📱 <strong className="text-slate-300">iOS:</strong> Configuración → App → Ubicación → Siempre</p>
              </div>
            )}

            {!locationGranted && !locationDenied && (
              <Button
                onClick={requestLocation}
                disabled={requesting}
                className="w-full rounded-2xl min-h-[52px] text-base font-bold bg-blue-600 hover:bg-blue-700"
              >
                <MapPin className="w-5 h-5 mr-2" />
                {requesting ? "Solicitando..." : "Permitir ubicación"}
              </Button>
            )}

            {locationDenied && (
              <Button
                onClick={requestLocation}
                disabled={requesting}
                className="w-full rounded-2xl min-h-[52px] text-base font-bold bg-slate-700 hover:bg-slate-600"
              >
                {requesting ? "Verificando..." : "Reintentar"}
              </Button>
            )}

            {locationGranted && (
              <Button
                onClick={() => setStep("notifications")}
                className="w-full rounded-2xl min-h-[52px] text-base font-bold bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Continuar
              </Button>
            )}

            {/* Cannot skip location */}
            {locationDenied && (
              <p className="text-center text-xs text-red-400/70">
                ⚠️ Sin ubicación no puedes conectarte ni recibir servicios.
              </p>
            )}
          </motion.div>
        )}

        {/* ── STEP: NOTIFICATIONS ── */}
        {step === "notifications" && (
          <motion.div key="notifications" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className={`w-24 h-24 border-2 rounded-3xl flex items-center justify-center mx-auto relative ${notifGranted ? "bg-emerald-500/20 border-emerald-400/40" : "bg-amber-500/20 border-amber-400/40"}`}>
              <Bell className={`w-12 h-12 ${notifGranted ? "text-emerald-400" : "text-amber-400"}`} />
              {notifGranted && (
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Notificaciones</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Activa las notificaciones para recibir alertas de nuevos servicios aunque la app esté en segundo plano.
              </p>
            </div>

            {notifGranted && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-300 text-sm font-medium">¡Notificaciones activadas!</p>
              </div>
            )}

            {notifStatus === "denied" && (
              <div className="bg-slate-700/50 border border-slate-600 rounded-2xl p-3 text-xs text-slate-400">
                <p>Notificaciones bloqueadas. Puedes activarlas más tarde desde Configuración del sistema.</p>
              </div>
            )}

            {!notifGranted && notifStatus !== "denied" && (
              <Button
                onClick={requestNotifications}
                disabled={requesting}
                className="w-full rounded-2xl min-h-[52px] text-base font-bold bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Bell className="w-5 h-5 mr-2" />
                {requesting ? "Solicitando..." : "Activar notificaciones"}
              </Button>
            )}

            <Button
              onClick={() => setStep("done")}
              className={`w-full rounded-2xl min-h-[52px] text-base font-bold ${notifGranted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-600"}`}>
              {notifGranted ? <><CheckCircle2 className="w-5 h-5 mr-2" /> Continuar</> : "Omitir por ahora →"}
            </Button>
          </motion.div>
        )}

        {/* ── STEP: DONE / INSTALL PWA ── */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-center">
            <div className="w-24 h-24 bg-emerald-500/20 border-2 border-emerald-400/40 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white mb-2">¡Todo listo!</h1>
              <p className="text-slate-400 text-sm leading-relaxed">Para recibir servicios en segundo plano, instala la app en tu dispositivo.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2">
              <p className="text-emerald-300 text-xs font-semibold mb-2 flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Instalar como app</p>
              <p className="text-slate-400 text-xs">🤖 <strong className="text-slate-300">Android Chrome:</strong> Menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio"</p>
              <p className="text-slate-400 text-xs mt-1">📱 <strong className="text-slate-300">iOS Safari:</strong> Icono compartir → "Añadir a pantalla de inicio"</p>
            </div>

            <Button
              onClick={onDone}
              className="w-full rounded-2xl min-h-[52px] text-base font-bold bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" /> Comenzar a trabajar
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
