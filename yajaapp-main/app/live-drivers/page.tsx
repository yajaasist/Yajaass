"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { supabaseApi } from "@/lib/supabaseApi";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Layout from "@/components/admin/Layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Wifi, WifiOff, Car, Users, Search, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { useMultipleDriverLocations } from "@/lib/useDriverLocationRealtime";
import { AnimatedMarker, SmoothMapPanner } from "@/components/shared/AnimatedMapComponents";

function MapUpdater({ center }: any) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center?.[0], center?.[1]]);
  return null;
}

const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

async function fetchOSRMRoute(points: any) {
  try {
    const coords = points.map((p: any) => `${p[1]},${p[0]}`).join(";");
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes?.[0]) {
      const r = data.routes[0];
      return {
        route: r.geometry.coordinates.map(([lng, lat]: any) => [lat, lng]),
        distKm: (r.distance / 1000).toFixed(1),
        durationMin: Math.ceil(r.duration / 60),
      };
    }
  } catch (err) {
    console.error("OSRM error:", err);
  }
  return null;
}

export default function LiveDriversPage() {
  const [search, setSearch] = useState("");
  const [mapVisible, setMapVisible] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedRouteMeta, setSelectedRouteMeta] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery({
    queryKey: ["driversLive"],
    queryFn: async () => {
      try {
        return await supabaseApi.drivers.list();
      } catch (error) {
        toast.error("Error al cargar conductores");
        return [];
      }
    },
    staleTime: 5 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: rides = [] } = useQuery({
    queryKey: ["ridesLive"],
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

  // Usar hook de múltiples ubicaciones en tiempo real
  const driverIds = drivers.map(d => d.id);
  const { locations: driverLocations, isLoading: locationsLoading } = useMultipleDriverLocations({
    driverIds,
    enabled: driverIds.length > 0,
  });

  useEffect(() => {
    setSelectedRoute(null);
    if (!selectedDriverId) return;
    const driver = drivers.find((d: any) => d.id === selectedDriverId);
    if (!driver?.latitude || !driver?.longitude) return;
    const activeRide = rides.find((r: any) => r.driver_id === selectedDriverId);
    if (!activeRide) return;

    const points = [[driver.latitude, driver.longitude]];
    if (activeRide.pickup_lat && activeRide.pickup_lon) {
      points.push([activeRide.pickup_lat, activeRide.pickup_lon]);
    }
    if (activeRide.status === "in_progress" && activeRide.dropoff_lat && activeRide.dropoff_lon) {
      points.push([activeRide.dropoff_lat, activeRide.dropoff_lon]);
    }
    if (points.length > 1) {
      fetchOSRMRoute(points).then((r: any) => {
        if (r) {
          setSelectedRoute(r.route);
          setSelectedRouteMeta({ distKm: r.distKm, durationMin: r.durationMin });
        }
      });
    }
  }, [selectedDriverId, drivers, rides]);

  const connected = drivers.filter((d: any) => d.status !== "offline");
  const available = drivers.filter((d: any) => d.status === "available");
  const busy = drivers.filter((d: any) => d.status === "busy");
  const offline = drivers.filter((d: any) => d.status === "offline");

  const filteredDrivers = search
    ? drivers.filter((d: any) =>
        (d.full_name?.toLowerCase().includes(search.toLowerCase())) ||
        (d.license_plate?.toLowerCase().includes(search.toLowerCase())) ||
        (d.vehicle_brand?.toLowerCase().includes(search.toLowerCase())) ||
        (d.vehicle_model?.toLowerCase().includes(search.toLowerCase()))
      )
    : drivers;

  const driversWithLocation = connected.filter((d: any) => d.latitude && d.longitude);
  const selectedDriver = drivers.find((d: any) => d.id === selectedDriverId);
  const center = selectedDriver?.latitude && selectedDriver?.longitude
    ? [selectedDriver.latitude, selectedDriver.longitude]
    : driversWithLocation.length > 0
      ? [driversWithLocation[0].latitude, driversWithLocation[0].longitude]
      : [19.4326, -99.1332];

  const getStatusColor = (status: string, type: string = "driver") => {
    if (type === "ride") {
      switch (status) {
        case "assigned": return "bg-blue-100 text-blue-700";
        case "admin_approved": return "bg-violet-100 text-violet-700";
        case "en_route": return "bg-orange-100 text-orange-700";
        case "arrived": return "bg-orange-100 text-orange-700";
        case "in_progress": return "bg-green-100 text-green-700";
        default: return "bg-slate-100 text-slate-700";
      }
    } else {
      switch (status) {
        case "available": return "bg-emerald-100 text-emerald-700";
        case "busy": return "bg-blue-100 text-blue-700";
        case "offline": return "bg-slate-100 text-slate-500";
        case "suspended": return "bg-red-100 text-red-700";
        case "blocked": return "bg-red-100 text-red-700";
        default: return "bg-slate-100 text-slate-700";
      }
    }
  };

  const getStatusLabel = (status: string, type: string = "driver") => {
    const rideLabels = {
      assigned: "Asignado",
      admin_approved: "Aprobado",
      en_route: "En camino",
      arrived: "Llegó",
      in_progress: "En progreso",
      completed: "Completado",
      cancelled: "Cancelado",
    };
    const driverLabels = {
      available: "Disponible",
      busy: "En servicio",
      offline: "Desconectado",
      suspended: "Suspendido",
      blocked: "Bloqueado",
    };
    const labels = type === "ride" ? rideLabels : driverLabels;
    return labels[status] || status;
  };

  return (
    <Layout currentPageName="LiveDrivers">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse inline-block" />
            EN VIVO
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Conductores en tiempo real</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Conectados", value: connected.length, color: "text-emerald-600", bg: "bg-emerald-50", icon: Wifi },
            { label: "Disponibles", value: available.length, color: "text-blue-600", bg: "bg-blue-50", icon: Users },
            { label: "En servicio", value: busy.length, color: "text-violet-600", bg: "bg-violet-50", icon: Car },
            { label: "Desconectados", value: offline.length, color: "text-slate-500", bg: "bg-slate-100", icon: WifiOff },
          ].map((s: any) => (
            <Card key={s.label} className="p-4 border-0 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
                <div className={`${s.bg} ${s.color} p-2.5 rounded-xl`}>
                  <s.icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">
              Mapa en tiempo real
              {selectedDriver && (
                <span className="ml-2 text-blue-600 font-semibold">
                  · {selectedDriver.full_name}
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              {selectedDriverId && selectedRouteMeta && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-2.5 py-1">
                  <span>🛣 {selectedRouteMeta.distKm} km</span>
                  <span className="font-bold">⏱ {selectedRouteMeta.durationMin} min</span>
                </div>
              )}
              {selectedDriverId && (
                <button
                  onClick={() => {
                    setSelectedDriverId(null);
                    setSelectedRoute(null);
                    setSelectedRouteMeta(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Deseleccionar
                </button>
              )}
              <button
                onClick={() => setMapVisible((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {mapVisible ? (
                  <>
                    <ChevronUp className="w-4 h-4" /> Ocultar mapa
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" /> Mostrar mapa
                  </>
                )}
              </button>
            </div>
          </div>
          {mapVisible && (
            <div className="h-[420px]">
              <MapContainer
                center={center as any}
                zoom={12}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <SmoothMapPanner center={center} duration={1000} />
                {drivers.filter((d: any) => {
                  const location = driverLocations[d.id];
                  return location?.latitude && location?.longitude;
                }).map((driver: any) => {
                  const location = driverLocations[driver.id];
                  const activeRide = rides.find((r: any) => r.driver_id === driver.id);
                  return (
                    <AnimatedMarker
                      key={driver.id}
                      position={[location.latitude, location.longitude]}
                      icon={defaultIcon}
                      duration={600}
                      eventHandlers={{
                        click: () =>
                          setSelectedDriverId(
                            driver.id === selectedDriverId ? null : driver.id
                          ),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[200px] text-xs">
                          <p className="font-bold text-slate-900">
                            {driver.full_name || "Desconocido"}
                          </p>
                          <p className="text-slate-600">
                            {driver.vehicle_brand || "Marca"} {driver.vehicle_model || "Modelo"} ·{" "}
                            {driver.license_plate || "Sin placa"}
                          </p>
                          <p className={`text-xs font-medium mt-1 ${getStatusColor(driver.status)}`}>
                            {getStatusLabel(driver.status)}
                          </p>
                          {activeRide && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-blue-700 font-medium">
                                🚗 {activeRide.passenger_name || "Pasajero"}
                              </p>
                              <p className={`text-xs mt-1 ${getStatusColor(activeRide.status, "ride")}`}>
                                {getStatusLabel(activeRide.status, "ride")}
                              </p>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 mt-2">
                            Clic para ver ruta
                          </p>
                        </div>
                      </Popup>
                    </AnimatedMarker>
                  );
                })}
                {selectedRoute && (
                  <Polyline
                    positions={selectedRoute}
                    color="#3B82F6"
                    weight={4}
                    opacity={0.85}
                  />
                )}
              </MapContainer>
            </div>
          )}
        </Card>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-800 text-sm">
              Lista de conductores
            </h2>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar conductor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl text-sm h-9"
              />
            </div>
          </div>
          {filteredDrivers.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              {search
                ? "No se encontraron conductores"
                : "No hay conductores registrados"}
            </p>
          )}
          {filteredDrivers.map((driver: any) => {
            const activeRide = rides.find((r: any) => r.driver_id === driver.id);
            const isSelected = driver.id === selectedDriverId;
            return (
              <div
                key={driver.id}
                className={`bg-white rounded-xl px-4 py-3 border flex items-center justify-between cursor-pointer transition-all ${
                  isSelected
                    ? "border-blue-400 bg-blue-50 shadow-sm"
                    : "border-slate-100 hover:border-slate-200"
                }`}
                onClick={() =>
                  setSelectedDriverId(
                    driver.id === selectedDriverId ? null : driver.id
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 overflow-hidden flex-shrink-0">
                    {driver.photo_url ? (
                      <img
                        src={driver.photo_url}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      driver.full_name?.charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {driver.full_name || "Desconocido"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {driver.vehicle_brand || "Marca"} {driver.vehicle_model || "Modelo"} ·{" "}
                      {driver.license_plate || "Sin placa"}
                    </p>
                    {activeRide && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        En viaje → {activeRide.passenger_name || "Pasajero"}{" "}
                        <span className="text-slate-400">
                          ({activeRide.status})
                        </span>
                        {isSelected && selectedRouteMeta && (
                          <span className="ml-2 font-semibold text-emerald-600">
                            🛣 {selectedRouteMeta.distKm} km · ⏱{" "}
                            {selectedRouteMeta.durationMin} min
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {driver.latitude && driver.longitude && (
                    <span className="text-[10px] text-emerald-500 font-medium">
                      📍 GPS
                    </span>
                  )}
                  <Badge className={`text-xs ${getStatusColor(driver.status)}`}>
                    {getStatusLabel(driver.status)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
