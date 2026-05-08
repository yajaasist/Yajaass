"use client";

import React, { useState } from "react";
import Layout from "@/components/admin/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { todayCDMX, startOfDayCDMX, formatCDMX } from "@/components/shared/dateUtils";
import { toast } from "sonner";

function getWeekBounds(weeksBack = 0) {
  const todayStart = startOfDayCDMX(todayCDMX());
  const day = todayStart.getUTCDay(); // 0=Sun, 1=Mon...
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const start = new Date(todayStart.getTime() + (mondayDelta - weeksBack * 7) * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000 + (23 * 60 * 60 + 59 * 60 + 59) * 1000);
  return { start, end };
}

function calcWeekSummary(rides, commissionPct) {
  let nonCashTotal = 0, cashTotal = 0, nonCashComm = 0, cashComm = 0;
  rides.forEach(r => {
    const amount = r.final_price || r.estimated_price || 0;
    const comm = r.platform_commission != null ? r.platform_commission : +(amount * commissionPct / 100);
    const isCash = (r.payment_method || "").toLowerCase().includes("efectivo") || r.payment_method === "cash";
    if (isCash) { cashTotal += amount; cashComm += comm; }
    else { nonCashTotal += amount; nonCashComm += comm; }
  });
  const nonCashNet = nonCashTotal - nonCashComm;
  const balance = nonCashNet - cashComm;
  return { nonCashTotal, cashTotal, nonCashComm, cashComm, nonCashNet, balance };
}

