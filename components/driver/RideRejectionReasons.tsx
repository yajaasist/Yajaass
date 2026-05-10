/**
 * RideRejectionReasons.tsx
 * 
 * Modal que aparece cuando el conductor quiere rechazar un viaje
 * Permite seleccionar una razón e incluye contador de rechazos previos
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, MapPin, Zap, Clock, AlertTriangle, DollarSign, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RejectionReason {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: "distance" | "time" | "location" | "health" | "vehicle" | "other";
  description?: string;
  riskLevel?: "low" | "medium" | "high"; // high = pode afectar rating si rechaza mucho
}

const REJECTION_REASONS: RejectionReason[] = [
  {
    id: "too_far",
    label: "Demasiado lejos de mí",
    icon: <Navigation className="w-5 h-5" />,
    category: "distance",
    description: "Está fuera de mi rango de cobertura",
    riskLevel: "medium",
  },
  {
    id: "wrong_direction",
    label: "Dirección opuesta a mi ruta",
    icon: <MapPin className="w-5 h-5" />,
    category: "distance",
    description: "No va a mi destino previsto",
    riskLevel: "low",
  },
  {
    id: "low_fare",
    label: "La tarifa es muy baja",
    icon: <DollarSign className="w-5 h-5" />,
    category: "other",
    description: "No es rentable para mis gastos",
    riskLevel: "high",
  },
  {
    id: "no_time",
    label: "No tengo tiempo ahora",
    icon: <Clock className="w-5 h-5" />,
    category: "time",
    description: "Prefiero revisar más tarde",
    riskLevel: "medium",
  },
  {
    id: "vehicle_issue",
    label: "Problema con mi vehículo",
    icon: <AlertTriangle className="w-5 h-5" />,
    category: "vehicle",
    description: "Mi auto necesita mantenimiento",
    riskLevel: "low",
  },
  {
    id: "health_issue",
    label: "No me siento bien",
    icon: <Zap className="w-5 h-5" />,
    category: "health",
    description: "Necesito descansar",
    riskLevel: "low",
  },
  {
    id: "other",
    label: "Otra razón",
    icon: <AlertTriangle className="w-5 h-5" />,
    category: "other",
    description: "Hay una razón personal",
    riskLevel: "medium",
  },
];

interface RideRejectionReasonsProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reasonId: string) => void;
  rejectCount?: number; // Cuántos viajes ha rechazado hoy
  warningThreshold?: number;
  reasons?: string[];
  highRiskReasons?: string[];
  warningMessageTemplate?: string;
  highRiskTip?: string;
  ride?: any;
}

export default function RideRejectionReasons({
  open,
  onClose,
  onConfirm,
  rejectCount = 0,
  warningThreshold = 3,
  reasons,
  highRiskReasons,
  warningMessageTemplate,
  highRiskTip,
  ride,
}: RideRejectionReasonsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onConfirm(selected);
      setSelected(null);
    }
  };

  const configuredReasons: RejectionReason[] = Array.isArray(reasons) && reasons.length > 0
    ? reasons
        .map((label) => String(label || "").trim())
        .filter(Boolean)
        .map((label) => ({
          id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "other",
          label,
          icon: <AlertTriangle className="w-5 h-5" />,
          category: "other" as const,
          description: "Razón seleccionada por configuración",
          riskLevel: "medium" as const,
        }))
    : REJECTION_REASONS;

  const normalizedHighRisk = Array.isArray(highRiskReasons)
    ? highRiskReasons.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];

  const reasonsWithRisk: RejectionReason[] = configuredReasons.map((r) => {
    const byId = normalizedHighRisk.includes(String(r.id || "").trim().toLowerCase());
    const byLabel = normalizedHighRisk.includes(String(r.label || "").trim().toLowerCase());
    return byId || byLabel ? { ...r, riskLevel: "high" } : r;
  });

  const showWarning = rejectCount >= warningThreshold;
  const selectedReason = reasonsWithRisk.find((r) => r.id === selected);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-4 flex items-center justify-between border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">¿Por qué rechazas?</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Warning if too many rejections */}
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 mx-4 mt-3 rounded-lg"
          >
            <p className="text-xs font-semibold text-amber-700">
              {warningMessageTemplate
                ? warningMessageTemplate
                    .replace("{count}", String(rejectCount))
                    .replace("{threshold}", String(warningThreshold))
                : `⚠️ Has rechazado ${rejectCount} viajes hoy. Tu calificación podría verse afectada.`}
            </p>
          </motion.div>
        )}

        {/* Reasons grid */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
          {reasonsWithRisk.map((reason) => {
            const isSelected = selected === reason.id;
            const isRiskyReason = reason.riskLevel === "high";

            return (
              <motion.button
                key={reason.id}
                onClick={() => setSelected(reason.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-100 bg-slate-50 hover:border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? "border-blue-400 bg-blue-400"
                        : "border-slate-300 bg-slate-100"
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      {React.cloneElement(reason.icon as React.ReactElement, {
                        className: `w-4 h-4 ${
                          reason.category === "distance"
                            ? "text-blue-500"
                            : reason.category === "time"
                            ? "text-amber-500"
                            : reason.category === "location"
                            ? "text-green-500"
                            : reason.category === "health"
                            ? "text-red-500"
                            : "text-slate-400"
                        }`,
                      })}
                      {reason.label}
                    </p>
                    {reason.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{reason.description}</p>
                    )}
                    {isRiskyReason && (
                      <p className="text-[10px] font-semibold text-red-600 mt-1">
                        ⚠️ Puede afectar tu rating
                      </p>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-4 space-y-2">
          {selectedReason && selectedReason.riskLevel === "high" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              <p className="text-xs text-red-700 font-semibold">
                {highRiskTip || "💡 Tip: Responder más viajes mejora tu calificación y prioridad para futuras solicitudes."}
              </p>
            </motion.div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl h-12"
            >
              Volver a aceptar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selected}
              className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-700 text-white disabled:bg-slate-300"
            >
              Confirmar rechazo
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
