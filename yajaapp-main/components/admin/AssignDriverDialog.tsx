"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Car, AlertCircle, MapPin, Navigation, List, Map as MapIcon } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { nowCDMX } from "@/components/shared/dateUtils";
import { useMultipleDriverLocations } from "@/lib/useDriverLocationRealtime";
import { AnimatedMarker } from "@/components/shared/AnimatedMapComponents";

// ── Icons ────────────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});
const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [20, 33], iconAnchor: [10, 33],
});
const goldIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [22, 36], iconAnchor: [11, 36],
});

// ── Utils ────────────────────────────────────────────────────────────────────
function getHaverDist(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchOSRMRoutes(pickupLat, pickupLon, drivers) {
  const results = {};
  await Promise.all(drivers.map(async (d) => {
    if (!d.latitude || !d.longitude) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${d.longitude},${d.latitude};${pickupLon},${pickupLat}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.[0]) {
        results[d.id] = { distKm: data.routes[0].distance / 1000, durationMin: Math.ceil(data.routes[0].duration / 60) };
      }
    } catch {}
  }));
  return results;
}

function FitMap({ center, primaryKm, secondaryKm }) {
  const map = useMap();
  const doneRef = useRef(false);
  useEffect(() => {
    if (!doneRef.current && center) {
      doneRef.current = true;
      const radiusM = (secondaryKm || primaryKm || 5) * 1000;
      const bounds = L.latLng(center).toBounds(radiusM * 2.2);
      map.fitBounds(bounds);
    }
  }, [center]);
  return null;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AssignDriverDialog({ ride, drivers = [], rides = [], open, onOpenChange, onAssigned }) {
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [saving, setSaving] = useState(false);
  const [osrmRoutes, setOsrmRoutes] = useState({});
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"
  const queryClient = useQueryClient();

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    enabled: open,
    staleTime: 60 * 1000,
  });
  const settings = settingsList[0];
  const primaryRadius = settings?.auto_primary_radius_km ?? settings?.auction_primary_radius_km ?? 5;
  const secondaryRadius = settings?.auto_secondary_radius_km ?? settings?.auction_secondary_radius_km ?? 15;

  // Load GeoZones to display on map
  const { data: geoZones = [] } = useQuery({
    queryKey: ["geoZones"],
    queryFn: () => supabaseApi.geoZones.list(),
    enabled: open,
    staleTime: 60000,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Only exclude drivers who are truly busy (actively doing a ride, not just "assigned" waiting to accept)
  const trulyBusyDriverIds = new Set(
    (rides || [])
      .filter(r => ["en_route", "arrived", "in_progress", "admin_approved"].includes(r.status) && r.driver_id)
      .map(r => r.driver_id)
  );

  const availableDrivers = useMemo(() => {
    const base = drivers.filter(d => {
      if (d.status !== "available") return false;
      if (d.approval_status !== "approved") return false;
      if (trulyBusyDriverIds.has(d.id)) return false;
      // Filtrar por tipo de servicio: si el conductor tiene tipos asignados, verificar coincidencia
      // Se acepta coincidencia por ID o por nombre (para compatibilidad con datos existentes)
      const hasServiceTypes = (d.service_type_ids?.length > 0) || (d.service_type_names?.length > 0);
      if (hasServiceTypes) {
        const matchById = ride?.service_type_id && d.service_type_ids?.includes(ride.service_type_id);
        const matchByName = ride?.service_type_name && d.service_type_names?.includes(ride.service_type_name);
        if (ride?.service_type_id || ride?.service_type_name) {
          if (!matchById && !matchByName) return false;
        }
      }
      if (ride?.city_id && d.city_id && d.city_id !== ride.city_id) return false;

      if (ride?.pickup_lat && ride?.pickup_lon) {
        const driverCity = cities.find(c => c.id === d.city_id);
        const cityRadius = driverCity?.geofence_radius_km || driverCity?.radius_km;
        if (driverCity?.center_lat && cityRadius) {
          const cityDist = getHaverDist(ride.pickup_lat, ride.pickup_lon, driverCity.center_lat, driverCity.center_lon);
          if (cityDist > cityRadius) return false;
        }

        if (d.latitude && d.longitude) {
          const distToRide = getHaverDist(ride.pickup_lat, ride.pickup_lon, d.latitude, d.longitude);
          if (distToRide > secondaryRadius) return false;
        }
      }

      return true;
    });
    if (ride?.pickup_lat && ride?.pickup_lon) {
      return [...base].sort((a, b) => {
        const da = getHaverDist(ride.pickup_lat, ride.pickup_lon, a.latitude, a.longitude);
        const db = getHaverDist(ride.pickup_lat, ride.pickup_lon, b.latitude, b.longitude);
        return da - db;
      });
    }
    return base;
  }, [drivers, rides, ride, cities, secondaryRadius]);

  // Usar hook de ubicaciones en tiempo real para conductores disponibles
  const availableDriverIds = availableDrivers.map(d => d.id);
  const { driverLocations } = useMultipleDriverLocations({
    driverIds: availableDriverIds,
    enabled: open && availableDriverIds.length > 0,
  });

  // Combinar datos estáticos con ubicaciones en tiempo real
  const driversWithRealtimeLocation = useMemo(() => {
    return availableDrivers.map(driver => {
      const realtimeLocation = driverLocations.find(loc => loc.id === driver.id);
      return realtimeLocation ? {
        ...driver,
        latitude: realtimeLocation.latitude,
        longitude: realtimeLocation.longitude,
        // Mantener datos adicionales del realtime
        status: realtimeLocation.status,
        last_updated: realtimeLocation.last_updated,
      } : driver;
    });
  }, [availableDrivers, driverLocations]);

  // Auto-select nearest
  useEffect(() => {
    if (driversWithRealtimeLocation.length > 0 && !selectedDriverId) {
      setSelectedDriverId(driversWithRealtimeLocation[0].id);
    }
  }, [driversWithRealtimeLocation]);

  // Reset when opened — always default to map if pickup coords exist
  useEffect(() => {
    if (open) {
      setOsrmRoutes({});
      setSelectedDriverId("");
      // Always open map view when there are pickup coordinates (to show geocercas + drivers)
      const hasPickupCoords = !!(ride?.pickup_lat && ride?.pickup_lon);
      setViewMode(hasPickupCoords ? "map" : "list");
    }
  }, [open, ride?.id]);

  // Fetch OSRM routes
  useEffect(() => {
    if (!open || !ride?.pickup_lat || !ride?.pickup_lon || driversWithRealtimeLocation.length === 0) return;
    setLoadingRoutes(true);
    fetchOSRMRoutes(ride.pickup_lat, ride.pickup_lon, driversWithRealtimeLocation).then(routes => {
      setOsrmRoutes(routes);
      setLoadingRoutes(false);
    });
  }, [open, ride?.pickup_lat, ride?.pickup_lon, driversWithRealtimeLocation.length]);

  const handleAssign = async () => {
    if (!selectedDriverId) return;
    setSaving(true);
    const driver = drivers.find(d => d.id === selectedDriverId);
    if (!driver) { setSaving(false); return; }

    // If ride was previously assigned to a different driver, release them first
    const previousDriverId = ride?.driver_id;
    if (previousDriverId && previousDriverId !== selectedDriverId) {
      await supabaseApi.drivers.update(previousDriverId, { status: "available" });
    }

    const assignedNow = nowCDMX();
    const updatedRide = {
      driver_id: selectedDriverId,
      driver_name: driver.full_name,
      status: "assigned",
      assignment_mode: "manual",
      assigned_at: assignedNow,
      manual_assignment_requested_at: null,
      cancellation_reason: null,
      _excluded_driver_ids: [],
      auction_driver_ids: [],
    };
    await supabaseApi.rideRequests.update(ride.id, updatedRide);
    queryClient.invalidateQueries({ queryKey: ["rides"] });
    queryClient.invalidateQueries({ queryKey: ["drivers"] });
    setSaving(false);
    if (onAssigned) onAssigned({ ...ride, ...updatedRide }, driver);
    onOpenChange(false);
    setSelectedDriverId("");
  };

  const nearest = driversWithRealtimeLocation[0];
  const hasPickup = !!(ride?.pickup_lat && ride?.pickup_lon);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[46.2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            Asignar conductor
            <span className="text-sm font-normal text-slate-400">— {driversWithRealtimeLocation.length} disponible{driversWithRealtimeLocation.length !== 1 ? "s" : ""}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Selecciona un conductor disponible para este viaje.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Ride info */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-sm font-semibold text-slate-900">{ride?.passenger_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {ride?.pickup_address}{ride?.dropoff_address ? ` → ${ride.dropoff_address}` : " (destino no definido)"}
            </p>
            {ride?.service_type_name && (
              <span className="text-[10px] bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 mt-1 inline-block">{ride.service_type_name}</span>
            )}
          </div>

          {/* Nearest driver info */}
          {nearest && hasPickup && (
            <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-2 text-xs text-blue-700 border border-blue-100">
              <Navigation className="w-4 h-4 flex-shrink-0" />
              {osrmRoutes[nearest.id] ? (
                <span>Más cercano: <strong>{nearest.full_name}</strong> · {osrmRoutes[nearest.id].distKm.toFixed(1)} km por ruta · ~{osrmRoutes[nearest.id].durationMin} min</span>
              ) : (
                <span>Más cercano: <strong>{nearest.full_name}</strong> · {getHaverDist(ride.pickup_lat, ride.pickup_lon, nearest.latitude, nearest.longitude).toFixed(1)} km {loadingRoutes ? "(calculando ruta...)" : "(tiempo real)"}</span>
              )}
            </div>
          )}

          {/* Toggle list/map */}
          {hasPickup && (
            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              <button
                onClick={() => setViewMode("list")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${viewMode === "map" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <MapIcon className="w-3.5 h-3.5" /> Mapa con radios
              </button>
            </div>
          )}

          {/* MAP VIEW */}
          {viewMode === "map" && hasPickup && (
            <div style={{ height: 340 }} className="rounded-xl overflow-hidden border border-slate-200">
              <MapContainer
                center={[ride.pickup_lat, ride.pickup_lon]}
                zoom={12}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                <FitMap center={[ride.pickup_lat, ride.pickup_lon]} primaryKm={primaryRadius} secondaryKm={secondaryRadius} />

                {/* Radius circles */}
                <Circle
                  center={[ride.pickup_lat, ride.pickup_lon]}
                  radius={primaryRadius * 1000}
                  pathOptions={{ color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.05, weight: 2, dashArray: "6 4" }}
                />
                <Circle
                  center={[ride.pickup_lat, ride.pickup_lon]}
                  radius={secondaryRadius * 1000}
                  pathOptions={{ color: "#F59E0B", fillColor: "#F59E0B", fillOpacity: 0.03, weight: 1.5, dashArray: "4 4" }}
                />

                {/* GeoZone polygons / circles */}
                {geoZones.map(zone => {
                  const color = zone.color || "#10B981";
                  if (zone.tipo_zona === "poligono" && Array.isArray(zone.poligono) && zone.poligono.length >= 3) {
                    const positions = zone.poligono.map(p => [p.lat, p.lng || p.lon]);
                    return (
                      <Polygon
                        key={zone.id}
                        positions={positions}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
                      >
                        <Popup>
                          <div className="text-xs min-w-[120px]">
                            <p className="font-bold">{zone.name}</p>
                            {zone.tipo_tarifa === "fija"
                              ? <p>Tarifa fija: ${zone.tarifa_fija}</p>
                              : <p>Base ${zone.tarifa_base} + ${zone.tarifa_por_km}/km</p>}
                          </div>
                        </Popup>
                      </Polygon>
                    );
                  }
                  if (zone.center_lat && zone.center_lon && zone.radius_km) {
                    return (
                      <Circle
                        key={zone.id}
                        center={[zone.center_lat, zone.center_lon]}
                        radius={zone.radius_km * 1000}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
                      >
                        <Popup>
                          <div className="text-xs min-w-[120px]">
                            <p className="font-bold">{zone.name}</p>
                            {zone.tipo_tarifa === "fija"
                              ? <p>Tarifa fija: ${zone.tarifa_fija}</p>
                              : <p>Base ${zone.tarifa_base} + ${zone.tarifa_por_km}/km</p>}
                          </div>
                        </Popup>
                      </Circle>
                    );
                  }
                  return null;
                })}

                {/* Pickup marker */}
                <Marker position={[ride.pickup_lat, ride.pickup_lon]} icon={greenIcon}>
                  <Popup><strong>📍 Recogida</strong><br />{ride.pickup_address}</Popup>
                </Marker>

                {/* Driver markers */}
                {driversWithRealtimeLocation.map((d, i) => {
                  if (!d.latitude || !d.longitude) return null;
                  const isSelected = selectedDriverId === d.id;
                  const route = osrmRoutes[d.id];
                  const dist = getHaverDist(ride.pickup_lat, ride.pickup_lon, d.latitude, d.longitude);
                  const hasRealtimeLocation = driverLocations.some(loc => loc.id === d.id);
                  
                  return (
                    <AnimatedMarker
                      key={d.id}
                      position={[d.latitude, d.longitude]}
                      icon={isSelected ? goldIcon : blueIcon}
                      duration={600}
                      eventHandlers={{ click: () => setSelectedDriverId(d.id) }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1 min-w-[140px]">
                          <p className="font-bold flex items-center gap-1">
                            {d.full_name}
                            {hasRealtimeLocation && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" title="Ubicación en tiempo real" />}
                          </p>
                          <p><Star className="w-3 h-3 inline text-amber-400" /> {d.rating || 5}</p>
                          <p>{d.vehicle_brand} {d.vehicle_model} · {d.license_plate}</p>
                          {route
                            ? <p>🛣 {route.distKm.toFixed(1)} km · {route.durationMin} min</p>
                            : <p>📐 {dist.toFixed(1)} km {hasRealtimeLocation ? "(tiempo real)" : "(última conocida)"}</p>
                          }
                          <button
                            onClick={() => setSelectedDriverId(d.id)}
                            className={`mt-1 w-full text-xs py-1 rounded font-semibold ${isSelected ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"}`}
                          >
                            {isSelected ? "✓ Seleccionado" : "Seleccionar"}
                          </button>
                        </div>
                      </Popup>
                    </AnimatedMarker>
                  );
                })}
              </MapContainer>
            </div>
          )}

          {/* Map legend */}
          {viewMode === "map" && hasPickup && (
            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 border-t-2 border-blue-400 border-dashed" /> Radio {primaryRadius} km (primario)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 border-t-2 border-amber-400 border-dashed" /> Radio {secondaryRadius} km (secundario)</span>
              <span className="flex items-center gap-1"><span className="text-amber-500">★</span> Seleccionado</span>
              <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Ubicación tiempo real</span>
              {geoZones.length > 0 && (
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-400 opacity-60" /> Geocercas ({geoZones.length})</span>
              )}
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === "list" && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Conductores disponibles</label>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {availableDrivers.length === 0 && (
                  <div className="p-4 text-sm text-slate-500 text-center flex flex-col items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-slate-300" />
                    <span>No hay conductores disponibles</span>
                    <span className="text-xs text-slate-400">
                      {ride?.service_type_name ? `Requiere: "${ride.service_type_name}". ` : ""}
                      {ride?.city_name ? `Ciudad: "${ride.city_name}".` : ""}
                    </span>
                  </div>
                )}
                {availableDrivers.map((driver, index) => {
                  const haverDist = hasPickup ? getHaverDist(ride.pickup_lat, ride.pickup_lon, driver.latitude, driver.longitude) : null;
                  const route = osrmRoutes[driver.id];
                  const isSelected = selectedDriverId === driver.id;
                  return (
                    <button
                      key={driver.id}
                      onClick={() => setSelectedDriverId(driver.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {index === 0 && hasPickup && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Más cercano</span>
                          )}
                          <span className="text-sm font-semibold text-slate-800">{driver.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{driver.rating || 5}
                          </span>
                          {route ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <MapPin className="w-3 h-3" />{route.distKm.toFixed(1)} km · {route.durationMin} min
                            </span>
                          ) : haverDist !== null && haverDist !== Infinity ? (
                            <span className="flex items-center gap-0.5 text-slate-400">
                              <MapPin className="w-3 h-3" />{haverDist.toFixed(1)} km{loadingRoutes ? " …" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <Car className="w-3 h-3 inline mr-0.5" />
                        {driver.vehicle_brand} {driver.vehicle_model} · {driver.license_plate}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected driver ETA confirmation */}
          {selectedDriverId && (() => {
            const sel = drivers.find(d => d.id === selectedDriverId);
            const route = osrmRoutes[selectedDriverId];
            const haverDist = sel && hasPickup ? getHaverDist(ride.pickup_lat, ride.pickup_lon, sel.latitude, sel.longitude) : null;
            return (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-800 font-semibold">✓ Seleccionado: <strong>{sel?.full_name}</strong></span>
                  {route ? (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-600">🛣 {route.distKm.toFixed(1)} km</span>
                      <span className="bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg">⏱ ~{route.durationMin} min</span>
                    </div>
                  ) : haverDist && haverDist !== Infinity ? (
                    <span className="text-xs text-slate-500">≈ {haverDist.toFixed(1)} km (línea recta)</span>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={!selectedDriverId || saving} className="bg-slate-900 hover:bg-slate-800">
            {saving ? "Asignando..." : "Asignar conductor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
