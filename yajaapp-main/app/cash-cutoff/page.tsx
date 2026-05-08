"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from "react";
import Layout from "@/components/admin/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";

import moment from "moment";
import { nowCDMX, startOfDayCDMX, endOfDayCDMX } from "@/components/shared/dateUtils";
import { toast } from "sonner";

interface Ride {
  id: string;
  driver_id: string | null;
  driver_name: string | null;
  payment_method: string;
  driver_earnings: number;
  platform_commission: number;
  final_price: number | null;
  estimated_price: number | null;
  status: string;
  requested_at: string | null;
  created_date: string;
}

interface Driver {
  id: string;
  name: string;
  [key: string]: any;
}

interface Cutoff {
  id: string;
  cutoff_date: string;
  [key: string]: any;
}

interface DriverStats {
  driver_id: string;
  driver_name: string;
  cash: { count: number; earnings: number; commission: number };
  card: { count: number; earnings: number; commission: number };
  transfer: { count: number; earnings: number; commission: number };
  rides: Ride[];
}

export default function CashCutoffPage() {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState(moment().subtract(7, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [driverFilter, setDriverFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [showNewCutoff, setShowNewCutoff] = useState(false);
  const [cutoffNotes, setCutoffNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rides = [] } = useQuery({
    queryKey: ["rides"],
    queryFn: async () => {
      const data = await supabaseApi.rideRequests.list();
      return data.filter(r => r.status === 'completed');
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => supabaseApi.drivers.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: cutoffs = [] } = useQuery({
    queryKey: ["cashCutoffs"],
    queryFn: () => supabaseApi.cashCutoffs.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filteredRides = useMemo(() => rides.filter(r => {
    if (r.status !== "completed") return false;
    const d = moment(r.requested_at);
    return d.isSameOrAfter(dateFrom, "day") && d.isSameOrBefore(dateTo, "day");
  }), [rides, dateFrom, dateTo]);

  const driverStats = useMemo(() => {
    const map: Record<string, DriverStats> = {};
    filteredRides.forEach((r: Ride) => {
      const id = r.driver_id || "sin_asignar";
      const name = r.driver_name || "Sin conductor";
      if (!map[id]) {
        map[id] = {
          driver_id: id, 
          driver_name: name,
          cash: { count: 0, earnings: 0, commission: 0 },
          card: { count: 0, earnings: 0, commission: 0 },
          transfer: { count: 0, earnings: 0, commission: 0 },
          rides: [],
        };
      }
      const method = (["cash", "card", "transfer"].includes(r.payment_method) ? r.payment_method : "cash") as keyof Omit<DriverStats, "driver_id" | "driver_name" | "rides">;
      map[id][method].count++;
      map[id][method].earnings += r.driver_earnings || 0;
      map[id][method].commission += r.platform_commission || 0;
      map[id].rides.push(r);
    });
    return Object.values(map);
  }, [filteredRides]);

  const filtered = driverStats.filter((d: DriverStats) => {
    if (driverFilter !== "all" && d.driver_id !== driverFilter) return false;
    if (search && !d.driver_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCashCommission = filtered.reduce((s, d) => s + d.cash.commission, 0);
  const totalCardPay = filtered.reduce((s, d) => s + d.card.earnings + d.transfer.earnings, 0);
  const totalRides = filtered.reduce((s, d) => s + d.rides.length, 0);
  const totalRevenue = filteredRides.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);

  const exportCSV = () => {
    const headers = ["Conductor", "Método", "# Viajes", "Ganancia Conductor", "Comisión Plataforma", "Liquido a Pagar/Cobrar"];
    const rows = [];
    filtered.forEach(d => {
      if (d.cash.count > 0) rows.push([d.driver_name, "Efectivo", d.cash.count, d.cash.earnings.toFixed(2), d.cash.commission.toFixed(2), `COBRAR $${(d.cash.commission).toFixed(2)}`]);
      if (d.card.count > 0) rows.push([d.driver_name, "Tarjeta", d.card.count, d.card.earnings.toFixed(2), d.card.commission.toFixed(2), `PAGAR $${d.card.earnings.toFixed(2)}`]);
      if (d.transfer.count > 0) rows.push([d.driver_name, "Transferencia", d.transfer.count, d.transfer.earnings.toFixed(2), d.transfer.commission.toFixed(2), `PAGAR $${d.transfer.earnings.toFixed(2)}`]);
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `corte_caja_${dateFrom}_${dateTo}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleCreateCutoff = async () => {
    setSaving(true);
    const totalDriverPayouts = filteredRides.reduce((s, r) => s + (r.driver_earnings || 0), 0);
    const totalCommission = filteredRides.reduce((s, r) => s + (r.platform_commission || 0), 0);
    await supabaseApi.cashCutoffs.create({
      cutoff_date: nowCDMX(),
      period_start: startOfDayCDMX(dateFrom).toISOString(),
      period_end: endOfDayCDMX(dateTo).toISOString(),
      total_rides: filteredRides.length,
      total_revenue: totalRevenue,
      platform_commission: totalCommission,
      driver_payouts: totalDriverPayouts,
      notes: cutoffNotes,
      created_by_name: "Admin",
    });
    queryClient.invalidateQueries({ queryKey: ["cashCutoffs"] });
    setSaving(false);
    setShowNewCutoff(false);
    setCutoffNotes("");
    toast.success("Corte de caja registrado");
  };

  return (
    <Layout currentPageName="CashCutoff">
      {/* Aquí va el contenido completo de la página de caja, con filtros, KPIs, breakdown, historial y registro */}
      <div className="space-y-6">
        {/* ...contenido adaptado... */}
      </div>
    </Layout>
  );
}
