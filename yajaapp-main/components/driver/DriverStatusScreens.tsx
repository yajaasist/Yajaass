import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { MapPin, Navigation, CheckCircle2, Wifi, WifiOff, MessageCircle, ShieldOff } from "lucide-react";

export function LocationPermissionScreen({ onGranted, onDenied }) {
  const [requesting, setRequesting] = useState(false);

  const requestLocation = () => {
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      () => { setRequesting(false); onGranted(); },
      (err) => { setRequesting(false); if (err.code === 1) onDenied(); else onGranted(); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center space-y-6">
        <div className="w-24 h-24 bg-blue-500/20 border-2 border-blue-400/40 rounded-3xl flex items-center justify-center mx-auto">
          <MapPin className="w-12 h-12 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Ubicación requerida</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Para poder tomar servicios y compartir tu posición con el administrador, necesitamos acceso a tu ubicación <strong className="text-white">siempre activo</strong>, incluso cuando la app esté en segundo plano.
          </p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left space-y-2">
          <p className="text-amber-400 text-sm font-semibold">¿Por qué es necesario?</p>
          <ul className="text-amber-300/80 text-xs space-y-1">
            <li>• El admin puede ver tu posición en tiempo real</li>
            <li>• Se calcula el ETA automáticamente</li>
            <li>• El sistema te asigna al conductor más cercano</li>
            <li>• Tu ubicación se actualiza aunque tengas la app cerrada</li>
          </ul>
        </div>
        <Button onClick={requestLocation} disabled={requesting}
          className="w-full bg-blue-600 hover:bg-blue-700 rounded-2xl min-h-[52px] text-base font-bold select-none">
          <Navigation className="w-5 h-5 mr-2" />
          {requesting ? "Solicitando permiso..." : "Permitir ubicación siempre"}
        </Button>
        <p className="text-xs text-slate-500">
          En iOS: Configuración → App → Ubicación → <strong className="text-slate-400">Siempre</strong><br/>
          En Android: Configuración → Permisos → Ubicación → <strong className="text-slate-400">Permitir siempre</strong>
        </p>
      </motion.div>
    </div>
  );
}

// Screen shown when admin suspends the driver manually (status === "suspended")
export function AdminSuspendedScreen({ driver, whatsapp, onLogout }) {
  const waNumber = whatsapp?.replace(/\D/g, "");
  const waMsg = encodeURIComponent(`Hola, soy el conductor ${driver?.full_name}. Mi cuenta fue suspendida y quiero comunicarme con el administrador.`);
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${waMsg}` : null;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center space-y-6">
        <div className="w-24 h-24 bg-orange-500/20 border-2 border-orange-400/40 rounded-3xl flex items-center justify-center mx-auto">
          <ShieldOff className="w-12 h-12 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Cuenta suspendida</h1>
          <p className="text-slate-400 text-sm leading-relaxed">Tu cuenta ha sido suspendida por el administrador. No puedes recibir servicios en este momento.</p>
        </div>
        {driver?.suspension_reason && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-left">
            <p className="text-orange-300 text-xs font-semibold mb-1">📋 Motivo:</p>
            <p className="text-orange-200 text-sm leading-relaxed">{driver.suspension_reason}</p>
          </div>
        )}
        {waUrl ? (
          <a href={waUrl} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-semibold rounded-2xl py-3.5 text-sm active:bg-emerald-600/30 transition-all">
            <MessageCircle className="w-5 h-5" />
            Contactar al administrador por WhatsApp
          </a>
        ) : (
          <p className="text-xs text-slate-500">Si crees que esto es un error, comunícate con el administrador.</p>
        )}
        {onLogout && (
          <button onClick={onLogout} className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-2xl min-h-[48px] flex items-center justify-center gap-2 transition-all text-sm">
            Cerrar sesión
          </button>
        )}
      </motion.div>
    </div>
  );
}

export function SuspendedScreen({ suspendedUntil, onReady, reason, whatsapp }) {
  const [remaining, setRemaining] = useState(Math.max(0, suspendedUntil - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, suspendedUntil - Date.now());
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [suspendedUntil]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const pct = Math.max(0, Math.min(100, (remaining / (30 * 60 * 1000)) * 100));

  if (remaining === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400/40 rounded-3xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">¡Ya puedes conectarte!</h2>
          <p className="text-slate-400 text-sm">El período de desconexión ha terminado.</p>
          <Button onClick={onReady} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-2xl min-h-[52px] text-base font-bold">
            <Wifi className="w-5 h-5 mr-2" /> Conectarme ahora
          </Button>
        </motion.div>
      </div>
    );
  }

  const waNumber = whatsapp?.replace(/\D/g, "");
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent("Hola, soy conductor y fui desconectado temporalmente. Necesito ayuda.")}` : null;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 select-none"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center space-y-8">
        <div>
          <div className="w-20 h-20 bg-red-500/20 border-2 border-red-400/40 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Desconectado temporalmente</h2>
          <p className="text-slate-400 text-sm mt-2">{reason || "Cancelaste un servicio. Debes esperar antes de volver a conectarte."}</p>
        </div>
        <div className="relative w-40 h-40 mx-auto">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="#1e293b" strokeWidth="12" />
            <circle cx="80" cy="80" r="70" fill="none" stroke="#ef4444" strokeWidth="12"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - pct / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-black text-white tabular-nums">{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</p>
            <p className="text-xs text-slate-400 mt-1">restantes</p>
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 text-left space-y-1.5">
          <p className="text-xs text-slate-400">⚠️ No podrás recibir servicios durante este tiempo.</p>
          <p className="text-xs text-slate-400">🔔 Recibirás una notificación cuando termine.</p>
        </div>
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-semibold rounded-2xl py-3 text-sm">
            <MessageCircle className="w-4 h-4" /> Contactar administrador
          </a>
        )}
      </motion.div>
    </div>
  );
}
