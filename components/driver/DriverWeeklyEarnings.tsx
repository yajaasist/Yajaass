import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Download, MapPin, Star } from "lucide-react";
import moment from "moment";
import { formatCDMX } from "@/components/shared/dateUtils";

// Build array of week ranges (Mon 00:00 → Sun 23:59:59), starting from oldest ride up to now
function buildWeeks(rides, weeksBack = 12) {
  const weeks = [];
  const now = moment();
  const monday = now.clone().startOf("isoWeek");
  for (let i = 0; i < weeksBack; i++) {
    const start = monday.clone().subtract(i, "weeks");
    const end = start.clone().endOf("isoWeek");
    weeks.push({ start, end });
  }
  return weeks;
}

function getWeekRides(rides, week) {
  return rides.filter(r => {
    const d = moment(r.requested_at);
    return d.isSameOrAfter(week.start) && d.isSameOrBefore(week.end);
  });
}

function formatWeekLabel(week) {
  const start = week.start.format("D MMM");
  const end = week.end.format("D MMM");
  const isCurrentWeek = moment().isBetween(week.start, week.end, null, "[]");
  return `${start} – ${end}${isCurrentWeek ? " (Esta semana)" : ""}`;
}

function downloadCSV(rows, driver, week) {
  const header = "Fecha,Pasajero,Origen,Destino,Pago,Ganancia,Comisión,Estado";
  const lines = rows.map(r => [
    formatCDMX(r.requested_at, "shortdatetime"),
    r.passenger_name || "",
    r.pickup_address || "",
    r.dropoff_address || "",
    r.payment_method || "",
    (r.driver_earnings || 0).toFixed(2),
    (r.platform_commission || 0).toFixed(2),
    r.status,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `corte_${driver?.full_name?.replace(/\s+/g, "_") || "conductor"}_${week.start.format("YYYY-MM-DD")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * DriverWeeklyEarnings
 * Props:
 *   driver: Driver object
 *   rides: array of RideRequest (all rides for this driver)
 *   darkMode: boolean (for driver app)
 */
export default function DriverWeeklyEarnings({ driver, rides = [], darkMode = false }) {
  const completedRides = rides.filter(r => r.status === "completed");
  const weeks = buildWeeks(completedRides, 16);

  const [weekIdx, setWeekIdx] = useState(0); // 0 = current week
  const [dayIdx, setDayIdx] = useState(null); // null = week view, number = day drill-down

  const week = weeks[weekIdx];
  const weekRides = getWeekRides(completedRides, week);

  // Build days Mon–Sun for this week
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = week.start.clone().add(i, "days");
    const dayRides = weekRides.filter(r => moment(r.requested_at).isSame(day, "day"));
    const earnings = dayRides.reduce((s, r) => s + (r.driver_earnings || 0), 0);
    const commission = dayRides.reduce((s, r) => s + (r.platform_commission || 0), 0);
    return { day, rides: dayRides, earnings, commission };
  });

  const weekEarnings = weekRides.reduce((s, r) => s + (r.driver_earnings || 0), 0);
  const weekCommission = weekRides.reduce((s, r) => s + (r.platform_commission || 0), 0);

  // Payment method breakdown — dynamic keys
  const byMethod: Record<string, { rides: any[]; e: number; c: number }> = {};
  weekRides.forEach(r => {
    const key = r.payment_method || "cash";
    if (!byMethod[key]) byMethod[key] = { rides: [], e: 0, c: 0 };
    byMethod[key].rides.push(r);
    byMethod[key].e += r.driver_earnings || 0;
    byMethod[key].c += r.platform_commission || 0;
  });

  // Balance: no-efectivo neto - comisión efectivo
  // efectivo = conductor ya cobró, debe depositar su comisión
  // no-efectivo = plataforma debe pagar al conductor (ya descontada comisión)
  const isCashKey = (k) => k === "cash" || k.toLowerCase().includes("efectivo");
  let nonCashNet = 0, cashComm = 0;
  Object.entries(byMethod).forEach(([key, data]) => {
    if (isCashKey(key)) cashComm += data.c;
    else nonCashNet += data.e;
  });
  const weekBalance = nonCashNet - cashComm;

  const bg = darkMode ? "bg-slate-900" : "bg-white";
  const cardBg = darkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200";
  const textPrimary = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-white/50" : "text-slate-400";

  // Day drill-down
  if (dayIdx !== null) {
    const { day, rides: dayRidesList, earnings: dayEarnings, commission: dayCommission } = days[dayIdx];
    return (
      <div className={`space-y-4 ${darkMode ? "p-4" : ""}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setDayIdx(null)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className={`font-bold ${textPrimary}`}>{day.format("dddd D [de] MMMM")}</p>
            <p className={`text-xs ${textMuted}`}>{dayRidesList.length} viajes · ${dayEarnings.toFixed(0)} ganados</p>
          </div>
        </div>

        {/* Day summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-xl p-3 text-center border ${cardBg}`}>
            <p className={`text-lg font-bold ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>${dayEarnings.toFixed(0)}</p>
            <p className={`text-[10px] ${textMuted}`}>Ganancia</p>
          </div>
          <div className={`rounded-xl p-3 text-center border ${cardBg}`}>
            <p className={`text-lg font-bold ${darkMode ? "text-red-400" : "text-red-500"}`}>-${dayCommission.toFixed(0)}</p>
            <p className={`text-[10px] ${textMuted}`}>Comisión</p>
          </div>
          <div className={`rounded-xl p-3 text-center border ${cardBg}`}>
            <p className={`text-lg font-bold ${textPrimary}`}>{dayRidesList.length}</p>
            <p className={`text-[10px] ${textMuted}`}>Viajes</p>
          </div>
        </div>

        {dayRidesList.length === 0 ? (
          <p className={`text-center py-8 text-sm ${textMuted}`}>Sin viajes este día</p>
        ) : (
          <div className="space-y-2">
            {dayRidesList.map(ride => (
              <div key={ride.id} className={`rounded-xl p-3 border ${cardBg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${textPrimary}`}>{ride.passenger_name}</p>
                    <p className={`text-xs truncate ${textMuted}`}><MapPin className="w-3 h-3 inline mr-0.5" />{ride.pickup_address}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${darkMode ? "bg-white/10 text-white/50" : "bg-slate-100 text-slate-500"}`}>
                        {ride.payment_method === "cash" ? "💵 Efectivo" : ride.payment_method === "card" ? "💳 Tarjeta" : "🏦 Transferencia"}
                      </span>
                      {ride.admin_rating && (
                        <span className="text-[10px] flex items-center gap-0.5 text-amber-500">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />{ride.admin_rating}
                        </span>
                      )}
                      <p className={`text-[10px] ${textMuted}`}>{formatCDMX(ride.requested_at || ride.created_date, "time")}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>${(ride.driver_earnings || 0).toFixed(0)}</p>
                    <p className={`text-[10px] ${darkMode ? "text-red-400" : "text-red-500"}`}>-${(ride.platform_commission || 0).toFixed(0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Week view
  return (
    <div className={`space-y-4 ${darkMode ? "p-4" : ""}`}>
      {/* Week selector */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekIdx(i => Math.min(i + 1, weeks.length - 1))}
          disabled={weekIdx >= weeks.length - 1}
          className={`w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30 ${darkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center flex-1">
          <p className={`text-xs font-bold ${textPrimary}`}>{formatWeekLabel(week)}</p>
          <p className={`text-[10px] ${textMuted}`}>{weekRides.length} viajes</p>
        </div>
        <button
          onClick={() => setWeekIdx(i => Math.max(i - 1, 0))}
          disabled={weekIdx <= 0}
          className={`w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30 ${darkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => downloadCSV(weekRides, driver, week)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"}`}
          title="Descargar CSV"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Week totals */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-xl p-3 text-center border ${cardBg}`}>
          <p className={`text-xl font-bold ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>${weekEarnings.toFixed(0)}</p>
          <p className={`text-[10px] ${textMuted}`}>Ganancia neta</p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${cardBg}`}>
          <p className={`text-xl font-bold ${textPrimary}`}>{weekRides.length}</p>
          <p className={`text-[10px] ${textMuted}`}>Viajes</p>
        </div>
      </div>

      {/* Balance semana */}
      {weekRides.length > 0 && (
        <div className={`rounded-xl p-3 border-2 ${weekBalance >= 0 ? (darkMode ? "border-emerald-500/40 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50") : (darkMode ? "border-red-500/40 bg-red-500/10" : "border-red-200 bg-red-50")}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>Balance semanal</p>
          <p className={`text-2xl font-black ${weekBalance >= 0 ? (darkMode ? "text-emerald-400" : "text-emerald-700") : (darkMode ? "text-red-400" : "text-red-600")}`}>
            {weekBalance >= 0 ? "+" : "-"}${Math.abs(weekBalance).toFixed(0)}
          </p>
          <p className={`text-[10px] mt-0.5 ${textMuted}`}>
            {weekBalance >= 0 ? "Plataforma paga al conductor" : "Conductor deposita a plataforma"}
          </p>
          {cashComm > 0 && <p className={`text-[10px] ${darkMode ? "text-amber-400" : "text-amber-600"}`}>Com. efectivo a descontar: -${cashComm.toFixed(0)}</p>}
          {nonCashNet > 0 && <p className={`text-[10px] ${darkMode ? "text-blue-400" : "text-blue-600"}`}>No-efectivo neto: +${nonCashNet.toFixed(0)}</p>}
        </div>
      )}

      {/* Payment method breakdown */}
      {weekRides.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider px-3 py-2 border-b ${darkMode ? "border-white/10 text-white/40" : "border-slate-200 text-slate-400"}`}>
            Desglose por método de pago
          </p>
          <div className="p-3 space-y-2">
            {Object.entries(byMethod).map(([key, data]) => {
              const isCash = isCashKey(key);
              const emoji = isCash ? "💵" : key === "card" ? "💳" : "🏦";
              return (
                <div key={key} className="flex justify-between text-sm">
                  <span className={textMuted}>{emoji} {key} ({data.rides.length})</span>
                  <div className="text-right">
                    <span className={darkMode ? "text-emerald-400 font-semibold" : "text-emerald-600 font-semibold"}>${data.e.toFixed(0)}</span>
                    <span className={`text-xs ml-2 ${darkMode ? "text-red-400" : "text-red-500"}`}>-${data.c.toFixed(0)} com.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Days of the week */}
      <div className="space-y-1">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Días de la semana</p>
        {days.map((d, i) => {
          const isToday = d.day.isSame(moment(), "day");
          const isFuture = d.day.isAfter(moment(), "day");
          return (
            <button
              key={i}
              onClick={() => !isFuture && setDayIdx(i)}
              disabled={isFuture}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all disabled:opacity-30 ${
                isToday
                  ? darkMode ? "bg-blue-500/20 border border-blue-500/30" : "bg-blue-50 border border-blue-200"
                  : darkMode ? "bg-white/5 border border-white/5 hover:bg-white/10" : "bg-slate-50 border border-slate-100 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 text-left`}>
                  <p className={`text-xs font-bold ${isToday ? (darkMode ? "text-blue-400" : "text-blue-600") : textPrimary}`}>
                    {d.day.format("ddd")}
                  </p>
                  <p className={`text-[10px] ${textMuted}`}>{d.day.format("D")}</p>
                </div>
                <div className={`text-xs ${textMuted}`}>{d.rides.length} viaje{d.rides.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                {d.earnings > 0 ? (
                  <>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>${d.earnings.toFixed(0)}</p>
                      <p className={`text-[10px] ${darkMode ? "text-red-400" : "text-red-500"}`}>-${d.commission.toFixed(0)}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${textMuted}`} />
                  </>
                ) : (
                  <span className={`text-xs ${textMuted}`}>Sin viajes</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
