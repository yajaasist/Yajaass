import React from "react";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  pending: { label: "Pendiente", class: "bg-amber-50 text-amber-700 border-amber-200" },
  assigned: { label: "Asignado", class: "bg-blue-50 text-blue-700 border-blue-200" },
  en_route: { label: "En camino", class: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  arrived: { label: "Llegó", class: "bg-purple-50 text-purple-700 border-purple-200" },
  in_progress: { label: "En curso", class: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  completed: { label: "Completado", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelado", class: "bg-red-50 text-red-700 border-red-200" },
  no_drivers: { label: "Sin conductores", class: "bg-red-100 text-red-800 border-red-400 font-bold" },
  auction: { label: "Subasta", class: "bg-orange-50 text-orange-700 border-orange-200" },
  scheduled: { label: "Programado", class: "bg-blue-50 text-blue-700 border-blue-200" },
  available: { label: "Disponible", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  busy: { label: "Ocupado", class: "bg-amber-50 text-amber-700 border-amber-200" },
  offline: { label: "Desconectado", class: "bg-slate-50 text-slate-500 border-slate-200" },
  suspended: { label: "Suspendido", class: "bg-orange-50 text-orange-700 border-orange-200" },
  blocked: { label: "Bloqueado", class: "bg-red-50 text-red-700 border-red-200" },
  admin_approved: { label: "Aprobado inicio", class: "bg-teal-50 text-teal-700 border-teal-200" },
};

export default function StatusBadge({ status, label, className = "" }) {
  const config = statusConfig[status] || { label: status, class: "bg-slate-100 text-slate-600" };
  return (
    <Badge variant="outline" className={`${config.class} ${className} font-medium text-xs px-2.5 py-0.5`}>
      {label || config.label}
    </Badge>
  );
}
