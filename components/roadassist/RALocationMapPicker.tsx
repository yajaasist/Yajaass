import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CheckCircle, X, MapPin, Loader2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const editableIcon = new L.DivIcon({
  html: `<div style="position:relative;width:36px;height:36px">
    <div style="width:36px;height:36px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 3px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
    </div>
    <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #3B82F6;"></div>
  </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  className: "",
});

function DraggableMarker({ position, onMove }) {
  const markerRef = useRef(null);
  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const ll = marker.getLatLng();
        onMove(ll.lat, ll.lng);
      }
    },
  };
  return (
    <Marker
      draggable
      position={position}
      icon={editableIcon}
      ref={markerRef}
      eventHandlers={eventHandlers}
    />
  );
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ lat, lon }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (!lat || !lon) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (prevRef.current === key) return;
    prevRef.current = key;
    map.flyTo([lat, lon], 16, { duration: 1 });
  }, [lat, lon, map]);
  return null;
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: { "Accept-Language": "es" } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
}

/**
 * RALocationMapPicker
 * Props:
 *   initialLat, initialLon — starting pin position
 *   initialAddress        — starting label
 *   label                 — "Punto de recogida" | "Destino"
 *   onConfirm(address, lat, lon) — called when user taps "Confirmar"
 *   onClose()             — called when user cancels
 */
export default function RALocationMapPicker({ initialLat, initialLon, initialAddress, label = "Ubicación", onConfirm, onClose }) {
  const [lat, setLat] = useState(initialLat || 19.4326);
  const [lon, setLon] = useState(initialLon || -99.1332);
  const [address, setAddress] = useState(initialAddress || "");
  const [geocoding, setGeocoding] = useState(false);
  const debounceRef = useRef(null);

  const updatePosition = useCallback((newLat, newLon) => {
    setLat(newLat);
    setLon(newLon);
    setGeocoding(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const addr = await reverseGeocode(newLat, newLon);
      setAddress(addr);
      setGeocoding(false);
    }, 600);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-3 flex items-center justify-between bg-slate-900 border-b border-white/10">
        <div>
          <p className="text-white/50 text-xs">Ajustar ubicación</p>
          <h2 className="text-white font-bold text-base">{label}</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hint */}
      <div className="flex-shrink-0 bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 flex items-center gap-2">
        <Move className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <p className="text-blue-300/80 text-xs">Arrastra el pin o toca el mapa para ajustar la posición exacta</p>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[lat, lon]}
          zoom={16}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <DraggableMarker position={[lat, lon]} onMove={updatePosition} />
          <MapClickHandler onMapClick={updatePosition} />
          <MapFlyTo lat={lat} lon={lon} />
        </MapContainer>
      </div>

      {/* Bottom panel */}
      <div className="flex-shrink-0 bg-slate-800 border-t border-white/10 px-4 pt-3 pb-4 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {geocoding ? (
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Obteniendo dirección...
              </div>
            ) : (
              <p className="text-white/80 text-sm line-clamp-2">{address || "Sin dirección"}</p>
            )}
            <p className="text-white/30 text-xs mt-0.5">{lat.toFixed(6)}, {lon.toFixed(6)}</p>
          </div>
        </div>

        <Button
          disabled={geocoding}
          onClick={() => onConfirm(address, lat, lon)}
          className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl h-12 font-bold text-base"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Confirmar ubicación
        </Button>
      </div>
    </div>
  );
}
