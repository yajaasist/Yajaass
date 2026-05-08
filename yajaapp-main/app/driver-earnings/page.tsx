"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/admin/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Car, Star, MapPin, Search, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import moment from "moment";
import { formatCDMX, todayCDMX } from "@/components/shared/dateUtils";
import DriverWeeklyEarnings from "@/components/driver/DriverWeeklyEarnings";
import { toast } from "sonner";

export default function DriverEarningsPage() {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("days"); // "days" | "range"
  const [daysCount, setDaysCount] = useState(1);
  const [dateFrom, setDateFrom] = useState(todayCDMX());
  const [dateTo, setDateTo] = useState(todayCDMX());
  const [expanded, setExpanded] = useState(null);
  const [weeklyView, setWeeklyView] = useState(null); // driver id for weekly view

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      try {
        return await supabaseApi.drivers.list();
      } catch (error) {
        toast.error("Error al cargar conductores");
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: rides = [] } = useQuery({
    queryKey: ["rides"],
    queryFn: async () => {
      try {
        return await supabaseApi.rideRequests.list();
      } catch (error) {
        toast.error("Error al cargar viajes");
        return [];
      }
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const since = filterMode === "days"
    ? moment().subtract(Math.max(1, daysCount), "days").startOf("day")
    : moment(dateFrom).startOf("day");
  const until = filterMode === "range" ? moment(dateTo).endOf("day") : null;

  const filteredDrivers = drivers.filter((d: any) =>
    !search || d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.city_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getDriverStats = (driverId: string) => {
    const driverRides = rides.filter((r: any) => {
      if (r.driver_id !== driverId || r.status !== "completed") return false;
      const d = moment(r.requested_at);
      if (!d.isAfter(since)) return false;
      if (until && d.isAfter(until)) return false;
      return true;
    });
    const totalRevenue = driverRides.reduce((s: number, r: any) => s + (r.final_price || r.estimated_price || 0), 0);
    const driverPay = driverRides.reduce((s: number, r: any) => s + (r.driver_earnings || 0), 0);
    const commission = driverRides.reduce((s: number, r: any) => s + (r.platform_commission || 0), 0);

    // Breakdown by payment method
    const cashRides = driverRides.filter((r: any) => r.payment_method === "cash");
    const cardRides = driverRides.filter((r: any) => r.payment_method === "card");
    const transferRides = driverRides.filter((r: any) => r.payment_method === "transfer");

    const cashEarnings = cashRides.reduce((s: number, r: any) => s + (r.driver_earnings || 0), 0);
    const cardEarnings = cardRides.reduce((s: number, r: any) => s + (r.driver_earnings || 0), 0);
    const transferEarnings = transferRides.reduce((s: number, r: any) => s + (r.driver_earnings || 0), 0);

    const cashCommission = cashRides.reduce((s: number, r: any) => s + (r.platform_commission || 0), 0);
    const cardCommission = cardRides.reduce((s: number, r: any) => s + (r.platform_commission || 0), 0);
    const transferCommission = transferRides.reduce((s: number, r: any) => s + (r.platform_commission || 0), 0);

    // Logic: non-cash → plataforma paga al conductor (bruto - comisión)
    // cash → conductor ya cobró todo, se le descuenta la comisión del total
    // Balance = no_efectivo_neto - comisión_efectivo
    const nonCashNet = cardEarnings + transferEarnings; // Ya descontada comisión
    const netToPay = nonCashNet;
    const cashToCollect = cashCommission; // Lo que el conductor debe depositar de comisión efectivo
    const finalBalance = nonCashNet - cashCommission; // Si >0 plataforma paga; si <0 conductor paga

    return {
      rides: driverRides, count: driverRides.length, total: driverPay, totalRevenue, commission,
      byMethod: {
        cash: { count: cashRides.length, earnings: cashEarnings, commission: cashCommission },
        card: { count: cardRides.length, earnings: cardEarnings, commission: cardCommission },
        transfer: { count: transferRides.length, earnings: transferEarnings, commission: transferCommission },
      },
      netToPay,
      cashToCollect,
      finalBalance,
    };
  };

  return (
    <Layout currentPageName="DriverEarnings">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Ganancias por conductor</h1>
            <p className="text-sm text-slate-400 mt-0.5">Panel detallado de ingresos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-medium">
              <button onClick={() => setFilterMode("days")} className={`px-3 py-2 transition-colors ${filterMode === "days" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>Por días</button>
              <button onClick={() => setFilterMode("range")} className={`px-3 py-2 transition-colors ${filterMode === "range" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>Por fechas</button>
            </div>
            {filterMode === "days" ? (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 whitespace-nowrap">Últimos</Label>
                <Input type="number" min={1} value={daysCount} onChange={e => setDaysCount(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 rounded-xl text-center" />
                <Label className="text-xs text-slate-500">días</Label>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl w-36" />
                <span className="text-xs text-slate-400">→</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-xl w-36" />
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar conductor o ciudad..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </div>

        <div className="space-y-3">
          {filteredDrivers.map((driver: any) => {
            const stats = getDriverStats(driver.id);
            const isExpanded = expanded === driver.id;
            return (
              <Card key={driver.id} className="border-0 shadow-sm overflow-hidden">
                <button
                  className="w-full p-5 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : driver.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-700">
                        {driver.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{driver.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {driver.city_name && <span className="text-xs text-slate-400 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{driver.city_name}</span>}
                          <span className="text-xs text-slate-400 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{driver.rating || 5}</span>
                          <span className="text-xs text-slate-400"><Car className="w-3 h-3 inline" /> {driver.total_rides || 0} viajes totales</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400">Viajes (período)</p>
                        <p className="font-bold text-slate-900">{stats.count}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400">Total cobrado</p>
                        <p className="font-bold text-slate-700">${stats.totalRevenue.toFixed(0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Pago conductor</p>
                        <p className="font-bold text-emerald-600">${stats.total.toFixed(0)}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400">Comisión plat.</p>
                        <p className="font-medium text-violet-600">${stats.commission.toFixed(0)}</p>
                      </div>
                      {stats.byMethod.cash.count > 0 && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-slate-400">Com. efectivo</p>
                          <p className="font-medium text-red-500">-${stats.cashToCollect.toFixed(0)}</p>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                    {/* Tabs: resumen por período / desglose semanal */}
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setWeeklyView(weeklyView === driver.id ? null : driver.id)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors ${weeklyView === driver.id ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {weeklyView === driver.id ? "Ver resumen por período" : "Ver desglose semanal"}
                      </button>
                    </div>

                    {weeklyView === driver.id ? (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" /> Desglose semanal (Lun–Dom)
                          </p>
                        </div>
                        <DriverWeeklyEarnings
                          driver={driver}
                          rides={rides.filter((r: any) => r.driver_id === driver.id && r.status === "completed")}
                          darkMode={false}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stats.count > 0 && (
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Desglose por método de pago</p>
                            </div>
                            <div className="p-4 space-y-2">
                              {stats.byMethod.cash.count > 0 && (
                                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                  <div>
                                    <p className="text-sm font-semibold text-amber-800">💵 Efectivo ({stats.byMethod.cash.count} viajes)</p>
                                    <p className="text-xs text-amber-600">Ganancia conductor: ${stats.byMethod.cash.earnings.toFixed(0)}</p>
                                    <p className="text-xs text-red-600 font-bold">Comisión a cobrar: -${stats.byMethod.cash.commission.toFixed(0)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-amber-500">Líquido conductor</p>
                                    <p className="text-lg font-black text-amber-700">${(stats.byMethod.cash.earnings - stats.byMethod.cash.commission).toFixed(0)}</p>
                                  </div>
                                </div>
                              )}
                              {stats.byMethod.card.count > 0 && (
                                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                                  <div>
                                    <p className="text-sm font-semibold text-blue-800">💳 Tarjeta ({stats.byMethod.card.count} viajes)</p>
                                    <p className="text-xs text-blue-600">Ganancia conductor: ${stats.byMethod.card.earnings.toFixed(0)}</p>
                                    <p className="text-xs text-slate-500">Comisión plataforma: ${stats.byMethod.card.commission.toFixed(0)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-blue-500">A pagar conductor</p>
                                    <p className="text-lg font-black text-blue-700">${stats.byMethod.card.earnings.toFixed(0)}</p>
                                  </div>
                                </div>
                              )}
                              {stats.byMethod.transfer.count > 0 && (
                                <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                                  <div>
                                    <p className="text-sm font-semibold text-purple-800">🏦 Transferencia ({stats.byMethod.transfer.count} viajes)</p>
                                    <p className="text-xs text-purple-600">Ganancia conductor: ${stats.byMethod.transfer.earnings.toFixed(0)}</p>
                                    <p className="text-xs text-slate-500">Comisión plataforma: ${stats.byMethod.transfer.commission.toFixed(0)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-purple-500">A pagar conductor</p>
                                    <p className="text-lg font-black text-purple-700">${stats.byMethod.transfer.earnings.toFixed(0)}</p>
                                  </div>
                                </div>
                              )}
                              <div className={`mt-3 p-3 rounded-xl border-2 ${stats.finalBalance >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                                <p className="text-xs text-slate-500 font-medium mb-1">Balance del período</p>
                                {stats.byMethod.cash.count > 0 && (
                                  <div className="flex justify-between text-xs text-slate-600">
                                    <span>💵 Com. efectivo a descontar</span>
                                    <span className="text-red-600 font-semibold">-${stats.cashToCollect.toFixed(0)}</span>
                                  </div>
                                )}
                                {(stats.byMethod.card.count > 0 || stats.byMethod.transfer.count > 0) && (
                                  <div className="flex justify-between text-xs text-slate-600">
                                    <span>💳 No-efectivo neto a pagar</span>
                                    <span className="text-blue-600 font-semibold">+${stats.netToPay.toFixed(0)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-slate-200">
                                  <span className="text-slate-700">📊 Balance final</span>
                                  <span className={stats.finalBalance >= 0 ? "text-emerald-700" : "text-red-600"}>
                                    {stats.finalBalance >= 0 ? `Plataforma paga $${stats.finalBalance.toFixed(0)}` : `Conductor deposita $${Math.abs(stats.finalBalance).toFixed(0)}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-1">Viajes realizados</p>
                        {stats.rides.length === 0 && (
                          <p className="text-sm text-slate-400 text-center py-4">Sin viajes en este período</p>
                        )}
                        {stats.rides.map((ride: any) => (
                          <div key={ride.id} className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-slate-800">{ride.passenger_name}</p>
                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                                  {ride.payment_method === "cash" ? "💵" : ride.payment_method === "card" ? "💳" : "🏦"}
                                </span>
                                {ride.admin_rating && (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />{ride.admin_rating}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 truncate">
                                <MapPin className="w-3 h-3 inline mr-0.5" />{ride.pickup_address}
                                {ride.dropoff_address && <> → {ride.dropoff_address}</>}
                              </p>
                              <p className="text-xs text-slate-400">{formatCDMX(ride.requested_at, "shortdatetime")}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {ride.final_price > 0 && <p className="text-xs text-slate-400">Total: ${ride.final_price.toFixed(0)}</p>}
                              <p className="font-bold text-emerald-600">${(ride.driver_earnings || 0).toFixed(0)}</p>
                              <p className="text-[10px] text-violet-500">Com: ${(ride.platform_commission || 0).toFixed(0)}</p>
                              {ride.payment_method === "cash" && (
                                <p className="text-[10px] text-red-500">Cobrar com. efectivo</p>
                              )}
                              {ride.distance_km && <p className="text-xs text-slate-400">{ride.distance_km} km</p>}
                              {ride.proof_photo_url && (
                                <a href={ride.proof_photo_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Ver foto</a>
                              )}
                            </div>
                          </div>
                        ))}
                        {driver.bank_clabe && (
                          <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-500">
                            <p className="font-medium text-slate-700 mb-1">Datos bancarios</p>
                            <p>{driver.bank_holder} · {driver.bank_name}</p>
                            <p className="font-mono">CLABE: {driver.bank_clabe}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
