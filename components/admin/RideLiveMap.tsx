"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { useDriverLocation } from "@/lib/useDriverLocationRealtime";
import { AnimatedMarker, SmoothMapPanner } from "@/components/shared/AnimatedMapComponents";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Car icon (SVG) for driver
const carIconSvg = (color = "#3B82F6") => L.divIcon({
  html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h12l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
      <circle cx="7.5" cy="17.5" r="1.5"/>
      <circle cx="16.5" cy="17.5" r="1.5"/>
      <path d="M5 9h14"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Person icon (SVG) for passenger pickup
const personIconSvg = (color = "#10B981") => L.divIcon({
  html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
      <circle cx="12" cy="7" r="4"/>
      <path d="M20 21a8 8 0 1 0-16 0"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Destination flag icon
const destIconSvg = () => L.divIcon({
  html: `<div style="background:#EF4444;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

function MapRecenter({ pos }: { pos: LatLngTuple | null }) {
  const map = useMap();
  useEffect(() => { if (pos) map.setView(pos, map.getZoom()); }, [pos?.[0], pos?.[1]]);
  return null;
}

async function fetchOSRMRoute(points) {
  try {
    const coords = points.map(p => `${p[1]},${p[0]}`).join(";");
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes?.[0]) return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch {}
  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function RideLiveMap({ ride, settings }) {
  const [route, setRoute] = useState(null);
  const [routeMeta, setRouteMeta] = useState(null); // { distanceKm, durationMin }
  const isActive = ride && !["completed", "cancelled"].includes(ride.status);

  // Usar hook de ubicación en tiempo real
  const { location: driverLocation, isLoading: driverLoading } = useDriverLocation({
    driverId: ride?.driver_id || null,
    enabled: !!ride?.driver_id && isActive,
  });

  // Mantener compatibilidad con código existente
  const liveDriver = driverLocation ? {
    id: driverLocation.id,
    latitude: driverLocation.latitude,
    longitude: driverLocation.longitude,
    full_name: driverLocation.full_name,
    status: driverLocation.status,
  } : null;

  const driver = liveDriver || {};
  const hasDriverLoc = driver?.latitude && driver?.longitude;
  const hasPickup = ride?.pickup_lat && ride?.pickup_lon;
  const hasDropoff = ride?.dropoff_lat && ride?.dropoff_lon;

  useEffect(() => {
    if (!hasDriverLoc || !hasPickup) { setRoute(null); setRouteMeta(null); return; }
    const isInProgress = ride.status === "in_progress";
    const points = [[driver.latitude, driver.longitude], [ride.pickup_lat, ride.pickup_lon]];
    if (isInProgress && hasDropoff) points.push([ride.dropoff_lat, ride.dropoff_lon]);

    (async () => {
      try {
        const coords = points.map(p => `${p[1]},${p[0]}`).join(";");
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes?.[0]) {
          const r = data.routes[0];
          setRoute(r.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
          setRouteMeta({
            distanceKm: (r.distance / 1000).toFixed(1),
            durationMin: Math.round(r.duration / 60),
          });
        }
      } catch {
        const distKm = haversineKm(driver.latitude, driver.longitude, ride.pickup_lat, ride.pickup_lon);
        const speedKmh = settings?.eta_speed_kmh ?? 30;
        setRouteMeta({ distanceKm: distKm.toFixed(1), durationMin: Math.round(distKm / speedKmh * 60) });
      }
    })();
  }, [driver?.latitude, driver?.longitude, ride?.pickup_lat, ride?.dropoff_lat, ride?.status]);

  if (!isActive) return null;
  if (!hasPickup && !hasDriverLoc) return null;
  // Always show map if we have pickup coords (even without driver GPS yet)

  const center: LatLngTuple | null = hasDriverLoc
    ? [driver.latitude, driver.longitude]
    : hasPickup
    ? [ride.pickup_lat, ride.pickup_lon]
    : null;

  if (!center) return null;

  // Choose car color based on ride status
  const carColor = { assigned: "#3B82F6", en_route: "#F97316", arrived: "#8B5CF6", in_progress: "#10B981", admin_approved: "#6366F1" }[ride.status] || "#3B82F6";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-xs font-semibold text-blue-600">Conductor en tiempo real</p>
          {!hasDriverLoc && <span className="text-xs text-slate-400">(sin GPS aún)</span>}
        </div>
        {routeMeta && (
          <div className="flex items-center gap-3 text-xs bg-slate-100 rounded-lg px-2.5 py-1">
            <span className="text-slate-500">🚗 {routeMeta.distanceKm} km</span>
            <span className="text-blue-600 font-semibold">⏱ ~{routeMeta.durationMin} min</span>
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="flex gap-3 px-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span style={{background: carColor}} className="w-3 h-3 rounded-full inline-block" /> Conductor</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Punto de recogida</span>
        {hasDropoff && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Destino</span>}
      </div>
      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 240 }}>
        <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          {hasDriverLoc && <SmoothMapPanner center={[driver.latitude, driver.longitude]} duration={1000} />}
          {hasDriverLoc && (
            <AnimatedMarker
              position={[driver.latitude, driver.longitude]}
              icon={carIconSvg(carColor)}
              duration={800}
            >
              <Popup>
                <strong>🚗 {driver.full_name}</strong><br />
                {driver.vehicle_brand} {driver.vehicle_model} · {driver.license_plate}
                {routeMeta && <><br /><span style={{color:"#3B82F6"}}>~{routeMeta.durationMin} min · {routeMeta.distanceKm} km</span></>}
              </Popup>
            </AnimatedMarker>
          )}
          {hasPickup && (
            <Marker position={[ride.pickup_lat, ride.pickup_lon]} icon={personIconSvg("#10B981")}>
              <Popup>👤 <strong>{ride.passenger_name}</strong><br />📍 {ride.pickup_address}</Popup>
            </Marker>
          )}
          {hasDropoff && (
            <Marker position={[ride.dropoff_lat, ride.dropoff_lon]} icon={destIconSvg()}>
              <Popup>🏁 Destino: {ride.dropoff_address}</Popup>
            </Marker>
          )}
          {route && route.length > 1 && <Polyline positions={route} color={carColor} weight={4} opacity={0.85} dashArray={ride.status === "assigned" ? "8,5" : undefined} />}
        </MapContainer>
      </div>
    </div>
  );
}
