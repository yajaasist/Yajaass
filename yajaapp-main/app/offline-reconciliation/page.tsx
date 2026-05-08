"use client";
export const dynamic = 'force-dynamic';

import React, { useMemo, useState } from "react";
import Layout from "@/components/admin/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import { useAdminSession } from "@/components/shared/useAdminSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Search, WifiOff, Clock3, MapPin, User, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCDMX, nowCDMX } from "@/components/shared/dateUtils";
import { toast } from "sonner";

type OfflineEvent = {
  id: string;
  action_type?: string;
  role?: string;
  created_at?: string;
  evidence?: {
    captured_at?: string;
    online?: boolean;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    user_agent?: string;
  };
  updates?: Record<string, any>;
};

function getOfflineSecurity(ride: any) {
  return ride?.extra_charges?.offline_security || null;
}

export default function OfflineReconciliationPage() {
  const queryClient = useQueryClient();
  const { session } = useAdminSession();
  const [search, setSearch] = useState("");
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data: rides = [] } = useQuery({
    queryKey: ["rides"],
    queryFn: () => supabaseApi.rideRequests.list(),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const reconciliationRides = useMemo(() => {
    return rides.filter((ride: any) => getOfflineSecurity(ride)?.reconciliation_required);
  }, [rides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reconciliationRides;
    return reconciliationRides.filter((ride: any) => {
      return [
        ride.passenger_name,
        ride.driver_name,
        ride.service_id,
        ride.pickup_address,
        ride.dropoff_address,
        ride.status,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [reconciliationRides, search]);

  const totals = useMemo(() => {
    const events = reconciliationRides.flatMap((ride: any) => getOfflineSecurity(ride)?.events || []);
    return {
      rides: reconciliationRides.length,
      events: events.length,
      driverEvents: events.filter((e: OfflineEvent) => e.role === "driver").length,
      passengerEvents: events.filter((e: OfflineEvent) => e.role === "passenger").length,
    };
  }, [reconciliationRides]);

  const handleResolve = async (ride: any) => {
    setResolvingId(ride.id);
    try {
      const current = getOfflineSecurity(ride) || {};
      const updatedExtraCharges = {
        ...(ride.extra_charges || {}),
        offline_security: {
          ...current,
          reconciliation_required: false,
          resolved_at: nowCDMX(),
          resolved_by: session?.full_name || session?.email || "admin",
        },
      };
      await supabaseApi.rideRequests.update(ride.id, {
        extra_charges: updatedExtraCharges,
      });
      toast.success("Conciliación marcada como resuelta");
      queryClient.invalidateQueries({ queryKey: ["rides"] });
      if (selectedRide?.id === ride.id) {
        setSelectedRide({ ...ride, extra_charges: updatedExtraCharges });
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo resolver la conciliación");
    }
    setResolvingId(null);
  };

  return (
    <Layout currentPageName="OfflineReconciliation">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Centro de conciliación offline</h1>
            <p className="text-sm text-slate-500 mt-1">
              Revisa eventos registrados sin conexión y márcalos como conciliados por operación.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Viajes pendientes", value: totals.rides, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Eventos offline", value: totals.events, icon: WifiOff, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Eventos conductor", value: totals.driverEvents, icon: User, color: "text-violet-600", bg: "bg-violet-50" },
            { label: "Eventos pasajero", value: totals.passengerEvents, icon: MapPin, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="p-4 border-0 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.bg}`}>
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-4 border-0 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por pasajero, conductor, folio o dirección"
              className="pl-10 rounded-xl"
            />
          </div>
        </Card>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="p-8 border-0 shadow-sm text-center text-slate-400">
              No hay conciliaciones offline pendientes.
            </Card>
          ) : (
            filtered.map((ride: any) => {
              const offlineSecurity = getOfflineSecurity(ride);
              const events: OfflineEvent[] = offlineSecurity?.events || [];
              const lastEvent = events[events.length - 1];
              return (
                <Card key={ride.id} className="p-4 border-0 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-slate-900">#{ride.service_id || ride.id?.slice(-6)}</p>
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendiente conciliación</Badge>
                        <Badge variant="outline">{ride.status || "sin estado"}</Badge>
                      </div>
                      <p className="text-sm text-slate-700 truncate">{ride.passenger_name || "Pasajero"} {ride.driver_name ? `· ${ride.driver_name}` : ""}</p>
                      <p className="text-xs text-slate-400 truncate mt-1">{ride.pickup_address || "Sin origen"}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> {lastEvent?.created_at ? formatCDMX(lastEvent.created_at, "shortdatetime") : "Sin hora"}</span>
                        <span>{events.length} evento{events.length !== 1 ? "s" : ""}</span>
                        <span>Último rol: {lastEvent?.role || "—"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => setSelectedRide(ride)}>
                        Ver detalle
                      </Button>
                      <Button
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleResolve(ride)}
                        disabled={resolvingId === ride.id}
                      >
                        {resolvingId === ride.id ? "Resolviendo..." : "Marcar resuelto"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <Dialog open={!!selectedRide} onOpenChange={(open) => !open && setSelectedRide(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detalle de conciliación offline</DialogTitle>
              <DialogDescription>
                Revisa evidencia, cambios aplicados y resuelve cuando operación confirme el caso.
              </DialogDescription>
            </DialogHeader>

            {selectedRide && (() => {
              const offlineSecurity = getOfflineSecurity(selectedRide);
              const events: OfflineEvent[] = offlineSecurity?.events || [];
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <Card className="p-4 border border-slate-200 shadow-none">
                      <p className="text-slate-500 text-xs mb-1">Servicio</p>
                      <p className="font-bold text-slate-900">#{selectedRide.service_id || selectedRide.id?.slice(-6)}</p>
                      <p className="text-slate-600 mt-2">{selectedRide.passenger_name || "Pasajero"}</p>
                      <p className="text-slate-400 text-xs mt-1">{selectedRide.pickup_address || "Sin origen"}</p>
                    </Card>
                    <Card className="p-4 border border-slate-200 shadow-none">
                      <p className="text-slate-500 text-xs mb-1">Estado conciliación</p>
                      <p className="font-bold text-amber-700">Pendiente</p>
                      {offlineSecurity?.resolved_at && (
                        <p className="text-xs text-slate-500 mt-2">Última resolución: {formatCDMX(offlineSecurity.resolved_at, "shortdatetime")}</p>
                      )}
                    </Card>
                  </div>

                  <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                    {events.map((event) => (
                      <Card key={event.id} className="p-4 border border-slate-200 shadow-none">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="font-semibold text-slate-900">{event.action_type || "ride_update"}</p>
                            <p className="text-xs text-slate-500">{event.created_at ? formatCDMX(event.created_at, "shortdatetime") : "Sin fecha"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{event.role || "sin rol"}</Badge>
                            <Badge className={event.evidence?.online ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                              {event.evidence?.online ? "Registrado online" : "Registrado offline"}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="font-semibold text-slate-700 mb-2">Evidencia</p>
                            <div className="space-y-1 text-slate-600">
                              <p>Capturado: {event.evidence?.captured_at ? formatCDMX(event.evidence.captured_at, "shortdatetime") : "—"}</p>
                              <p>Lat/Lon: {event.evidence?.latitude != null && event.evidence?.longitude != null ? `${event.evidence.latitude.toFixed(5)}, ${event.evidence.longitude.toFixed(5)}` : "—"}</p>
                              <p>Precisión: {event.evidence?.accuracy != null ? `${Math.round(event.evidence.accuracy)} m` : "—"}</p>
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="font-semibold text-slate-700 mb-2">Cambios enviados</p>
                            <pre className="text-[11px] text-slate-600 whitespace-pre-wrap break-words">{JSON.stringify(event.updates || {}, null, 2)}</pre>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setSelectedRide(null)} className="rounded-xl">
                      Cerrar
                    </Button>
                    <Button
                      onClick={() => handleResolve(selectedRide)}
                      disabled={resolvingId === selectedRide.id}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {resolvingId === selectedRide.id ? "Resolviendo..." : "Resolver conciliación"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
