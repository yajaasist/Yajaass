import React, { useMemo } from "react";
import { AlertTriangle, X, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";

const DEFAULT_VEHICLE_DOCS = [
  { key: "licencia", label: "Licencia de conducir", require_expiry: true },
  { key: "seguro", label: "Póliza de seguro", require_expiry: true },
  { key: "circulacion", label: "Tarjeta de circulación", require_expiry: true },
];

const DEFAULT_PERSONAL_DOCS = [];

function getDaysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function DocumentExpiryBanner({ driver }: { driver: any }) {
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const settings = settingsList[0];
  const vehicleDocsConfig = settings?.driver_vehicle_docs?.length > 0 ? settings.driver_vehicle_docs : DEFAULT_VEHICLE_DOCS;
  const personalDocsConfig = settings?.driver_required_docs || DEFAULT_PERSONAL_DOCS;

  const alerts = useMemo(() => {
    const result: any[] = [];

    // ── 1. Vehicle doc expiries ──────────────────────────────────────────────
    const vehicles = driver?.vehicles || [];
    for (const vehicle of vehicles) {
      const vtype = vehicle.vehicle_type || "car";
      const docs = vehicleDocsConfig.filter((d: any) =>
        d.require_expiry !== false &&
        (!d.applies_to || d.applies_to === "both" || d.applies_to === vtype)
      );
      for (const doc of docs) {
        const expiry = vehicle[`doc_${doc.key}_expiry`];
        if (!expiry) continue;
        const days = getDaysUntil(expiry);
        if (days === null) continue;
        if (days <= 0) {
          result.push({ type: "expired", label: doc.label, detail: `${vehicle.brand} ${vehicle.model} (${vehicle.plates})`, days, key: `vehicle-${vehicle.id}-${doc.key}`, docType: "vehicle" });
        } else if (days <= 30) {
          result.push({ type: "warning", label: doc.label, detail: `${vehicle.brand} ${vehicle.model} (${vehicle.plates})`, days, key: `vehicle-${vehicle.id}-${doc.key}`, docType: "vehicle" });
        }
      }
    }

    // ── 2. Personal doc expiries ─────────────────────────────────────────────
    const docExpiries = driver?.doc_expiries || {};
    for (const doc of personalDocsConfig) {
      if (doc.require_expiry === false) continue;
      const expiry = docExpiries[doc.key];
      if (!expiry) continue;
      const days = getDaysUntil(expiry);
      if (days === null) continue;
      if (days <= 0) {
        result.push({ type: "expired", label: doc.label, detail: "Documento personal", days, key: `personal-${doc.key}`, docType: "personal" });
      } else if (days <= 30) {
        result.push({ type: "warning", label: doc.label, detail: "Documento personal", days, key: `personal-${doc.key}`, docType: "personal" });
      }
    }

    // Sort: expired first, then by days ascending
    return result.sort((a, b) => a.days - b.days);
  }, [driver?.vehicles, driver?.doc_expiries, vehicleDocsConfig, personalDocsConfig]);

  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const visible = alerts.filter(a => !dismissed.includes(a.key));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-0">
      <AnimatePresence>
        {visible.slice(0, 3).map(alert => (
          <motion.div
            key={alert.key}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`flex items-start gap-2.5 px-4 py-2.5 border-b text-xs ${
              alert.type === "expired"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-bold">{alert.label}</span>
              {" — "}
              <span className="font-medium">{alert.detail}</span>
              {": "}
              {alert.type === "expired"
                ? <span className="font-bold">VENCIDO hace {Math.abs(alert.days)} día{Math.abs(alert.days) !== 1 ? "s" : ""}</span>
                : <span>vence en <strong>{alert.days} día{alert.days !== 1 ? "s" : ""}</strong></span>
              }
              {alert.docType === "personal" && alert.type === "expired" && (
                <span className="ml-1 font-bold text-red-800">• No podrás conectarte hasta renovarlo</span>
              )}
              {alert.docType === "vehicle" && alert.type === "expired" && (
                <span className="ml-1 font-bold text-red-800">• Vehículo inhabilitado hasta renovar</span>
              )}
            </div>
            <button
              onClick={() => setDismissed(d => [...d, alert.key])}
              className="flex-shrink-0 p-0.5 rounded opacity-60 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      {visible.length > 3 && (
        <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-600 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {visible.length - 3} documento{visible.length - 3 !== 1 ? "s" : ""} más requieren atención
        </div>
      )}
    </div>
  );
}