export default function Liquidaciones() {
  const queryClient = useQueryClient();
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [marking, setMarking] = useState(false);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => supabaseApi.drivers.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const settings = settingsList[0];
  const commissionPct = settings?.platform_commission_pct || 20;

  const { data: allRides = [] } = useQuery({
    queryKey: ["rides-completed"],
    queryFn: async () => {
      const data = await supabaseApi.rideRequests.list();
      return data.filter(r => r.status === "completed");
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset);

  const weekLabel = `${formatCDMX(weekStart, "daymonth")} – ${formatCDMX(weekEnd, "date")}${weekOffset === 0 ? " (Esta semana)" : ""}`;

  const weekRides = allRides.filter(r => {
    if (r.driver_id !== selectedDriverId) return false;
    const d = new Date(r.requested_at || "");
    if (Number.isNaN(d.getTime())) return false;
    return d >= weekStart && d <= weekEnd;
  });

  const allPaid = weekRides.length > 0 && weekRides.every(r => r.payment_status === "paid");
  const summary = calcWeekSummary(weekRides, commissionPct);
  const driver = drivers.find(d => d.id === selectedDriverId);

  // By method breakdown
  const byMethod: Record<string, { count: number; total: number; comm: number }> = {};
  weekRides.forEach(r => {
    const k = r.payment_method || "unknown";
    if (!byMethod[k]) byMethod[k] = { count: 0, total: 0, comm: 0 };
    const amount = r.final_price || r.estimated_price || 0;
    const comm = r.platform_commission != null ? r.platform_commission : +(amount * commissionPct / 100);
    byMethod[k].count++;
    byMethod[k].total += amount;
    byMethod[k].comm += comm;
  });

  const markAsPaid = async () => {
    if (!selectedDriverId || weekRides.length === 0) return;
    setMarking(true);
    const pending = weekRides.filter(r => r.payment_status !== "paid");
    try {
      for (const r of pending) {
        const amount = r.final_price || r.estimated_price || 0;
        const commAmt = r.platform_commission != null ? r.platform_commission : +(amount * commissionPct / 100);
        const driverAmt = r.driver_earnings != null ? r.driver_earnings : +(amount - commAmt);
        await supabaseApi.rideRequests.update(r.id, {
            payment_status: "paid",
            driver_earnings: +driverAmt.toFixed(2),
            platform_commission: +commAmt.toFixed(2),
          });
      }
      queryClient.invalidateQueries({ queryKey: ["rides-completed"] });
      toast.success("Semana marcada como pagada");
    } catch (error) {
      toast.error("Error al marcar semana como pagada");
    }
    setMarking(false);
  };

  const exportCSV = () => {
    const weekStartFile = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(weekStart);

    const rows = [
      ["Folio", "Pasajero", "Origen", "Destino", "Fecha", "Método", "Precio", "Comisión", "Ganancia conductor", "Pagado"],
      ...weekRides.map(r => [
        r.service_id || r.id,
        r.passenger_name,
        r.pickup_address,
        r.dropoff_address,
        r.requested_at ? new Date(r.requested_at).toLocaleDateString("es-MX") : "",
        r.payment_method,
        r.final_price || r.estimated_price || 0,
        r.platform_commission || 0,
        r.driver_earnings || 0,
        r.payment_status === "paid" ? "Sí" : "No",
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liquidacion_${driver?.full_name?.replace(/\s+/g, "_") || "conductor"}_${weekStartFile}.csv`;
    a.click();
  };

  return (
    <Layout currentPageName="Liquidaciones">
      <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Liquidaciones</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">Conductor</label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar conductor" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">Semana</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setWeekOffset(w => w + 1)} className="w-8 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="flex-1 text-center text-sm font-medium text-slate-700 border rounded-lg h-9 flex items-center justify-center px-2">{weekLabel}</span>
                <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} className="w-8 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {selectedDriverId && (
        <>
          {weekRides.length === 0 ? (
            <Card><CardContent className="pt-5 text-center text-slate-400 py-10">Sin servicios en esta semana</CardContent></Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardContent className="pt-5">
                  <p className="text-sm text-slate-500">Servicios</p>
                  <p className="text-2xl font-bold">{weekRides.length}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-5">
                  <p className="text-sm text-slate-500">No efectivo (bruto)</p>
                  <p className="text-2xl font-bold text-blue-600">${summary.nonCashTotal.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">Com: ${summary.nonCashComm.toFixed(2)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-5">
                  <p className="text-sm text-slate-500">Efectivo cobrado</p>
                  <p className="text-2xl font-bold text-amber-600">${summary.cashTotal.toFixed(2)}</p>
                  <p className="text-xs text-red-500">Com a descontar: -${summary.cashComm.toFixed(2)}</p>
                </CardContent></Card>
                <Card className={`border-2 ${summary.balance >= 0 ? "border-emerald-200" : "border-red-200"}`}>
                  <CardContent className="pt-5">
                    <p className="text-sm text-slate-500">Balance final</p>
                    <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {summary.balance >= 0 ? `$${summary.balance.toFixed(2)}` : `-$${Math.abs(summary.balance).toFixed(2)}`}
                    </p>
                    <p className="text-xs text-slate-400">{summary.balance >= 0 ? "A pagar al conductor" : "Conductor deposita"}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Breakdown by method */}
              <Card>
                <CardHeader><CardTitle className="text-base">Desglose por método de pago</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(byMethod).map(([method, data]) => {
                      const isCash = method === "cash" || method.includes("efectivo");
                      return (
                        <div key={method} className={`flex items-center justify-between p-3 rounded-xl border ${isCash ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{isCash ? "💵" : "💳"} {method} ({data.count} servicios)</p>
                            <p className="text-xs text-slate-500">Total: ${data.total.toFixed(2)} · Comisión: ${data.comm.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            {isCash
                              ? <><p className="text-xs text-amber-700 font-medium">Conductor cobró: ${data.total.toFixed(2)}</p><p className="text-xs text-red-600 font-bold">Descontar comisión: -${data.comm.toFixed(2)}</p></>
                              : <><p className="text-xs text-blue-700 font-medium">Neto conductor: ${(data.total - data.comm).toFixed(2)}</p></>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600 space-y-1 bg-slate-50 rounded-xl p-3">
                    <p>💳 No efectivo neto: ${summary.nonCashNet.toFixed(2)}</p>
                    <p>💵 Comisión efectivo a descontar: -${summary.cashComm.toFixed(2)}</p>
                    <p className="font-bold text-slate-800">= Balance: {summary.balance >= 0 ? `Plataforma paga $${summary.balance.toFixed(2)}` : `Conductor deposita $${Math.abs(summary.balance).toFixed(2)}`}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                {allPaid ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">Semana liquidada</span>
                  </div>
                ) : (
                  <Button onClick={markAsPaid} disabled={marking} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> {marking ? "Procesando..." : "Marcar semana como pagada"}
                  </Button>
                )}
                <Button variant="outline" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-2" /> Exportar CSV
                </Button>
              </div>

              {/* Detail table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Servicios de {driver?.full_name} — {weekLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-slate-500 text-left">
                          <th className="pb-2 pr-4">Folio</th>
                          <th className="pb-2 pr-4">Pasajero</th>
                          <th className="pb-2 pr-4">Fecha</th>
                          <th className="pb-2 pr-4">Método</th>
                          <th className="pb-2 pr-4 text-right">Precio</th>
                          <th className="pb-2 pr-4 text-right">Comisión</th>
                          <th className="pb-2 text-right">Ganancia</th>
                          <th className="pb-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekRides.map(r => (
                          <tr key={r.id} className="border-b hover:bg-slate-50">
                            <td className="py-2 pr-4 font-mono text-xs">{r.service_id || r.id?.slice(0,8)}</td>
                            <td className="py-2 pr-4">{r.passenger_name}</td>
                            <td className="py-2 pr-4 text-slate-500">{r.requested_at ? new Date(r.requested_at).toLocaleDateString("es-MX") : "—"}</td>
                            <td className="py-2 pr-4 text-slate-500 capitalize">{r.payment_method || "—"}</td>
                            <td className="py-2 pr-4 text-right">${(r.final_price || r.estimated_price || 0).toFixed(2)}</td>
                            <td className="py-2 pr-4 text-right text-orange-600">${(r.platform_commission || 0).toFixed(2)}</td>
                            <td className="py-2 text-right font-semibold text-blue-600">${(r.driver_earnings || 0).toFixed(2)}</td>
                            <td className="py-2 text-center">
                              {r.payment_status === "paid"
                                ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Pagado</span>
                                : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pendiente</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
    </Layout>
  );
}
