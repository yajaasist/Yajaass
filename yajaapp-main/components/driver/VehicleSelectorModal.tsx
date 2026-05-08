import React from "react";
import { motion } from "framer-motion";
import { Car, CheckCircle2, X, AlertTriangle } from "lucide-react";

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function VehicleSelectorModal({ vehicles = [], vehicleDocs = [], onSelect, onClose }) {
  const defaultDocs = [
    { key: "licencia", label: "Licencia" },
    { key: "seguro", label: "Seguro" },
    { key: "circulacion", label: "Circulación" },
  ];
  const docs = vehicleDocs.length > 0 ? vehicleDocs : defaultDocs;

  const getVehicleAlerts = (v) => {
    const alerts = [];
    docs.forEach(d => {
      const days = daysUntilExpiry(v[`doc_${d.key}_expiry`]);
      if (days !== null && days < 0) alerts.push({ label: d.label, expired: true });
      else if (days !== null && days <= 30) alerts.push({ label: d.label, expired: false, days });
    });
    return alerts;
  };

  const isVehicleBlocked = (v) => {
    if (v.admin_disabled) return true;
    // Auto-block if any doc is expired
    return docs.some(d => {
      const days = daysUntilExpiry(v[`doc_${d.key}_expiry`]);
      return days !== null && days < 0;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="w-full bg-white rounded-t-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "85vh", overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">¿Con qué vehículo te conectas?</h3>
            <p className="text-sm text-slate-400 mt-0.5">Selecciona el vehículo con el que trabajarás hoy</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 flex-shrink-0">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {vehicles.map(v => {
            const alerts = getVehicleAlerts(v);
            const hasExpired = alerts.some(a => a.expired);
            const hasSoon = !hasExpired && alerts.length > 0;
            const blocked = isVehicleBlocked(v);

            return (
              <button
                key={v.id}
                onClick={() => !blocked && onSelect(v)}
                disabled={blocked}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  blocked
                    ? "border-red-200 bg-red-50 opacity-60 cursor-not-allowed"
                    : v.is_active
                    ? "border-blue-400 bg-blue-50 shadow-md shadow-blue-500/10"
                    : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${blocked ? "bg-red-100" : v.is_active ? "bg-blue-100" : "bg-slate-100"}`}>
                    <Car className={`w-6 h-6 ${blocked ? "text-red-400" : v.is_active ? "text-blue-600" : "text-slate-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{v.brand} {v.model}</p>
                    <p className="text-sm text-slate-500">{v.year} · {v.color}</p>
                    <p className="text-sm font-mono font-bold text-slate-600">{v.plates}</p>
                    {v.admin_disabled && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-red-600 font-medium">Deshabilitado por administrador</span>
                      </div>
                    )}
                    {hasExpired && !v.admin_disabled && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-red-600 font-medium">Documentos vencidos — no disponible</span>
                      </div>
                    )}
                    {hasSoon && !blocked && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="text-xs text-amber-600 font-medium">Docs por vencer</span>
                      </div>
                    )}
                  </div>
                  {v.is_active && !blocked && (
                    <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
