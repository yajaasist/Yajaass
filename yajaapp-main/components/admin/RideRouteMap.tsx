"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { Clock, MapPin, CheckCircle2, XCircle, Car, Navigation, User, AlertCircle } from "lucide-react";
import { formatCDMX } from "@/components/shared/dateUtils";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Person icon for pickup (requested origin)
const pickupIcon = L.divIcon({
  html: `<div style="background:#10B981;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
      <circle cx="12" cy="7" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
    </svg>
  </div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -38],
});

// Flag icon for dropoff (requested destination)
const dropoffIcon = L.divIcon({
  html: `<div style="background:#EF4444;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  </div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -38],
});

// Car icon for actual trip start (GPS when driver pressed "Iniciar")
const actualStartIcon = L.divIcon({
  html: `<div style="background:#6366F1;width:34px;height:34px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v7a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  </div>`,
  className: "", iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -36],
});

// Check icon for actual trip end (GPS when driver pressed "Completar")
const actualEndIcon = L.divIcon({
  html: `<div style="background:#F59E0B;width:34px;height:34px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>`,
  className: "", iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -36],
});

// Auto-fit bounds when both points are present
function FitBounds({ pickup, dropoff }: { pickup: LatLngTuple | null; dropoff: LatLngTuple | null }) {
  const map = useMap();
  useEffect(() => {
    if (pickup && dropoff) {
      map.fitBounds([pickup, dropoff], { padding: [40, 40] });
    } else if (pickup) {
      map.setView(pickup, 15);
    }
  }, [pickup?.[0], pickup?.[1], dropoff?.[0], dropoff?.[1]]);
  return null;
}

function buildEventLog(ride) {
  const events = [];
  const add = (ts, label, icon, color) => { if (ts) events.push({ ts: new Date(ts), label, icon, color }); };

  add(ride.requested_at || ride.created_date, "Servicio solicitado", "request", "blue");
  add(ride.en_route_at, "Conductor en camino", "enroute", "amber");
  add(ride.arrived_at, "Conductor llegó al origen", "arrived", "orange");
  add(ride.in_progress_at, "Viaje iniciado", "started", "violet");
  add(ride.completed_at, "Viaje completado", "completed", "emerald");

  if (ride.status === "cancelled") {
    const cTs = ride.updated_date || ride.created_date;
    add(cTs, `Cancelado por ${ride.cancelled_by || "—"}${ride.cancellation_reason ? `: ${ride.cancellation_reason}` : ""}`, "cancelled", "red");
  }

  if (ride.scheduled_time) {
    add(ride.scheduled_time, "Hora programada del servicio", "scheduled", "slate");
  }

  return events.sort((a, b) => a.ts - b.ts);
}

const eventIconMap = {
  request: <User className="w-3.5 h-3.5" />,
  enroute: <Navigation className="w-3.5 h-3.5" />,
  arrived: <MapPin className="w-3.5 h-3.5" />,
  started: <Car className="w-3.5 h-3.5" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5" />,
  cancelled: <XCircle className="w-3.5 h-3.5" />,
  scheduled: <Clock className="w-3.5 h-3.5" />,
};

