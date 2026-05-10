"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, AlertTriangle, TrendingDown, Users, AlertCircle } from "lucide-react";
import Layout from "@/components/admin/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabaseApi } from "@/lib/supabaseApi";

interface RejectionStats {
  total_drivers: number;
  high_rejection_rate: any[];
  total_rejections: number;
  rejection_distribution: Record<string, number>;
}

const rejectReasonLabels: Record<string, { label: string; emoji: string; color: string }> = {
  too_far: { label: "Muy lejos", emoji: "📍", color: "bg-blue-50" },
  wrong_direction: { label: "Dirección incorrecta", emoji: "🔄", color: "bg-purple-50" },
  low_pay: { label: "Pago bajo", emoji: "💰", color: "bg-orange-50" },
  personal: { label: "Personal", emoji: "👤", color: "bg-yellow-50" },
  other: { label: "Otro", emoji: "❓", color: "bg-gray-50" },
};

export default function RejectionAnalysis() {
  const [stats, setStats] = useState<RejectionStats | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch settings
        const settingsData = await supabaseApi.settings.list();
        setSettings(settingsData[0]);

        // Fetch all drivers with rejection info
        const drivers = await supabaseApi.drivers.list();

        // Calculate stats
        const total_drivers = drivers.length;
        const rejectionRateThreshold = settingsData[0]?.rejection_rate_warning_threshold ?? 60;
        
        // Drivers with high rejection rate
        const high_rejection_rate = drivers.filter((driver) => {
          const total = (driver.rejection_count || 0) + (driver.accepted_offers_count || 0);
          if (total === 0) return false;
          const rate = ((driver.rejection_count || 0) / total) * 100;
          return rate >= rejectionRateThreshold;
        });

        // Total rejections
        const total_rejections = drivers.reduce((acc, d) => acc + (d.rejection_count || 0), 0);

        // Distribution of rejection reasons
        const distribution: Record<string, number> = {
          too_far: 0,
          wrong_direction: 0,
          low_pay: 0,
          personal: 0,
          other: 0,
        };

        // Simple estimation - we'd need a rejections table for exact counts
        // For now, we'll show drivers grouped by their last rejection reason
        drivers.forEach((driver) => {
          if (driver.last_rejection_reason && distribution.hasOwnProperty(driver.last_rejection_reason)) {
            distribution[driver.last_rejection_reason]++;
          }
        });

        setStats({ total_drivers, high_rejection_rate, total_rejections, rejection_distribution: distribution });
      } catch (error) {
        console.error("Error fetching rejection data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Layout currentPageName="RejectionAnalysis">
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">Cargando datos de rechazo...</p>
        </div>
      </Layout>
    );
  }

  const totalOffered = stats?.high_rejection_rate.reduce((acc, d) => acc + ((d.rejection_count || 0) + (d.accepted_offers_count || 0)), 0) || 0;
  const overallRejectionRate = totalOffered > 0 ? ((stats?.total_rejections || 0) / totalOffered) * 100 : 0;

  return (
    <Layout currentPageName="RejectionAnalysis">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/drivers" className="text-slate-500 hover:text-slate-700 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Análisis de Rechazos</h1>
              <p className="text-sm text-slate-500 mt-1">Monitorea razones de rechazo y conductores de bajo desempeño</p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-6 border-0 shadow-sm bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Conductores</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.total_drivers || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-50">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tasa Rechazo Global</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{Math.round(overallRejectionRate)}%</p>
                </div>
                <div className={`p-3 rounded-full ${overallRejectionRate > 30 ? "bg-red-50" : "bg-green-50"}`}>
                  <TrendingDown className={`w-5 h-5 ${overallRejectionRate > 30 ? "text-red-600" : "text-green-600"}`} />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Rechazos</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.total_rejections || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-orange-50">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Con Alto Rechazo</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.high_rejection_rate.length || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {stats?.total_drivers ? `${Math.round((stats.high_rejection_rate.length / stats.total_drivers) * 100)}%` : "0%"}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-red-50">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Distribution Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="p-6 border-0 shadow-sm bg-white">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Distribución de Razones</h2>
              <div className="space-y-3">
                {Object.entries(rejectReasonLabels).map(([key, { label, emoji, color }]) => {
                  const count = stats?.rejection_distribution[key] || 0;
                  const percentage = stats?.total_rejections ? (count / stats.total_rejections) * 100 : 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          {emoji} {label}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{count}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`${color} h-2 rounded-full transition-all`}
                          style={{ width: `${percentage > 0 ? Math.max(percentage, 5) : 0}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-400 text-right mt-0.5">{Math.round(percentage)}%</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Settings Info */}
            <Card className="p-6 border-0 shadow-sm bg-white">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Configuración Activa</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">Umbral de Alerta</p>
                    <p className="text-slate-600 mt-0.5">
                      {settings?.rejection_rate_warning_threshold || 60}% de rechazo
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">Penalizaciones Activas</p>
                    <p className="text-slate-600 mt-0.5">
                      {settings?.soft_block_low_acceptance_rate_enabled ? "✓ Habilitadas" : "✗ Deshabilitadas"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                  <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">Tasa Mínima Para Penalizar</p>
                    <p className="text-slate-600 mt-0.5">
                      {settings?.low_acceptance_rate_threshold || 60}%
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* High Rejection Drivers */}
          {stats?.high_rejection_rate && stats.high_rejection_rate.length > 0 && (
            <Card className="p-6 border-0 shadow-sm bg-white">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                ⚠️ Conductores con Alta Tasa de Rechazo ({stats.high_rejection_rate.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Conductor</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Rechazos</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Aceptados</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Tasa Aceptación</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Última Razón</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.high_rejection_rate.map((driver) => {
                      const total = (driver.rejection_count || 0) + (driver.accepted_offers_count || 0);
                      const rate = total > 0 ? ((driver.accepted_offers_count || 0) / total) * 100 : 0;
                      const lastReason = driver.last_rejection_reason as keyof typeof rejectReasonLabels;
                      const reasonInfo = lastReason && rejectReasonLabels[lastReason];

                      return (
                        <tr key={driver.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              href={`/drivers?driver_id=${driver.id}`}
                              className="font-medium text-blue-600 hover:text-blue-700"
                            >
                              {driver.full_name}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className="bg-red-100 text-red-800">{driver.rejection_count || 0}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className="bg-green-100 text-green-800">{driver.accepted_offers_count || 0}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={rate >= 80 ? "bg-green-100 text-green-800" : rate >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                              {Math.round(rate)}%
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {reasonInfo ? (
                              <Badge className={`${reasonInfo.color}`}>
                                {reasonInfo.emoji} {reasonInfo.label}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!stats?.high_rejection_rate || stats.high_rejection_rate.length === 0 && (
            <Card className="p-12 border-0 shadow-sm bg-white text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-full bg-green-50">
                  <AlertTriangle className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-slate-600 font-medium">No hay conductores con alta tasa de rechazo</p>
                <p className="text-sm text-slate-400">Todos los conductores están dentro de los umbrales aceptables</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
