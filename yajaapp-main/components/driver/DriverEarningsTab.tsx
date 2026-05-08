import React from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Star, History, Calendar, MapPin } from "lucide-react";
import moment from "moment";
import { formatCDMX, startOfDayCDMX, endOfDayCDMX, todayCDMX } from "@/components/shared/dateUtils";
import DriverWeeklyEarnings from "@/components/driver/DriverWeeklyEarnings";

export default function DriverEarningsTab({ driver, rides = [], onShowHistory }) {
  const completedOnly = rides.filter(r => r.status === "completed");
  const cancelledWithFeeOnly = rides.filter(r => r.status === "cancelled" && (r.cancellation_fee || 0) > 0);
  const thisMonth = completedOnly.filter(r => moment(r.created_date).isSame(moment(), "month"));
  const monthEarnings = thisMonth.reduce((s, r) => s + (r.driver_earnings || r.final_price || 0), 0);
  const totalCountableTrips = completedOnly.length + cancelledWithFeeOnly.length;

  // Today's earnings — timezone-aware
  const todayStr = todayCDMX();
  const todayStartUTC = startOfDayCDMX(todayStr);
  const todayEndUTC = endOfDayCDMX(todayStr);
  const todayCompleted = completedOnly.filter(r => {
    const d = new Date(r.completed_at || r.updated_date || r.created_date);
    return d >= todayStartUTC && d <= todayEndUTC;
  });
  const todayEarnings = todayCompleted.reduce((s, r) => s + (r.driver_earnings || r.final_price || 0), 0);

  // Today's rides list (completed + cancelled)
  const todayRides = rides.filter(r => {
    if (r.status === "cancelled" && (r.cancellation_fee || 0) <= 0) return false;
    if (!["completed", "cancelled"].includes(r.status)) return false;
    const d = new Date(r.completed_at || r.updated_date || r.created_date);
    return d >= todayStartUTC && d <= todayEndUTC;
  });

  return (
    <div className="space-y-4 p-5 pb-28">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <DollarSign className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-emerald-700">${todayEarnings.toFixed(0)}</p>
          <p className="text-xs text-emerald-600">Total ganado hoy</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-blue-700">${monthEarnings.toFixed(0)}</p>
          <p className="text-xs text-blue-600">Este mes</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-800">{totalCountableTrips}</p>
          <p className="text-xs text-slate-500">Viajes totales</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-700 flex items-center justify-center gap-1">
            {driver.rating || 5} <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </p>
          <p className="text-xs text-amber-600">Calificación</p>
        </div>
      </div>

      <Button variant="outline" className="w-full rounded-xl min-h-[44px] select-none" onClick={onShowHistory}>
        <History className="w-4 h-4 mr-2" /> Ver historial completo de viajes
      </Button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-900 text-sm">Desglose semanal</h3>
        </div>
        <DriverWeeklyEarnings driver={driver} rides={rides} darkMode={false} />
      </div>

      <h3 className="font-semibold text-slate-900 text-sm pt-2">Servicios realizados hoy</h3>
      {todayRides.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">Sin servicios completados hoy</p>
      )}
      <div className="space-y-2">
        {todayRides.map(ride => {
          const isCancelled = ride.status === "cancelled";
          const netEarnings = ride.driver_earnings ?? (isCancelled ? 0 : (ride.estimated_price || 0));
          return (
            <div key={ride.id} className={`rounded-xl p-3 border ${isCancelled ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {ride.service_id && <p className="text-[10px] text-slate-400 font-mono">{ride.service_id}</p>}
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-800">{ride.passenger_name}</p>
                    {isCancelled && <span className="text-[9px] bg-red-100 text-red-500 rounded-full px-1.5 py-0.5 font-bold">CANC.</span>}
                  </div>
                  <p className="text-xs text-slate-400 truncate"><MapPin className="w-3 h-3 inline mr-0.5" />{ride.pickup_address}</p>
                  {ride.distance_km && !isCancelled && (
                    <p className="text-xs text-slate-500 mt-0.5">📏 {ride.distance_km} km{ride.duration_minutes ? ` · ${ride.duration_minutes} min` : ""}</p>
                  )}
                  {isCancelled && ride.cancellation_reason && (
                    <p className="text-xs text-red-400 mt-0.5 truncate">Motivo: {ride.cancellation_reason}</p>
                  )}
                  <p className="text-xs text-slate-300 mt-0.5">{formatCDMX(ride.requested_at || ride.created_date, "shortdatetime")}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  {netEarnings > 0 ? (
                    <>
                      <p className="font-bold text-emerald-600">${netEarnings.toFixed(0)}</p>
                      <p className="text-xs text-slate-400">Tu ganancia</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">$0</p>
                  )}
                  {ride.admin_rating && !isCancelled && (
                    <div className="flex items-center gap-0.5 justify-end mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs text-amber-600">{ride.admin_rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
