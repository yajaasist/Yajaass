"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { Map, EyeOff, Edit3 } from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

function FitBounds({ pickup, dropoff }) {
  const map = useMap();
  useEffect(() => {
    const points: LatLngTuple[] = [];
    if (pickup?.lat) points.push([pickup.lat, pickup.lon || pickup.lng]);
    if (dropoff?.lat) points.push([dropoff.lat, dropoff.lon || dropoff.lng]);
    if (points.length === 2) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [pickup?.lat, pickup?.lon, pickup?.lng, dropoff?.lat, dropoff?.lon, dropoff?.lng]);
  return null;
}

/**
 * MapPreview
 * Props:
 *   pickup, dropoff - { lat, lon/lng }
 *   routePoints - [[lat,lon],...] polyline from OSRM
 *   height - number
 *   onAdjustPickup() - callback to open map picker for origin
 *   onAdjustDropoff() - callback to open map picker for destination
 */
export default function MapPreview({ pickup, dropoff, routePoints, height = 220, onAdjustPickup, onAdjustDropoff }) {
  const [visible, setVisible] = useState(true);
  const hasPickup = pickup?.lat && (pickup?.lon || pickup?.lng);
  const hasDropoff = dropoff?.lat && (dropoff?.lon || dropoff?.lng);

  const pickupLon = pickup?.lon || pickup?.lng;
  const dropoffLon = dropoff?.lon || dropoff?.lng;

  if (!hasPickup && !hasDropoff) {
    return (
      <div className="bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm" style={{ height: 60 }}>
        <Map className="w-4 h-4 mr-2" /> Ingresa una dirección para ver el mapa
      </div>
    );
  }

  const center: LatLngTuple = hasPickup ? [pickup.lat, pickupLon] : [dropoff.lat, dropoffLon];

  return (
    <div className="space-y-1">
      {/* Adjust buttons */}
      {(onAdjustPickup || onAdjustDropoff) && (
        <div className="flex gap-2">
          {hasPickup && onAdjustPickup && (
            <button
              type="button"
              onClick={onAdjustPickup}
              className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Edit3 className="w-3 h-3" /> Ajustar origen en mapa
            </button>
          )}
          {hasDropoff && onAdjustDropoff && (
            <button
              type="button"
              onClick={onAdjustDropoff}
              className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Edit3 className="w-3 h-3" /> Ajustar destino en mapa
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute top-2 right-2 z-[1000] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          {visible ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar</> : <><Map className="w-3.5 h-3.5" /> Mostrar mapa</>}
        </button>

        {visible ? (
          <div style={{ height }} className="rounded-xl overflow-hidden border border-slate-200">
            <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <FitBounds pickup={pickup} dropoff={dropoff} />
              {hasPickup && (
                <Marker position={[pickup.lat, pickupLon]} icon={greenIcon}>
                  <Popup>📍 Origen</Popup>
                </Marker>
              )}
              {hasDropoff && (
                <Marker position={[dropoff.lat, dropoffLon]} icon={redIcon}>
                  <Popup>🏁 Destino</Popup>
                </Marker>
              )}
              {routePoints && routePoints.length > 1 && (
                <Polyline positions={routePoints} pathOptions={{ color: "#3B82F6", weight: 4, opacity: 0.7 }} />
              )}
            </MapContainer>
          </div>
        ) : (
          <div
            className="bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm cursor-pointer hover:bg-slate-200 transition-colors"
            style={{ height: 48 }}
            onClick={() => setVisible(true)}
          >
            <Map className="w-4 h-4 mr-2" /> Mapa oculto — clic para mostrar
          </div>
        )}
      </div>
    </div>
  );
}
