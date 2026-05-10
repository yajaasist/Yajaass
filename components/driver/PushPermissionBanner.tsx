import React, { useState, useEffect } from "react";
import { Bell, BellOff, X, Loader2 } from "lucide-react";
import { initDriverPush } from "@/components/shared/usePushNotifications";

/**
 * Banner que solicita al conductor activar notificaciones push.
 * Usa la Permissions API (igual que useLocationPermission) para detectar
 * el estado de forma reactiva, incluso en apps nativas instaladas.
 */
export default function PushPermissionBanner({ driverId }) {
  const [permission, setPermission] = useState("checking");
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("push_banner_dismissed") === "1"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    // Use Permissions API for reactive detection (same as geolocation)
    if (navigator.permissions) {
      navigator.permissions.query({ name: "notifications" }).then(result => {
        // PermissionState: "granted" | "denied" | "prompt"
        // Map "prompt" -> "default" to match Notification.permission style
        const mapState = (s) => s === "prompt" ? "default" : s;
        setPermission(mapState(result.state));
        result.onchange = () => setPermission(mapState(result.state));
      }).catch(() => {
        // Fallback for browsers that don't support querying notifications
        setPermission(Notification.permission);
      });
    } else {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await initDriverPush(driverId);
      setPermission(result);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("push_banner_dismissed", "1");
  };

  if (permission === "checking" || permission === "granted" || permission === "unsupported" || dismissed) return null;

  if (permission === "denied") {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center gap-3">
        <BellOff className="w-4 h-4 text-red-500 flex-shrink-0" />
        <p className="text-xs text-red-700 flex-1">
          Las notificaciones están bloqueadas. Actívalas en la configuración de tu navegador.
        </p>
        <button onClick={handleDismiss} className="p-1 text-red-400 hover:text-red-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center gap-3">
      <Bell className="w-4 h-4 text-blue-600 flex-shrink-0 animate-bounce" />
      <p className="text-xs text-blue-700 flex-1">
        Activa las notificaciones para recibir alertas de nuevos servicios aunque la app esté minimizada.
      </p>
      <button
        onClick={handleEnable}
        disabled={loading}
        className="text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-lg px-3 py-1.5 flex-shrink-0 select-none disabled:opacity-60 flex items-center gap-1"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {loading ? "Activando..." : "Activar"}
      </button>
      <button onClick={handleDismiss} className="p-1 text-blue-400 hover:text-blue-600 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
