import React from "react";
import { Users, CheckCircle2, Zap, AlertCircle, XCircle } from "lucide-react";
import { startOfDayCDMX, endOfDayCDMX, todayCDMX } from "@/components/shared/dateUtils";

export default function DashboardStats({ rides = [], drivers = [], selectedDate }) {
  // Build day boundaries for the selected date in CDMX timezone
  const dayStr = selectedDate || todayCDMX();
  const dayStart = startOfDayCDMX(dayStr);
  const dayEnd = endOfDayCDMX(dayStr);

  // Use requested_at (when the ride was originally requested) to avoid counting
  // old rides that were updated (e.g. rated) today
  const isInSelectedDay = (r) => {
    const d = new Date(r.requested_at || r.created_date);
    return d >= dayStart && d <= dayEnd;
  };

  const activeDrivers = drivers.filter(d => d.status === "available").length;
  const busyDrivers = drivers.filter(d => d.status === "busy").length;
  const pendingRides = rides.filter(r => r.status === "pending" || r.status === "auction").length;
  // "Completados hoy" = rides requested today that are completed
  const completedRides = rides.filter(r => r.status === "completed" && isInSelectedDay(r)).length;
  // "Cancelados con costo" = rides cancelled today with a cancellation fee
  const cancelledWithFee = rides.filter(r => r.status === "cancelled" && (r.cancellation_fee || 0) > 0 && isInSelectedDay(r)).length;
  // "Cancelados sin costo" = rides cancelled today without a cancellation fee
  const cancelledNoCost = rides.filter(r => r.status === "cancelled" && !(r.cancellation_fee > 0) && isInSelectedDay(r)).length;
  const activeRides = rides.filter(r => !["completed", "cancelled"].includes(r.status)).length;

  const unassignedRides = rides.filter(r => (r.status === "pending" || r.status === "auction") && !r.driver_id).length;

  const stats = [
    {
      label: "Viajes activos",
      value: activeRides,
      sub: `${pendingRides} pendiente${pendingRides !== 1 ? "s" : ""}`,
      icon: Zap,
      gradient: "from-blue-500 to-blue-600",
      glow: "shadow-blue-200",
    },
    {
      label: "Conductores",
      value: activeDrivers + busyDrivers,
      sub: `${activeDrivers} disponible${activeDrivers !== 1 ? "s" : ""} · ${busyDrivers} en servicio`,
      icon: Users,
      gradient: "from-emerald-500 to-emerald-600",
      glow: "shadow-emerald-200",
    },
    {
      label: "Completados hoy",
      value: completedRides,
      sub: "viajes finalizados",
      icon: CheckCircle2,
      gradient: "from-violet-500 to-violet-600",
      glow: "shadow-violet-200",
    },
    {
      label: "Cancelado con costo",
      value: cancelledWithFee,
      sub: "cancelaciones con cargo",
      icon: AlertCircle,
      gradient: "from-orange-500 to-red-500",
      glow: "shadow-orange-200",
    },
    {
      label: "Cancelado sin costo",
      value: cancelledNoCost,
      sub: "sin cargo al pasajero",
      icon: XCircle,
      gradient: "from-slate-400 to-slate-500",
      glow: "shadow-slate-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
      {stats.map((stat) => (
        <div key={stat.label} className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-slate-100`}>
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg ${stat.glow}`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          <p className="text-xs font-medium text-slate-500 mt-0.5">{stat.label}</p>
          <p className="text-[10px] text-slate-400 mt-1">{stat.sub}</p>
        </div>
      ))}

      {/* Tarjeta de alerta: viajes pendientes sin asignar */}
      <div className={`relative rounded-2xl p-5 transition-all border overflow-hidden ${
        unassignedRides > 0
          ? "bg-gradient-to-br from-red-500 to-rose-600 border-red-400 shadow-lg shadow-red-200 animate-pulse"
          : "bg-white border-slate-100 shadow-sm"
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl shadow-lg ${unassignedRides > 0 ? "bg-white/20" : "bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-200"}`}>
            <AlertCircle className={`w-5 h-5 text-white`} />
          </div>
          {unassignedRides > 0 && (
            <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">⚠ Alerta</span>
          )}
        </div>
        <p className={`text-2xl font-bold ${unassignedRides > 0 ? "text-white" : "text-slate-900"}`}>{unassignedRides}</p>
        <p className={`text-xs font-medium mt-0.5 ${unassignedRides > 0 ? "text-red-100" : "text-slate-500"}`}>Sin asignar</p>
        <p className={`text-[10px] mt-1 ${unassignedRides > 0 ? "text-red-200" : "text-slate-400"}`}>viajes pendientes de conductor</p>
      </div>
    </div>
  );
}
