"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/admin/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { formatCDMX, todayCDMX, startOfDayCDMX, endOfDayCDMX } from "@/components/shared/dateUtils";
import { TrendingUp, DollarSign, Car, Receipt } from "lucide-react";

const COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];

export default function Earnings() {
  const [filterMode, setFilterMode] = useState("days");
  const [daysCount, setDaysCount] = useState(1);
  const [dateFrom, setDateFrom] = useState(() => todayCDMX());
  const [dateTo, setDateTo] = useState(() => todayCDMX());
  const [ivaPct, setIvaPct] = useState(16);
  const [isrPct, setIsrPct] = useState(10);
  const [driverFilter, setDriverFilter] = useState("all");

  const { data: rides = [] } = useQuery({
    queryKey: ["rides"],
    queryFn: () => supabaseApi.rideRequests.list(),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => supabaseApi.drivers.list(),
  });

  const since = filterMode === "days"
    ? new Date(startOfDayCDMX(todayCDMX()).getTime() - Math.max(1, daysCount) * 24 * 60 * 60 * 1000)
    : startOfDayCDMX(dateFrom);
  const until = filterMode === "range" ? endOfDayCDMX(dateTo) : null;
  const filtered = rides.filter(r => {
    if (r.status !== "completed") return false;
    const d = new Date(r.requested_at || "");
    if (Number.isNaN(d.getTime())) return false;
    if (d <= since) return false;
    if (until && d > until) return false;
    return true;
  });

  // Daily earnings (admin sees full price)
  const dailyMap: Record<string, number> = {};
  filtered.forEach(r => {
    const day = formatCDMX(r.requested_at, "daymonth");
    dailyMap[day] = (dailyMap[day] || 0) + (r.final_price || r.estimated_price || 0);
  });
  const dailyData = Object.entries(dailyMap)
    .slice(-14)
    .map(([date, total]) => ({ date, total: parseFloat(total.toFixed(0)) }));

  // By service
  const serviceMap: Record<string, { name: string; total: number; count: number }> = {};
  filtered.forEach(r => {
    const s = r.service_type_name || "Sin servicio";
    if (!serviceMap[s]) serviceMap[s] = { name: s, total: 0, count: 0 };
    serviceMap[s].total += (r.final_price || r.estimated_price || 0);
    serviceMap[s].count += 1;
  });
  const serviceData = Object.values(serviceMap);

  // By payment method
  const payMap: Record<string, number> = {};
  filtered.forEach(r => {
    const m = r.payment_method || "cash";
    payMap[m] = (payMap[m] || 0) + (r.final_price || r.estimated_price || 0);
  });
  const payLabels = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
  const payData = Object.entries(payMap).map(([k, v]) => ({ name: payLabels[k] || k, value: parseFloat(v.toFixed(0)) }));

  // By driver — filterable
  const driverFilteredRides = driverFilter === "all" ? filtered : filtered.filter(r => r.driver_name === driverFilter);
  const driverMap: Record<string, { name: string; total: number; driverPay: number; commission: number; net: number; count: number }> = {};
  filtered.forEach(r => {
    const d = r.driver_name || "Sin asignar";
    if (!driverMap[d]) driverMap[d] = { name: d, total: 0, driverPay: 0, commission: 0, net: 0, count: 0 };
    const price = r.final_price || r.estimated_price || 0;
    const driverPay = r.driver_earnings || 0;
    const commission = r.platform_commission || 0;
    driverMap[d].total += price;
    driverMap[d].driverPay += driverPay;
    driverMap[d].commission += commission;
    driverMap[d].net += commission; // platform net = commission
    driverMap[d].count += 1;
  });
  const driverData = Object.values(driverMap).sort((a, b) => b.total - a.total).slice(0, 5);
  const allDriverNames = [...new Set(filtered.map(r => r.driver_name).filter(Boolean))];

  const totalRevenue = driverFilteredRides.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);
  const totalDriverPay = driverFilteredRides.reduce((s, r) => s + (r.driver_earnings || 0), 0);
  const totalCommission = driverFilteredRides.reduce((s, r) => s + (r.platform_commission || 0), 0);
  const platformNetRevenue = totalCommission; // platform net = total commissions
  const avgRide = driverFilteredRides.length ? totalRevenue / driverFilteredRides.length : 0;
  const cancelledCount = rides.filter(r => {
    if (r.status !== "cancelled") return false;
    const d = new Date(r.requested_at || "");
    if (Number.isNaN(d.getTime())) return false;
    if (d <= since) return false;
    if (until && d > until) return false;
    return true;
  }).length;

  // Fiscal calculations on platform commission
  const ivaAmount = totalCommission * (ivaPct / 100);
  const isrAmount = totalCommission * (isrPct / 100);
  const netAfterTax = totalCommission - ivaAmount - isrAmount;

  return (
    <Layout currentPageName="Earnings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ingresos de la plataforma</h1>
          <p className="text-sm text-slate-400 mt-0.5">Análisis de ganancia por comisiones</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Período</Label>
            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="rounded-xl text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Últimos N días</SelectItem>
                <SelectItem value="range">Rango de fechas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterMode === "days" && (
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Días</Label>
              <Input type="number" value={daysCount} onChange={(e) => setDaysCount(parseInt(e.target.value) || 1)} className="rounded-xl text-sm h-9" min={1} max={365} />
            </div>
          )}
          {filterMode === "range" && (
            <>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Desde</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl text-sm h-9" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Hasta</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl text-sm h-9" />
              </div>
            </>
          )}

          <div>
            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Conductor</Label>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="rounded-xl text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {allDriverNames.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Ingresos totales", value: `$${totalRevenue.toFixed(0)}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Comisiones plataforma", value: `$${totalCommission.toFixed(0)}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Viajes completados", value: driverFilteredRides.length, icon: Car, color: "text-violet-600", bg: "bg-violet-50" },
            { label: "Promedio por viaje", value: `$${avgRide.toFixed(0)}`, icon: Receipt, color: "text-orange-600", bg: "bg-orange-50" },
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <Card key={i} className="border-0 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{kpi.label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <div className={`${kpi.bg} ${kpi.color} p-2.5 rounded-xl`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Charts */}
        {dailyData.length > 0 && (
          <Card className="border-0 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Ingresos diarios (últimos 14 días)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => `$${v}`} />
                <Bar dataKey="total" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {serviceData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Por tipo de servicio</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={serviceData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {serviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${v}`} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="border-0 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Por método de pago</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={payData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {payData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${v}`} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Fiscal section */}
        <Card className="border-0 shadow-sm p-6 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Cálculo fiscal (sobre comisiones)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-xs text-slate-400 uppercase tracking-wide">IVA ({ivaPct}%)</p>
              <p className="text-xl font-bold text-slate-900 mt-1">${ivaAmount.toFixed(0)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-xs text-slate-400 uppercase tracking-wide">ISR ({isrPct}%)</p>
              <p className="text-xl font-bold text-slate-900 mt-1">${isrAmount.toFixed(0)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Neto después de impuestos</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">${netAfterTax.toFixed(0)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">% IVA</Label>
              <Input type="number" value={ivaPct} onChange={(e) => setIvaPct(parseInt(e.target.value) || 16)} className="rounded-xl text-sm h-9" min={0} max={100} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">% ISR</Label>
              <Input type="number" value={isrPct} onChange={(e) => setIsrPct(parseInt(e.target.value) || 10)} className="rounded-xl text-sm h-9" min={0} max={100} />
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
