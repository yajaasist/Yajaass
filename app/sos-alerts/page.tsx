"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

const statusConfig = {
  active: { label: "Activo", className: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  in_review: { label: "En revisión", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  resolved: { label: "Resuelto", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
};

export default function SosAlertsPage() {
  const [editingId, setEditingId] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["sosAlerts"],
    queryFn: async () => {
      try {
        return await supabaseApi.sosAlerts.list();
      } catch (error) {
        toast.error("Error al cargar alertas SOS");
        return [];
      }
    },
    staleTime: 5 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const active = alerts.filter((a: any) => a.status === "active");
  const others = alerts.filter((a: any) => a.status !== "active");

  const startEdit = (alert: any) => {
    setEditingId(alert.id);
    setEditNotes(alert.admin_notes || "");
    setEditStatus(alert.status);
  };

  const saveAlert = async (alertId: string) => {
    setSaving(true);
    try {
      await supabaseApi.sosAlerts.update(alertId, { admin_notes: editNotes, status: editStatus });
      queryClient.invalidateQueries({ queryKey: ["sosAlerts"] });
      setEditingId(null);
      toast.success("Alerta actualizada");
    } catch (error) {
      toast.error("Error al guardar alerta");
    } finally {
      setSaving(false);
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!window.confirm("¿Eliminar esta alerta permanentemente?")) return;
    try {
      await supabaseApi.sosAlerts.delete(alertId);
      queryClient.invalidateQueries({ queryKey: ["sosAlerts"] });
      toast.success("Alerta eliminada");
    } catch (error) {
      toast.error("Error al eliminar alerta");
    }
  };

  const SosCard = ({ alert }: { alert: any }) => {
    const cfg = statusConfig[alert.status as keyof typeof statusConfig] || statusConfig.active;
    const Icon = cfg.icon;
    const isEditing = editingId === alert.id;

    return (
      <div className={`rounded-2xl border-2 p-5 ${alert.status === "active" ? "border-red-300 bg-red-50" : "border-slate-100 bg-white"}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${alert.status === "active" ? "bg-red-500 animate-pulse" : "bg-slate-200"}`}>
              <Icon className={`w-5 h-5 ${alert.status === "active" ? "text-white" : "text-slate-500"}`} />
            </div>
            <div>
              <p className="font-bold text-slate-900">{alert.driver_name}</p>
              <p className="text-xs text-slate-400">—</p>
            </div>
          </div>
          <Badge className={cfg.className}>{cfg.label}</Badge>
        </div>

        {alert.message && (
          <p className="text-sm text-slate-700 bg-white rounded-xl p-3 mb-3 border border-slate-100">{alert.message}</p>
        )}

        {alert.latitude && (
          <a href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`} target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-3">
            📍 Ver ubicación en mapa
          </a>
        )}

        {isEditing ? (
          <div className="space-y-3 mt-3 border-t pt-3">
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">🔴 Activo</SelectItem>
                <SelectItem value="in_review">🟡 En revisión</SelectItem>
                <SelectItem value="resolved">🟢 Resuelto</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Notas del administrador..." value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="rounded-xl" />
            <div className="flex gap-2">
              <Button onClick={() => saveAlert(alert.id)} disabled={saving} size="sm" className="bg-slate-900 hover:bg-slate-800 rounded-xl">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="rounded-xl">Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            {alert.admin_notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-2">📋 {alert.admin_notes}</p>}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => startEdit(alert)} className="rounded-xl text-xs">Gestionar alerta</Button>
              {alert.status === "resolved" && (
                <Button variant="ghost" size="sm" onClick={() => deleteAlert(alert.id)} className="rounded-xl text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout currentPageName="SOSAlerts">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              Alertas SOS
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{alerts.length} alertas totales · {active.length} activas</p>
          </div>
          {active.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
              <span className="font-semibold text-sm">{active.length} alerta{active.length > 1 ? "s" : ""} activa{active.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {active.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">🚨 Alertas activas</h2>
            <div className="grid gap-4">
              {active.map((alert: any) => <SosCard key={alert.id} alert={alert} />)}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Historial</h2>
            <div className="grid gap-3">
              {others.map((alert: any) => <SosCard key={alert.id} alert={alert} />)}
            </div>
          </div>
        )}

        {alerts.length === 0 && (
          <div className="text-center py-20">
            <ShieldAlert className="w-14 h-14 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Sin alertas SOS</p>
            <p className="text-sm text-slate-400 mt-1">Las alertas de conductores aparecerán aquí</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
