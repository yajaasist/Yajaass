"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Bell, CheckCircle2, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getLocationPermissionState,
  getNotificationPermissionState,
  openNativeAppSettings,
  requestLocationPermissionAccess,
  requestNotificationPermissionAccess,
} from "@/lib/nativeMobile";
import { initDriverPush, initPassengerPush } from "@/components/shared/usePushNotifications";

type Role = "driver" | "passenger";

type PermissionsOnboardingProps = {
  role: Role;
  userId?: string;
  onDone: () => void;
};

const roleLabels: Record<Role, { title: string; service: string }> = {
  driver: { title: "Conductor", service: "servicios" },
  passenger: { title: "Pasajero", service: "asistencia" },
};

export default function PermissionsOnboarding({ role, userId, onDone }: PermissionsOnboardingProps) {
  const [step, setStep] = useState<"location" | "notifications" | "done">("location");
  const [requesting, setRequesting] = useState(false);
  const [locationStatus, setLocationStatus] = useState("checking");
  const [notifStatus, setNotifStatus] = useState("checking");

  useEffect(() => {
    const loadStates = async () => {
      setLocationStatus(await getLocationPermissionState());
      setNotifStatus(await getNotificationPermissionState());
    };
    loadStates();
  }, []);

  useEffect(() => {
    const locOk = locationStatus === "granted";
    const notifOk = notifStatus === "granted" || notifStatus === "unsupported";

    if (locOk && notifOk) {
      onDone();
      return;
    }

    if (step === "location" && locOk) setStep("notifications");
    if (step === "notifications" && notifOk) setStep("done");
  }, [locationStatus, notifStatus, step, onDone]);

  const requestLocation = async () => {
    setRequesting(true);
    const state = await requestLocationPermissionAccess();
    setLocationStatus(state);
    setRequesting(false);
  };

  const requestNotifications = async () => {
    setRequesting(true);
    let state = await requestNotificationPermissionAccess();
    if (state === "granted") {
      try {
        if (role === "driver") {
          await initDriverPush(userId);
        } else {
          await initPassengerPush(userId);
        }
      } catch {
        // ignore, state already reflects permission grant
      }
      state = await getNotificationPermissionState();
    }
    setNotifStatus(state);
    setRequesting(false);
  };

  const locationGranted = locationStatus === "granted";
  const locationDenied = locationStatus === "denied";
  const notifGranted = notifStatus === "granted";
  const notifDenied = notifStatus === "denied";
  const stepTitle = step === "location" ? "Ubicación" : step === "notifications" ? "Notificaciones" : "Listo";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 select-none" style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white">
          <p className="text-sm uppercase text-slate-400 tracking-[0.22em]">Configuración de permisos</p>
          <h1 className="text-3xl font-bold mt-3">Activa los permisos necesarios</h1>
          <p className="text-slate-400 mt-2">Para que la PWA funcione como una app nativa, activa ubicación y notificaciones.</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {[
            { id: "location", label: "Ubicación" },
            { id: "notifications", label: "Notificaciones" },
          ].map((item) => (
            <div key={item.id} className={`h-2 rounded-full transition-all duration-300 ${item.id === step ? "w-20 bg-blue-400" : "w-12 bg-white/10"}`} />
          ))}
        </div>

        {step === "location" && (
          <motion.div key="location" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className={`w-24 h-24 border-2 rounded-3xl mx-auto flex items-center justify-center ${locationGranted ? "bg-emerald-500/15 border-emerald-400/40" : locationDenied ? "bg-red-500/15 border-red-400/40" : "bg-blue-500/15 border-blue-400/40"}`}>
              <MapPin className={`w-12 h-12 ${locationGranted ? "text-emerald-400" : locationDenied ? "text-red-400" : "text-blue-400"}`} />
              {locationGranted && (<div className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-white" /></div>)}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Permiso de ubicación</h2>
              <p className="text-slate-400">Permitirá que la app localice tu posición y funcione en segundo plano con ubicaciones reales.</p>
            </div>
            {locationGranted && <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-100">¡Ubicación activada!</div>}
            {locationDenied && (<div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-100"><p className="font-semibold">Ubicación bloqueada</p><p className="text-xs text-slate-300 mt-2">Abre configuración del navegador o del sistema para activar la ubicación.</p></div>)}
            {!locationGranted && (
              <Button onClick={requestLocation} disabled={requesting} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 py-3 font-semibold">
                {requesting ? "Solicitando ubicación..." : "Permitir ubicación"}
              </Button>
            )}
            {locationDenied && (
              <Button onClick={async () => { await openNativeAppSettings(); setTimeout(requestLocation, 2000); }} disabled={requesting} className="w-full rounded-2xl bg-slate-700 hover:bg-slate-600 py-3 font-semibold">
                Abrir ajustes de permisos
              </Button>
            )}
          </motion.div>
        )}

        {step === "notifications" && (
          <motion.div key="notifications" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className={`w-24 h-24 border-2 rounded-3xl mx-auto flex items-center justify-center ${notifGranted ? "bg-emerald-500/15 border-emerald-400/40" : notifDenied ? "bg-red-500/15 border-red-400/40" : "bg-amber-500/15 border-amber-400/40"}`}>
              <Bell className={`w-12 h-12 ${notifGranted ? "text-emerald-400" : notifDenied ? "text-red-400" : "text-amber-400"}`} />
              {notifGranted && (<div className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-white" /></div>)}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Notificaciones</h2>
              <p className="text-slate-400">Activa alertas para recibir actualizaciones incluso cuando la app está en segundo plano.</p>
            </div>
            {notifGranted && <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-100">¡Notificaciones activadas!</div>}
            {!notifGranted && (
              <Button onClick={requestNotifications} disabled={requesting} className="w-full rounded-2xl bg-amber-500 hover:bg-amber-600 py-3 font-semibold text-slate-900">
                {requesting ? "Solicitando notificaciones..." : "Permitir notificaciones"}
              </Button>
            )}
            {notifDenied && (<div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-100">Permisos de notificación bloqueados. Actívalos manualmente si quieres recibir alertas en segundo plano.</div>)}
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-center">
            <div className="w-24 h-24 rounded-3xl mx-auto bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">¡Listo!</h2>
            <p className="text-slate-400">Tu PWA ya está configurada para funcionar como una app nativa.</p>
            <Button onClick={onDone} className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 font-semibold">
              Continuar
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
