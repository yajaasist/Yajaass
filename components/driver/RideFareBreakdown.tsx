import React from "react";
import { Car } from "lucide-react";

export default function RideFareBreakdown({ ride, driver, settings }) {
  const hasDistance = !!ride.distance_km;
  const hasDuration = !!ride.duration_minutes;
  const totalPrice = ride.final_price || ride.estimated_price || 0;
  // Use commission from ride first, then driver's rate, then platform default, then 0
  const commissionRate = ride.commission_rate ?? driver?.commission_rate ?? settings?.platform_commission_pct ?? 0;
  const commission = ride.platform_commission ?? parseFloat((totalPrice * (commissionRate / 100)).toFixed(2));
  const extras = (ride.extra_charges || []).filter(e => e.paid_to_driver !== false);
  const extraTotal = extras.reduce((s, e) => s + (e.amount || 0), 0);
  const netEarnings = ride.driver_earnings ?? parseFloat((totalPrice - commission + extraTotal).toFixed(2));
  const isCompleted = ride.status === "completed";

  return (
    <div className="bg-white/10 rounded-2xl p-4 mb-4 border border-white/10 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <Car className="w-4 h-4 text-white/70" />
          </div>
          <div>
            <p className="text-xs text-white/40">Tipo de servicio</p>
            <p className="text-sm font-bold text-white">{ride.service_type_name || "—"}</p>
          </div>
        </div>
        {ride.payment_method && (
          <span className="text-xs bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white/60 capitalize">
            {ride.payment_method === "cash" ? "💵 Efectivo" : ride.payment_method === "card" ? "💳 Tarjeta" : ride.payment_method === "transfer" ? "🏦 Transferencia" : `💰 ${ride.payment_method}`}
          </span>
        )}
      </div>

      {(hasDistance || hasDuration) && (
        <div className="flex gap-3">
          {hasDistance && (
            <div className="flex-1 bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
              <p className="text-base font-bold text-white">{ride.distance_km}</p>
              <p className="text-[10px] text-white/40">km</p>
            </div>
          )}
          {hasDuration && (
            <div className="flex-1 bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
              <p className="text-base font-bold text-white">{ride.duration_minutes}</p>
              <p className="text-[10px] text-white/40">min</p>
            </div>
          )}
        </div>
      )}

      {/* Desglose de costos */}
      <div className="space-y-1.5 border-t border-white/10 pt-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Costo del servicio</span>
          <span className="text-white font-semibold">${totalPrice.toFixed(2)}</span>
        </div>
        {commissionRate > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Comisión plataforma ({commissionRate}%)</span>
            <span className="text-red-400">-${commission.toFixed(2)}</span>
          </div>
        )}
        {extras.map((e, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-white/50">Extra: {e.concept}</span>
            <span className="text-emerald-400">+${(e.amount || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between bg-emerald-500 rounded-xl px-4 py-3 mt-1">
        <div>
          <p className="text-xs text-emerald-100 font-medium">Tu ganancia</p>
          {isCompleted && <p className="text-[10px] text-emerald-200">Viaje completado ✓</p>}
        </div>
        <p className="text-2xl font-black text-white">${netEarnings.toFixed(0)}</p>
      </div>
    </div>
  );
}
