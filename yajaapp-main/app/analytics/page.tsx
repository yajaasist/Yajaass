"use client";
export const dynamic = 'force-dynamic';

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import Layout from "@/components/admin/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, MapPin, Users, Flame, Download, Map, Calendar, ChevronDown, X, Timer, AlertTriangle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { toast } from "sonner";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { startOfDayCDMX, endOfDayCDMX, todayCDMX } from "@/components/shared/dateUtils";

// ─── Leaflet.heat lazy loader ──────────────────────────────────────────────────
async function ensureHeat() {
  if (window.L?.heatLayer) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function HeatLayer({ points }) {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (!points || points.length === 0) return;
    ensureHeat().then(() => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      if (window.L?.heatLayer) {
        layerRef.current = window.L.heatLayer(points, {
          radius: 30, blur: 20, maxZoom: 17,
          gradient: { 0.2: "#3B82F6", 0.5: "#F59E0B", 0.8: "#EF4444", 1.0: "#7C3AED" },
        }).addTo(map);
      }
    });
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [points, map]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points?.length > 0) {
      try { map.fitBounds(L.latLngBounds(points.map(([lat, lng]) => [lat, lng])), { padding: [40, 40] }); } catch {}
    }
  }, [points?.length]);
  return null;
}

// ─── Date Range Picker ─────────────────────────────────────────────────────────
const PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "this_week", label: "Esta semana" },
  { key: "last_7", label: "Últimos 7 días" },
  { key: "this_month", label: "Este mes" },
  { key: "last_30", label: "Últimos 30 días" },
  { key: "all", label: "Todo" },
];

