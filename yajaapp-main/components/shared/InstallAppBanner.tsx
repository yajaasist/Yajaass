"use client"

import React, { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery } from "@tanstack/react-query";

/**
 * Banner de instalación PWA.
 * Se muestra solo si:
 *  1. El ajuste `features_enabled.show_app_install_section` no está en false
 *  2. El navegador dispara el evento `beforeinstallprompt` (Chrome/Android)
 *  3. El usuario no lo ha descartado antes
 *
 * @param {object} settings - AppSettings ya cargados (opcional). Si se pasa,
 *   se usa directamente en lugar de hacer una llamada extra a la API.
 */
export default function InstallAppBanner({ settings: settingsProp }) {
  // If no settings prop passed, fetch them ourselves (e.g. from Landing page)
  const { data: fetchedSettingsList } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    enabled: settingsProp === undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const resolvedSettings = settingsProp !== undefined ? settingsProp : (fetchedSettingsList?.[0]);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("install_banner_dismissed") === "1"
  );
  const [showInstall, setShowInstall] = useState(null);

  useEffect(() => {
    if (resolvedSettings === undefined) return;
    const features = resolvedSettings?.features_enabled || {};
    // Must be explicitly true to show
    setShowInstall(features.show_app_install_section === true);
  }, [resolvedSettings]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("install_banner_dismissed", "1");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    handleDismiss();
  };

  // showInstall is null while loading — don't flash banner
  if (!showInstall || dismissed) return null;
  // Also require the browser install prompt to be available
  if (!deferredPrompt) return null;

  return (
    <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
      <Download className="w-4 h-4 text-white flex-shrink-0" />
      <p className="text-xs text-white flex-1 font-medium">
        Instala la app para acceder más rápido sin abrir el navegador
      </p>
      <button
        onClick={handleInstall}
        className="text-xs font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-lg px-3 py-1.5 flex-shrink-0 select-none transition-colors"
      >
        Instalar
      </button>
      <button onClick={handleDismiss} className="p-1 text-white/70 hover:text-white flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