const colorMap = {
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
  red: "bg-red-100 text-red-600 border-red-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

const dotColor = {
  blue: "bg-blue-500", amber: "bg-amber-500", orange: "bg-orange-500",
  violet: "bg-violet-500", emerald: "bg-emerald-500", red: "bg-red-500", slate: "bg-slate-400",
};

export default function RideRouteMap({ ride }) {
  const [route, setRoute] = useState(null);

  const hasPickup = ride && ride.pickup_lat && ride.pickup_lon;
  const hasDropoff = ride && ride.dropoff_lat && ride.dropoff_lon;

  // Actual GPS coords recorded by driver when trip started/ended
  const audit = ride?.extra_charges?.pricing_audit;
  const hasActualStart = !!(audit?.actual_start_lat && audit?.actual_start_lon)
    || !!(ride?.actual_start_lat && ride?.actual_start_lon);
  const hasActualEnd = !!(audit?.actual_end_lat && audit?.actual_end_lon)
    || !!(ride?.actual_end_lat && ride?.actual_end_lon);

  const actualStartPos: LatLngTuple | null = hasActualStart
    ? [(audit?.actual_start_lat ?? ride.actual_start_lat), (audit?.actual_start_lon ?? ride.actual_start_lon)]
    : null;
  const actualEndPos: LatLngTuple | null = hasActualEnd
    ? [(audit?.actual_end_lat ?? ride.actual_end_lat), (audit?.actual_end_lon ?? ride.actual_end_lon)]
    : null;

  // For route polyline: prefer actual GPS points, fall back to pickup/dropoff addresses
  const routeFromLat = actualStartPos ? actualStartPos[0] : ride?.pickup_lat;
  const routeFromLon = actualStartPos ? actualStartPos[1] : ride?.pickup_lon;
  const routeToLat = actualEndPos ? actualEndPos[0] : ride?.dropoff_lat;
  const routeToLon = actualEndPos ? actualEndPos[1] : ride?.dropoff_lon;

  const events = ride ? buildEventLog(ride) : [];

  useEffect(() => {
    if (!routeFromLat || !routeFromLon || !routeToLat || !routeToLon) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${routeFromLon},${routeFromLat};${routeToLon},${routeToLat}?overview=full&geometries=geojson`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (coords) setRoute(coords.map(([lng, lat]) => [lat, lng]));
      })
      .catch(() => {});
  }, [routeFromLat, routeFromLon, routeToLat, routeToLon]);

  if (!ride) return null;

  const center: LatLngTuple | null = actualStartPos ?? (hasPickup ? [ride.pickup_lat, ride.pickup_lon] : hasDropoff ? [ride.dropoff_lat, ride.dropoff_lon] : null);

  const pickupPos: LatLngTuple | null = hasPickup ? [ride.pickup_lat, ride.pickup_lon] : null;
  const dropoffPos: LatLngTuple | null = hasDropoff ? [ride.dropoff_lat, ride.dropoff_lon] : null;

  // FitBounds: prefer actual start/end, else pickup/dropoff
  const fitA = actualStartPos ?? pickupPos;
  const fitB = actualEndPos ?? dropoffPos;

  return (
    <div className="space-y-4">
      {/* Map */}
      {center ? (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
            {hasActualStart && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Inicio real</span>}
            {hasActualEnd && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Fin real</span>}
            {hasPickup && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Origen solicitado</span>}
            {hasDropoff && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Destino solicitado</span>}
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-200 h-52">
            <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              <FitBounds pickup={fitA} dropoff={fitB} />
              {/* Actual GPS start marker (purple/indigo) */}
              {actualStartPos && (
                <Marker position={actualStartPos} icon={actualStartIcon}>
                  <Popup><span className="text-xs font-medium">🚗 Inicio real del viaje<br />GPS conductor al presionar iniciar</span></Popup>
                </Marker>
              )}
              {/* Actual GPS end marker (amber) */}
              {actualEndPos && (
                <Marker position={actualEndPos} icon={actualEndIcon}>
                  <Popup><span className="text-xs font-medium">✅ Fin real del viaje<br />GPS conductor al completar</span></Popup>
                </Marker>
              )}
              {/* Requested pickup (green) — show only if different from actual start or no actual start */}
              {hasPickup && !hasActualStart && (
                <Marker position={pickupPos} icon={pickupIcon}>
                  <Popup><span className="text-xs font-medium">👤 Origen solicitado<br />{ride.pickup_address}</span></Popup>
                </Marker>
              )}
              {/* Requested dropoff (red) — show only if different from actual end or no actual end */}
              {hasDropoff && !hasActualEnd && (
                <Marker position={dropoffPos} icon={dropoffIcon}>
                  <Popup><span className="text-xs font-medium">🏁 Destino solicitado<br />{ride.dropoff_address}</span></Popup>
                </Marker>
              )}
              {route && <Polyline positions={route} color="#6366F1" weight={4} opacity={0.8} />}
            </MapContainer>
          </div>
        </>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-1">
          <AlertCircle className="w-5 h-5 opacity-40" />
          Sin coordenadas GPS disponibles para este servicio
        </div>
      )}

      {/* Event log */}
      {events.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Log de eventos</p>
          <div className="space-y-2">
            {events.map((ev, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${colorMap[ev.color]}`}>
                    {eventIconMap[ev.icon]}
                  </div>
                  {i < events.length - 1 && <div className="w-px h-4 bg-slate-200 mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-xs font-medium text-slate-800 leading-tight">{ev.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{formatCDMX(ev.ts, "datetime")}</p>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${dotColor[ev.color]}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
