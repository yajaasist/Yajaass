/**
 * NavigationButton.tsx
 * 
 * Botón mejorado que permite al conductor seleccionar qué app de navegación usar
 * (Google Maps, Waze, Apple Maps, etc)
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  openGoogleMaps,
  openWaze,
  openAppleMaps,
  openBestNavigationApp,
  type NavigationTarget,
} from "@/lib/navigationHelper";

interface NavigationButtonProps {
  pickup?: NavigationTarget;
  dropoff?: NavigationTarget;
  settings?: any;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  label?: string; // Custom label, e.g. "Navegar a recogida"
  showBothLocations?: boolean; // If true, shows both pickup and dropoff in the app list
}

export default function NavigationButton({
  pickup,
  dropoff,
  settings,
  size = "md",
  variant = "default",
  className,
  label,
  showBothLocations = false,
}: NavigationButtonProps) {
  const [open, setOpen] = useState(false);

  // We'll navigate to pickup or dropoff - prefer dropoff if both exist
  const target = dropoff || pickup;
  if (!target) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator?.userAgent || "");
  const features = settings?.features_enabled || {};
  const configuredApps = Array.isArray(features?.driver_navigation_enabled_apps)
    ? features.driver_navigation_enabled_apps
    : ["google_maps", "waze", "apple_maps"];
  const defaultNavApp = String(features?.driver_navigation_default_app || "auto");
  const useModalPicker = features?.driver_navigation_use_modal_picker !== false;
  const showBestOptionButton = features?.driver_navigation_show_best_option_button !== false;

  // Define available navigation options based on platform
  const navOptions = [
    {
      id: "maps",
      label: "Google Maps",
      icon: "🗺️",
      onClick: () => openGoogleMaps(target),
      available: configuredApps.includes("google_maps"),
    },
    {
      id: "waze",
      label: "Waze",
      icon: "🛣️",
      onClick: () => openWaze(target),
      available: configuredApps.includes("waze"),
    },
    ...(isIOS
      ? [
          {
            id: "apple-maps",
            label: "Apple Maps",
            icon: "🍎",
            onClick: () => openAppleMaps(target),
            available: configuredApps.includes("apple_maps"),
          },
        ]
      : []),
  ].filter((opt) => opt.available);

  const handleDefaultNav = () => {
    if (defaultNavApp === "google_maps") {
      openGoogleMaps(target);
    } else if (defaultNavApp === "waze") {
      openWaze(target);
    } else if (defaultNavApp === "apple_maps") {
      openAppleMaps(target);
    } else {
      openBestNavigationApp(target);
    }
    setOpen(false);
  };

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-3 text-base",
  };

  const variantClasses =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      : variant === "ghost"
      ? "bg-transparent text-slate-600 hover:bg-slate-100"
      : "bg-blue-500 hover:bg-blue-600 text-white";

  return (
    <>
      <Button
        onClick={() => {
          if (!useModalPicker) {
            handleDefaultNav();
            return;
          }
          setOpen(true);
        }}
        className={`rounded-xl font-semibold flex items-center gap-2 transition-colors ${sizeClasses[size]} ${variantClasses} ${className}`}
      >
        <Navigation className="w-4 h-4" />
        {label || "Navegar"}
      </Button>

      {/* Navigation apps modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-4 flex items-center justify-between border-b border-slate-200 bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-800">Selecciona GPS</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {dropoff
                      ? `Ir a ${dropoff.label || "destino"}`
                      : `Ir a ${pickup?.label || "recogida"}`}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Target info */}
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-blue-900">
                    {dropoff ? dropoff.label || "Destino" : pickup?.label || "Recogida"}
                  </p>
                  <p className="text-blue-700 mt-0.5">
                    {target.lat.toFixed(4)}, {target.lng.toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Navigation options */}
              <div className="space-y-2 p-4">
                {navOptions.length > 0 ? (
                  navOptions.map((option) => (
                    <motion.button
                      key={option.id}
                      onClick={() => {
                        option.onClick();
                        setOpen(false);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                    >
                      <span className="text-xl flex-shrink-0">{option.icon}</span>
                      <span className="font-semibold text-slate-700">{option.label}</span>
                    </motion.button>
                  ))
                ) : (
                  <p className="text-center text-slate-500 py-4 text-xs">
                    No hay apps de navegación disponibles
                  </p>
                )}
              </div>

              {/* Auto-open best app button */}
              {showBestOptionButton && <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
                <Button
                  onClick={handleDefaultNav}
                  className="w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                >
                  Abrir mejor opción
                </Button>
              </div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