function dateStrOffset(days) {
  const todayStr = todayCDMX();
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function mondayOfWeek() {
  const todayStr = todayCDMX();
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(Date.UTC(y, m - 1, d + diffToMon));
  return mon.toISOString().slice(0, 10);
}

function firstOfMonth() {
  return todayCDMX().slice(0, 8) + "01";
}
function lastOfMonth() {
  const [y, m] = todayCDMX().split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
}

function getPresetRange(key) {
  switch (key) {
    case "today": return { from: startOfDayCDMX(todayCDMX()), to: endOfDayCDMX(todayCDMX()) };
    case "yesterday": { const y = dateStrOffset(-1); return { from: startOfDayCDMX(y), to: endOfDayCDMX(y) }; }
    case "this_week": { const mon = mondayOfWeek(); const sun = dateStrOffset(6 - getDayOfWeekOffset()); return { from: startOfDayCDMX(mon), to: endOfDayCDMX(sun) }; }
    case "last_7": return { from: startOfDayCDMX(dateStrOffset(-6)), to: endOfDayCDMX(todayCDMX()) };
    case "this_month": return { from: startOfDayCDMX(firstOfMonth()), to: endOfDayCDMX(lastOfMonth()) };
    case "last_30": return { from: startOfDayCDMX(dateStrOffset(-29)), to: endOfDayCDMX(todayCDMX()) };
    case "all": return null;
    default: return null;
  }
}

function getDayOfWeekOffset() {
  const [y, m, d] = todayCDMX().split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function DateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState("today");
  const [customRange, setCustomRange] = useState(undefined);
  const [mode, setMode] = useState("preset");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePreset = (key) => {
    setActivePreset(key);
    setMode("preset");
    onChange(getPresetRange(key));
    if (key !== "custom") setOpen(false);
  };

  const handleCustom = (range) => {
    setCustomRange(range);
    const toDateStr = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : null;
    if (range?.from && range?.to) {
      setMode("custom");
      setActivePreset(null);
      onChange({ from: startOfDayCDMX(toDateStr(range.from)), to: endOfDayCDMX(toDateStr(range.to)) });
    } else if (range?.from) {
      onChange({ from: startOfDayCDMX(toDateStr(range.from)), to: endOfDayCDMX(toDateStr(range.from)) });
    }
  };

  const label = useMemo(() => {
    if (mode === "custom" && customRange?.from) {
      if (customRange.to && customRange.from.toDateString() !== customRange.to.toDateString()) {
        return `${format(customRange.from, "dd MMM", { locale: es })} – ${format(customRange.to, "dd MMM", { locale: es })}`;
      }
      return format(customRange.from, "dd MMM yyyy", { locale: es });
    }
    return PRESETS.find(p => p.key === activePreset)?.label || "Seleccionar";
  }, [mode, activePreset, customRange]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
      >
        <Calendar className="w-4 h-4 text-slate-400" />
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-[800] flex flex-col sm:flex-row overflow-hidden min-w-[280px]">
          <div className="p-3 border-b sm:border-b-0 sm:border-r border-slate-100 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible sm:w-40">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 hidden sm:block">Períodos</p>
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                className={`flex-shrink-0 text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  activePreset === p.key && mode === "preset"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => { setMode("custom"); setActivePreset(null); }}
              className={`flex-shrink-0 text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                mode === "custom" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              📅 Personalizado
            </button>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {mode === "custom" ? "Selecciona un rango" : "Vista del período"}
            </p>
            <DayPicker
              mode="range"
              selected={mode === "custom" ? customRange : (() => {
                const r = getPresetRange(activePreset);
                return r ? { from: r.from, to: r.to } : undefined;
              })()}
              onSelect={mode === "custom" ? handleCustom : undefined}
              locale={es}
              weekStartsOn={1}
              showOutsideDays
              className="text-sm"
              modifiersClassNames={{
                selected: "bg-blue-600 text-white rounded-full",
                range_start: "bg-blue-600 text-white rounded-l-full",
                range_end: "bg-blue-600 text-white rounded-r-full",
                range_middle: "bg-blue-100 text-blue-700",
                today: "font-bold text-blue-600",
              }}
              styles={{ caption: { fontSize: "0.8rem" }, head_cell: { fontSize: "0.7rem" }, cell: { fontSize: "0.8rem" } }}
            />
            {mode === "custom" && customRange?.from && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  {customRange.to
                    ? `${format(customRange.from, "dd MMM", { locale: es })} – ${format(customRange.to, "dd MMM yyyy", { locale: es })}`
                    : format(customRange.from, "dd MMM yyyy", { locale: es })
                  }
                </span>
                <Button size="sm" className="h-7 text-xs rounded-lg" onClick={() => setOpen(false)}>Aplicar</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Analytics Page ───────────────────────────────────────────────────────
function AnalyticsContent() {
  const [globalRange, setGlobalRange] = useState(() => getPresetRange("today"));
  const [filterService, setFilterService] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");

  const { data: rides = [] } = useQuery({
    queryKey: ["analytics_rides"],
    queryFn: () => supabaseApi.rideRequests.list(),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["analytics_drivers"],
    queryFn: () => supabaseApi.drivers.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["analytics_service_types"],
    queryFn: () => supabaseApi.serviceTypes.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filteredRides = useMemo(() => {
    if (!globalRange) return rides;
    return rides.filter(r => {
      const d = new Date(r.requested_at);
      return d >= globalRange.from && d <= globalRange.to;
    });
  }, [rides, globalRange]);

  const demandByHour = useMemo(() => {
    const hourMap: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourMap[i] = 0;
    filteredRides.forEach(ride => {
      if (ride.requested_at) hourMap[new Date(ride.requested_at).getHours()]++;
    });
    return Object.entries(hourMap).map(([hour, count]) => ({
      hora: `${String(hour).padStart(2, "0")}:00`,
      servicios: count,
    }));
  }, [filteredRides]);

  const demandByZone = useMemo(() => {
    const zoneMap: Record<string, number> = {};
    filteredRides.forEach(ride => {
      const zone = ride.geo_zone_name || "Sin zona";
      zoneMap[zone] = (zoneMap[zone] || 0) + 1;
    });
    return Object.entries(zoneMap).map(([zone, count]) => ({ zone, servicios: count }))
      .sort((a, b) => b.servicios - a.servicios).slice(0, 8);
  }, [filteredRides]);

  const kpis = useMemo(() => {
    const avgRating = drivers.reduce((sum, d) => sum + (d.rating || 0), 0) / (drivers.length || 1);
    const completedRides = filteredRides.filter(r => r.status === "completed").length;
    const cancelledRides = filteredRides.filter(r => r.status === "cancelled").length;
    const totalRevenue = filteredRides.reduce((sum, r) => sum + (r.final_price || 0), 0);
    
    // Calculate driver payments (estimate: 70-80% of fare goes to driver)
    // Using a platform commission rate of 20% (80% to driver)
    const driverPayments = filteredRides.reduce((sum, r) => sum + (r.final_price || 0) * 0.80, 0);
    const netRevenue = totalRevenue - driverPayments;
    
    // Calculate average acceptance rate
    const avgAcceptance = drivers.length > 0 
      ? drivers.reduce((sum, d) => sum + (d.acceptance_rate || 100), 0) / drivers.length 
      : 100;
    
    return {
      avgRating: avgRating.toFixed(2),
      avgAcceptance: avgAcceptance.toFixed(1),
      totalDrivers: drivers.length,
      completedRides,
      cancelledRides,
      totalRevenue: totalRevenue.toFixed(2),
      netRevenue: netRevenue.toFixed(2),
      completionRate: ((completedRides / (completedRides + cancelledRides)) * 100 || 0).toFixed(1),
    };
  }, [filteredRides, drivers]);

  const funnelData = useMemo(() => {
    const requested = filteredRides.length;
    const assigned = filteredRides.filter((r) =>
      ["assigned", "admin_approved", "en_route", "arrived", "in_progress", "completed"].includes(r.status || "")
    ).length;
    const accepted = filteredRides.filter((r) => !!(r.driver_accepted_at || r.en_route_at || r.arrived_at || r.in_progress_at || r.completed_at)).length;
    const arrived = filteredRides.filter((r) => ["arrived", "in_progress", "completed"].includes(r.status || "")).length;
    const inProgress = filteredRides.filter((r) => ["in_progress", "completed"].includes(r.status || "")).length;
    const completed = filteredRides.filter((r) => r.status === "completed").length;

    const pct = (value: number) => (requested > 0 ? ((value / requested) * 100).toFixed(1) : "0.0");

    return [
      { etapa: "Solicitados", valor: requested, tasa: "100.0" },
      { etapa: "Asignados", valor: assigned, tasa: pct(assigned) },
      { etapa: "Aceptados", valor: accepted, tasa: pct(accepted) },
      { etapa: "Llegada", valor: arrived, tasa: pct(arrived) },
      { etapa: "En curso", valor: inProgress, tasa: pct(inProgress) },
      { etapa: "Completados", valor: completed, tasa: pct(completed) },
    ];
  }, [filteredRides]);

  const slaMetrics = useMemo(() => {
    const assignmentTimes: number[] = [];
    const arrivalTimes: number[] = [];

    filteredRides.forEach((r) => {
      const requestedAt = r.requested_at ? new Date(r.requested_at).getTime() : null;
      const acceptedAtRaw = r.driver_accepted_at || r.en_route_at;
      const acceptedAt = acceptedAtRaw ? new Date(acceptedAtRaw).getTime() : null;
      const arrivedAt = r.arrived_at ? new Date(r.arrived_at).getTime() : null;

      if (requestedAt && acceptedAt && acceptedAt >= requestedAt) {
        assignmentTimes.push((acceptedAt - requestedAt) / 60000);
      }
      if (acceptedAt && arrivedAt && arrivedAt >= acceptedAt) {
        arrivalTimes.push((arrivedAt - acceptedAt) / 60000);
      }
    });

    const p50 = (arr: number[]) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    const assignP50 = p50(assignmentTimes);
    const arrivalP50 = p50(arrivalTimes);
    const assignOnTimePct = assignmentTimes.length
      ? (assignmentTimes.filter((m) => m <= 10).length / assignmentTimes.length) * 100
      : 0;
    const arrivalOnTimePct = arrivalTimes.length
      ? (arrivalTimes.filter((m) => m <= 20).length / arrivalTimes.length) * 100
      : 0;

    return {
      assignP50: assignP50.toFixed(1),
      arrivalP50: arrivalP50.toFixed(1),
      assignOnTimePct: assignOnTimePct.toFixed(1),
      arrivalOnTimePct: arrivalOnTimePct.toFixed(1),
      samplesAssign: assignmentTimes.length,
      samplesArrival: arrivalTimes.length,
    };
  }, [filteredRides]);

  const cancellationBreakdown = useMemo(() => {
    const byActor: Record<string, number> = { passenger: 0, driver: 0, admin: 0, other: 0 };
    const reasonMap: Record<string, number> = {};

    filteredRides.filter((r) => r.status === "cancelled").forEach((r) => {
      const actor = r.cancelled_by === "passenger" || r.cancelled_by === "driver" || r.cancelled_by === "admin"
        ? r.cancelled_by
        : "other";
      byActor[actor] += 1;
      const reason = (r.cancellation_reason || "Sin motivo").trim();
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    });

    const actorData = [
      { name: "Pasajero", value: byActor.passenger },
      { name: "Conductor", value: byActor.driver },
      { name: "Admin", value: byActor.admin },
      { name: "Otro", value: byActor.other },
    ];
    const topReasons = Object.entries(reasonMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { actorData, topReasons };
  }, [filteredRides]);

  const retentionSnapshot = useMemo(() => {
    const now = Date.now();
    const rangeStart = globalRange?.from?.getTime() ?? (now - 30 * 24 * 60 * 60 * 1000);
    const lookbackMs = 60 * 24 * 60 * 60 * 1000;

    const ridesByPassenger: Record<string, any[]> = {};
    rides.forEach((r) => {
      const key = r.passenger_user_id || r.passenger_phone;
      if (!key || !r.requested_at) return;
      if (!ridesByPassenger[key]) ridesByPassenger[key] = [];
      ridesByPassenger[key].push(r);
    });

    let nuevos = 0;
    let recurrentes = 0;
    let reactivados = 0;

    Object.values(ridesByPassenger).forEach((prides) => {
      const sorted = prides
        .filter((r) => r.requested_at)
        .sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime());
      if (!sorted.length) return;

      const hasInRange = sorted.some((r) => {
        const t = new Date(r.requested_at).getTime();
        return t >= rangeStart;
      });
      if (!hasInRange) return;

      const firstRideTs = new Date(sorted[0].requested_at).getTime();
      const hadBeforeRange = sorted.some((r) => new Date(r.requested_at).getTime() < rangeStart);
      const hadRecentBeforeRange = sorted.some((r) => {
        const t = new Date(r.requested_at).getTime();
        return t < rangeStart && t >= rangeStart - lookbackMs;
      });

      if (firstRideTs >= rangeStart) {
        nuevos += 1;
      } else if (hadRecentBeforeRange) {
        recurrentes += 1;
      } else if (hadBeforeRange) {
        reactivados += 1;
      }
    });

    const totalActivos = nuevos + recurrentes + reactivados;
    const pct = (n: number) => (totalActivos ? ((n / totalActivos) * 100).toFixed(1) : "0.0");
    return {
      nuevos,
      recurrentes,
      reactivados,
      totalActivos,
      nuevosPct: pct(nuevos),
      recurrentesPct: pct(recurrentes),
      reactivadosPct: pct(reactivados),
    };
  }, [rides, globalRange]);

  const actionInsights = useMemo(() => {
    const insights: string[] = [];
    const assigned = funnelData[1]?.valor || 0;
    const requested = funnelData[0]?.valor || 0;
    const assignRate = requested ? (assigned / requested) * 100 : 0;
    const cancellationRate = requested ? ((kpis.cancelledRides / requested) * 100) : 0;

    if (assignRate < 85) {
      insights.push("Baja cobertura de asignación. Recomendación: activar subasta por zonas críticas y revisar conductores disponibles por franja.");
    }
    if (Number(slaMetrics.assignOnTimePct) < 70) {
      insights.push("SLA de asignación por debajo de objetivo. Recomendación: aumentar prioridad de despacho en picos y ajustar radio de búsqueda.");
    }
    if (Number(slaMetrics.arrivalOnTimePct) < 70) {
      insights.push("SLA de llegada bajo. Recomendación: revisar tiempos ETA por zona y priorizar conductores cercanos con mejor aceptación.");
    }
    if (cancellationRate > 20) {
      insights.push("Cancelación elevada. Recomendación: auditar top motivos de cancelación y aplicar política específica por actor.");
    }
    if (retentionSnapshot.totalActivos > 0 && Number(retentionSnapshot.recurrentesPct) < 50) {
      insights.push("Retención recurrente baja. Recomendación: campaña de recompra para pasajeros de los últimos 30-60 días.");
    }

    if (!insights.length) {
      insights.push("Operación estable en el período. Recomendación: mantener monitoreo de SLA y escalar acciones solo en horas pico.");
    }

    return insights;
  }, [funnelData, kpis.cancelledRides, slaMetrics.assignOnTimePct, slaMetrics.arrivalOnTimePct, retentionSnapshot.totalActivos, retentionSnapshot.recurrentesPct]);

  const [ratingDriverFilter, setRatingDriverFilter] = useState("all");

  const filteredDriversForRating = useMemo(() => {
    if (ratingDriverFilter === "all") return drivers;
    return drivers.filter(d => d.id === ratingDriverFilter);
  }, [drivers, ratingDriverFilter]);

  const ratingDistribution = useMemo(() => [
    { rating: "5⭐", count: filteredDriversForRating.filter(d => d.rating >= 4.8).length },
    { rating: "4-4.9⭐", count: filteredDriversForRating.filter(d => d.rating >= 4 && d.rating < 4.8).length },
    { rating: "3-3.9⭐", count: filteredDriversForRating.filter(d => d.rating >= 3 && d.rating < 4).length },
    { rating: "<3⭐", count: filteredDriversForRating.filter(d => d.rating < 3 && d.rating > 0).length },
  ], [filteredDriversForRating]);

  const companies = useMemo(() => {
    const map: Record<string, string> = {};
    rides.forEach(r => { if (r.company_id && r.company_name) map[r.company_id] = r.company_name; });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [rides]);

  const heatPoints = useMemo(() => {
    let filtered = filteredRides.filter(r => r.pickup_lat && r.pickup_lon);
    if (filterService !== "all") filtered = filtered.filter(r => r.service_type_id === filterService);
    if (filterCompany === "general") filtered = filtered.filter(r => !r.company_id);
    else if (filterCompany !== "all") filtered = filtered.filter(r => r.company_id === filterCompany);
    return filtered.map(r => [r.pickup_lat, r.pickup_lon, 1] as [number, number, number]);
  }, [filteredRides, filterService, filterCompany]);

  const revenueByServiceType = useMemo(() => {
    const typeMap: Record<string, number> = {};
    filteredRides.forEach(ride => {
      const typeName = ride.service_type_name || "Sin categoría";
      if (!typeMap[typeName]) typeMap[typeName] = 0;
      typeMap[typeName] += ride.final_price || 0;
    });
    return Object.entries(typeMap)
      .map(([name, revenue]) => ({ name, revenue: parseFloat(revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredRides]);

  const topDrivers = useMemo(() => {
    const driverStats: Record<string, { id: string; name: string; rides: number; earnings: number; rating: number; acceptance_rate: number }> = {};
    filteredRides.filter(r => r.status === "completed").forEach(ride => {
      if (!ride.driver_id) return;
      if (!driverStats[ride.driver_id]) {
        const driver = drivers.find(d => d.id === ride.driver_id);
        driverStats[ride.driver_id] = {
          id: ride.driver_id,
          name: driver?.full_name || "Desconocido",
          rides: 0,
          earnings: 0,
          rating: driver?.rating || 0,
          acceptance_rate: driver?.acceptance_rate || 100,
        };
      }
      driverStats[ride.driver_id].rides += 1;
      driverStats[ride.driver_id].earnings += ride.driver_earnings || (ride.final_price || 0) * 0.8;
    });
    return Object.values(driverStats)
      .sort((a, b) => b.rides - a.rides)
      .slice(0, 10);
  }, [filteredRides, drivers]);

  const heatCenter: LatLngTuple = heatPoints.length > 0 ? [heatPoints[0][0], heatPoints[0][1]] : [19.4326, -99.1332];

  const handleDownloadMap = async () => {
    try {
      const mapEl = document.getElementById("heatmap-capture");
      if (!mapEl) return;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true });
      const link = document.createElement("a");
      link.download = `mapa-calor-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Mapa descargado");
    } catch { toast.error("No se pudo descargar el mapa"); }
  };

  const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analíticas</h1>
          <p className="text-slate-500 mt-1">
            {filteredRides.length} servicios en el período · {rides.length} totales históricos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter value={globalRange} onChange={setGlobalRange} />
          {globalRange && (
            <button
              onClick={() => setGlobalRange(null)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Ver todo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Rating Promedio", value: kpis.avgRating, sub: `de ${kpis.totalDrivers} conductores`, color: "text-slate-900" },
          { label: "Aceptación", value: `${kpis.avgAcceptance}%`, sub: "promedio conductores", color: "text-emerald-600" },
          { label: "Viajes Completados", value: kpis.completedRides, sub: `${kpis.completionRate}% tasa`, color: "text-emerald-600" },
          { label: "Cancelados", value: kpis.cancelledRides, sub: "en el período", color: "text-red-600" },
          { label: "Ingresos Brutos", value: `$${kpis.totalRevenue}`, sub: "MXN", color: "text-slate-900" },
          { label: "Ingreso Neto", value: `$${kpis.netRevenue}`, sub: "ganancia plataforma", color: "text-blue-600" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-6 text-center">
              <p className="text-slate-500 text-sm mb-2">{k.label}</p>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-2">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Embudo Operativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="etapa" fontSize={12} />
                <YAxis />
                <Tooltip formatter={(v, name, item) => [v, `${item?.payload?.tasa || "0.0"}% del total`]} />
                <Bar dataKey="valor" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {funnelData.slice(1).map((s) => (
                <div key={s.etapa} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-slate-500">{s.etapa}</p>
                  <p className="text-sm font-bold text-slate-900">{s.tasa}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-emerald-600" />
              SLA Operativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-50">
              <p className="text-xs text-emerald-700">Asignación p50</p>
              <p className="text-2xl font-black text-emerald-700">{slaMetrics.assignP50} min</p>
              <p className="text-[11px] text-emerald-600">{slaMetrics.assignOnTimePct}% dentro de 10 min</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <p className="text-xs text-blue-700">Llegada p50</p>
              <p className="text-2xl font-black text-blue-700">{slaMetrics.arrivalP50} min</p>
              <p className="text-[11px] text-blue-600">{slaMetrics.arrivalOnTimePct}% dentro de 20 min</p>
            </div>
            <div className="text-[11px] text-slate-400">
              Muestras: {slaMetrics.samplesAssign} asignaciones · {slaMetrics.samplesArrival} llegadas
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600" />
              Retención de Pasajeros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Nuevos", value: retentionSnapshot.nuevos, pct: retentionSnapshot.nuevosPct, color: "text-blue-600" },
              { label: "Recurrentes", value: retentionSnapshot.recurrentes, pct: retentionSnapshot.recurrentesPct, color: "text-emerald-600" },
              { label: "Reactivados", value: retentionSnapshot.reactivados, pct: retentionSnapshot.reactivadosPct, color: "text-amber-600" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs text-slate-500">{row.label}</p>
                  <p className={`text-xl font-black ${row.color}`}>{row.value}</p>
                </div>
                <span className="text-xs text-slate-500">{row.pct}%</span>
              </div>
            ))}
            <p className="text-[11px] text-slate-400 pt-1">Activos en período: {retentionSnapshot.totalActivos}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Cancelaciones por Actor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={cancellationBreakdown.actorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                  {["#ef4444", "#f59e0b", "#3b82f6", "#94a3b8"].map((color, idx) => <Cell key={idx} fill={color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {cancellationBreakdown.topReasons.map((r) => (
                <div key={r.reason} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 truncate pr-2">{r.reason}</span>
                  <span className="font-bold text-slate-900">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Acciones Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actionInsights.map((insight, idx) => (
              <div key={idx} className="text-xs text-slate-700 bg-orange-50 border border-orange-100 rounded-lg p-2.5">
                {insight}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Ingresos por Tipo de Servicio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByServiceType.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-12">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={revenueByServiceType} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {COLORS.map((color, idx) => <Cell key={idx} fill={color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(0)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Top 10 Conductores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDrivers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-12">Sin datos</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {topDrivers.map((driver, idx) => (
                  <div key={driver.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-400 w-6 text-center">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">{driver.name}</p>
                        <p className="text-[10px] text-slate-400">{driver.rides} viajes</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-600">${driver.earnings.toFixed(0)}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className="text-[10px] text-amber-600">⭐ {driver.rating.toFixed(1)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${driver.acceptance_rate >= 80 ? "bg-emerald-100 text-emerald-700" : driver.acceptance_rate >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {driver.acceptance_rate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Demanda de Servicios por Hora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={demandByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="servicios" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Zonas Geográficas Más Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={demandByZone} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="zone" width={100} fontSize={11} />
                <Tooltip />
                <Bar dataKey="servicios" fill="#10B981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Mapa de Calor — Concentración de Servicios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative z-[600] flex flex-wrap gap-3 items-end bg-white pb-1">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Tipo de servicio:</span>
              <Select value={filterService} onValueChange={setFilterService}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Todos los servicios" />
                </SelectTrigger>
                <SelectContent className="z-[700]">
                  <SelectItem value="all">Todos los servicios</SelectItem>
                  {serviceTypes.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name || "Sin nombre"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Empresa / Tipo:</span>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="z-[700]">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="general">🚶 Generales (sin empresa)</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>🏢 {c.name || "Sin nombre"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
                {heatPoints.length} servicios con GPS
              </span>
              <Button size="sm" variant="outline" onClick={handleDownloadMap} className="h-8 text-xs gap-1.5 rounded-lg">
                <Download className="w-3.5 h-3.5" /> Descargar PNG
              </Button>
            </div>
          </div>

          <div id="heatmap-capture" className="relative z-0 rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 460 }}>
            {heatPoints.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50 gap-3">
                <Map className="w-10 h-10 text-slate-300" />
                <p className="text-sm text-slate-400">No hay servicios con coordenadas GPS para los filtros seleccionados</p>
              </div>
            ) : (
              <MapContainer center={heatCenter} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                <HeatLayer points={heatPoints} />
                <FitBounds points={heatPoints} />
              </MapContainer>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-500 px-1">
            <span className="font-medium text-slate-600">Intensidad:</span>
            {[
              { color: "bg-blue-500", label: "Baja" },
              { color: "bg-amber-400", label: "Media" },
              { color: "bg-red-500", label: "Alta" },
              { color: "bg-purple-600", label: "Muy alta" },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-full ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Distribución de Ratings de Conductores
              </CardTitle>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Filtrar por conductor:</span>
                <Select value={ratingDriverFilter} onValueChange={setRatingDriverFilter}>
                  <SelectTrigger className="h-8 w-52 text-xs">
                    <SelectValue placeholder="Todos los conductores" />
                  </SelectTrigger>
                  <SelectContent className="z-[700]">
                    <SelectItem value="all">Todos los conductores</SelectItem>
                    {drivers
                      .slice()
                      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
                      .map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name} {d.rating > 0 ? `· ⭐ ${Number(d.rating).toFixed(1)}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ratingDriverFilter !== "all" ? (() => {
              const driver = drivers.find(d => d.id === ratingDriverFilter);
              if (!driver) return null;
              return (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
                    <span className="text-2xl font-black text-purple-600">{driver.full_name?.charAt(0)}</span>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-900 text-lg">{driver.full_name || "Desconocido"}</p>
                    <p className="text-slate-500 text-sm">{driver.phone || driver.email || ""}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
                    <span className="text-4xl font-black text-amber-500">{driver.rating > 0 ? Number(driver.rating).toFixed(1) : "—"}</span>
                    <div>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-xl ${s <= Math.round(driver.rating) ? "text-amber-400" : "text-slate-200"}`}>★</span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{driver.total_rides || 0} viajes completados</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {[
                      { label: "Viajes totales", value: driver.total_rides || 0, color: "text-blue-600" },
                      { label: "Estado", value: driver.status === "available" ? "Disponible" : driver.status === "busy" ? "Ocupado" : "Inactivo", color: driver.status === "available" ? "text-emerald-600" : driver.status === "busy" ? "text-amber-600" : "text-slate-400" },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={ratingDistribution} dataKey="count" nameKey="rating" cx="50%" cy="50%" outerRadius={100} label>
                    {COLORS.map((color, idx) => <Cell key={idx} fill={color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Desempeño Promedio de Conductores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Rating Promedio", value: `${kpis.avgRating}⭐`, bg: "bg-slate-50", color: "text-slate-900" },
              { label: "Tasa de Finalización", value: `${kpis.completionRate}%`, bg: "bg-emerald-50", color: "text-emerald-600" },
              { label: "Total de Conductores", value: kpis.totalDrivers, bg: "bg-blue-50", color: "text-blue-600" },
              { label: "Viajes Completados", value: kpis.completedRides, bg: "bg-purple-50", color: "text-purple-600" },
            ].map(item => (
              <div key={item.label} className={`flex justify-between items-center p-3 ${item.bg} rounded-lg`}>
                <span className="text-slate-600 font-medium">{item.label}</span>
                <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Layout currentPageName="Analytics">
      <AnalyticsContent />
    </Layout>
  );
}
