"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import Layout from "@/components/admin/Layout";
import { stopAllAlarms } from "@/components/shared/useRideNotifications";
import { Bell, Send, Users, Filter, CheckCircle2, Clock, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function NotificacionesContent() {
  const qc = useQueryClient();

  // Stop any ride alarms when this page is open (admin is broadcasting, not monitoring rides)
  useEffect(() => {
    stopAllAlarms();
  }, []);

  // ── Filters ──────────────────────────────────────────────────────
  const [searchName, setSearchName] = useState("");
  const [filterCity, setFilterCity] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Message form ─────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(null);

  // ── Data ─────────────────────────────────────────────────────────
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => supabaseApi.drivers.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => supabaseApi.serviceTypes.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const { data: sentNotifications = [] } = useQuery({
    queryKey: ["driver-notifications"],
    queryFn: () => supabaseApi.driverNotifications.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // ── Filtered drivers ─────────────────────────────────────────────
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      if (d.approval_status !== "approved") return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterCity !== "all" && d.city_id !== filterCity) return false;
      if (filterService !== "all" && !(d.service_type_ids || []).includes(filterService)) return false;
      if (searchName && !d.full_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
  }, [drivers, filterCity, filterService, filterStatus, searchName]);

  // ── Send ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    if (filteredDrivers.length === 0) return;

    setSending(true);
    setSentCount(null);

    const tag = `admin-notif-${Date.now()}`;

    // Persist record
    try {
      await supabaseApi.driverNotifications.create({
        title: title.trim(),
        body: body.trim(),
        driver_ids: filteredDrivers.map((d) => d.id),
        driver_names: filteredDrivers.map((d) => d.full_name),
        filter_city: filterCity !== "all" ? filterCity : null,
        filter_service_type: filterService !== "all" ? filterService : null,
        recipient_count: filteredDrivers.length,
        tag,
      });

      qc.invalidateQueries({ queryKey: ["driver-notifications"] });

      setSentCount(filteredDrivers.length);
      setTitle("");
      setBody("");
      setSending(false);
    } catch (error) {
      console.error("Error creating notification:", error);
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificaciones</h1>
          <p className="text-sm text-slate-500">Envía alertas push a conductores en segundo plano</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT — Filters + Compose */}
        <div className="xl:col-span-2 space-y-5">

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                Filtrar destinatarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Search by name */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre…"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* City */}
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las ciudades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las ciudades</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Service type */}
                <Select value={filterService} onValueChange={setFilterService}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los servicios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos de servicio</SelectItem>
                    {serviceTypes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status */}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cualquier estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier estado</SelectItem>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="busy">Ocupado</SelectItem>
                    <SelectItem value="offline">Desconectado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recipient preview */}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4" />
                  <span>
                    <strong className="text-slate-900">{filteredDrivers.length}</strong> conductor{filteredDrivers.length !== 1 ? "es" : ""} seleccionado{filteredDrivers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {filteredDrivers.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {filteredDrivers.slice(0, 4).map((d) => (
                      <Badge key={d.id} variant="secondary" className="text-xs">{d.full_name}</Badge>
                    ))}
                    {filteredDrivers.length > 4 && (
                      <Badge variant="outline" className="text-xs">+{filteredDrivers.length - 4} más</Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Compose */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-400" />
                Redactar notificación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Título
                </label>
                <Input
                  placeholder="Ej: ¡Alta demanda en Zona Centro!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{title.length}/80</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Mensaje
                </label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={4}
                  placeholder="Escribe el mensaje que verán los conductores…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={300}
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{body.length}/300</p>
              </div>

              {/* Preview card */}
              {(title || body) && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Vista previa</p>
                  <p className="font-bold text-slate-800 text-sm">{title || "Sin título"}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{body || "Sin mensaje"}</p>
                </div>
              )}

              {sentCount !== null && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Notificación registrada para <strong>{sentCount}</strong> conductor{sentCount !== 1 ? "es" : ""}.
                  Los conductores con la app abierta la recibirán automáticamente.
                </div>
              )}

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!title.trim() || !body.trim() || filteredDrivers.length === 0 || sending}
                onClick={handleSend}
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? "Enviando…" : `Enviar a ${filteredDrivers.length} conductor${filteredDrivers.length !== 1 ? "es" : ""}`}
              </Button>

              {filteredDrivers.length === 0 && (
                <p className="text-xs text-center text-slate-400">
                  Ajusta los filtros para seleccionar destinatarios.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — History */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Historial de envíos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sentNotifications.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin notificaciones enviadas</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {sentNotifications.map((n) => (
                    <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-slate-800 leading-tight">{n.title}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge className="bg-blue-100 text-blue-700 text-xs">{n.recipient_count || 0}</Badge>
                          <button
                            onClick={async () => {
                              if (!window.confirm("¿Eliminar esta notificación?")) return;
                              const res = await fetch(`/api/driver-notifications?id=${n.id}`, {
                                method: 'DELETE'
                              });
                              if (!res.ok) throw new Error('Failed to delete notification');
                              qc.invalidateQueries({ queryKey: ["driver-notifications"] });
                            }}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-slate-400">
                        {n.created_at
                          ? format(new Date(n.created_at), "d MMM yyyy · HH:mm", { locale: es })
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function Notificaciones() {
  return (
    <Layout currentPageName="Notificaciones">
      <NotificacionesContent />
    </Layout>
  );
}
