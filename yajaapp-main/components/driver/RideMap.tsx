import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { Navigation, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOSRMRoute, getGoogleMapsRoute } from "@/components/shared/mapsUtils";
import useAppSettings from "@/components/shared/useAppSettings";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
export const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

// Blue car icon for driver position
const driverIcon = new L.DivIcon({
  html: `<div style="background:#3B82F6;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9], className: "",
});

async function geocode(address) {
  if (!address) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  const data = await res.json();
  if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  return null;
}

// Auto-recenter map when driver moves
function MapRecenter({ center }: { center: LatLngTuple }) {
  const map = useMap();
  const prevCenter = useRef(null);
  useEffect(() => {
    if (!center) return;
    const [lat, lon] = center;
    if (!prevCenter.current || Math.abs(prevCenter.current[0] - lat) > 0.0005 || Math.abs(prevCenter.current[1] - lon) > 0.0005) {
      map.panTo(center, { animate: true, duration: 0.8 });
      prevCenter.current = center;
    }
  }, [center, map]);
  return null;
}

// ETA badge overlay
function ETABadge({ durationMin, inTraffic }) {
  if (!durationMin) return null;
  const h = Math.floor(durationMin / 60);
  const m = durationMin % 60;
  const label = h > 0 ? `${h}h ${m}min` : `${m} min`;
  return (
    <div className="absolute top-2 left-2 z-[999] bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-1.5 border border-slate-100">
      <Clock className="w-3.5 h-3.5 text-blue-500" />
      <span className="text-xs font-bold text-slate-800">{label}</span>
      {inTraffic && <span className="text-[9px] text-orange-500 font-semibold">con tráfico</span>}
    </div>
  );
}

export default function RideMap({ ride, fullScreen = false, driverLocation = null }) {
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const { settings } = useAppSettings();
  const lastRouteFetchRef = useRef(null);

  // Geocode addresses
  useEffect(() => {
    if (ride.pickup_lat && ride.pickup_lon) {
      setPickupCoords({ lat: ride.pickup_lat, lon: ride.pickup_lon });
    } else if (ride.pickup_address) {
      geocode(ride.pickup_address).then(setPickupCoords);
    }
    if (ride.dropoff_lat && ride.dropoff_lon) {
      setDropoffCoords({ lat: ride.dropoff_lat, lon: ride.dropoff_lon });
    } else if (ride.dropoff_address) {
      geocode(ride.dropoff_address).then(setDropoffCoords);
    }
  }, [ride.pickup_address, ride.dropoff_address, ride.pickup_lat, ride.pickup_lon, ride.dropoff_lat, ride.dropoff_lon]);

  // Fetch route: from driver → pickup (en_route) or pickup → dropoff (in_progress/arrived)
  useEffect(() => {
    if (!fullScreen) return;

    const isEnRoute = ["en_route", "assigned"].includes(ride.status);
    const isInProgress = ["arrived", "admin_approved", "in_progress"].includes(ride.status);

    let originLat, originLon, destLat, destLon;

    if (isEnRoute && driverLocation && pickupCoords) {
      originLat = driverLocation.lat; originLon = driverLocation.lon;
      destLat = pickupCoords.lat; destLon = pickupCoords.lon;
    } else if (isInProgress && pickupCoords && dropoffCoords) {
      originLat = pickupCoords.lat; originLon = pickupCoords.lon;
      destLat = dropoffCoords.lat; destLon = dropoffCoords.lon;
    } else if (pickupCoords && dropoffCoords) {
      originLat = pickupCoords.lat; originLon = pickupCoords.lon;
      destLat = dropoffCoords.lat; destLon = dropoffCoords.lon;
    } else {
      return;
    }

    // Throttle: configurable route refresh interval from settings.
    const routeRefreshMs = Math.max(3000, Number(settings?.eta_update_interval_seconds ?? 15) * 1000);
    const key = `${originLat?.toFixed(3)},${originLon?.toFixed(3)},${destLat?.toFixed(3)},${destLon?.toFixed(3)}`;
    const now = Date.now();
    if (lastRouteFetchRef.current?.key === key && now - lastRouteFetchRef.current.ts < routeRefreshMs) return;
    lastRouteFetchRef.current = { key, ts: now };

    setLoadingRoute(true);
    const provider = settings?.maps_provider || "osrm";
    const apiKey = settings?.google_maps_api_key || null;

    const fetchRoute = provider === "google_maps" && apiKey
      ? getGoogleMapsRoute(originLat, originLon, destLat, destLon, apiKey)
      : getOSRMRoute(originLat, originLon, destLat, destLon);

    fetchRoute.then(result => {
      setLoadingRoute(false);
      if (result?.polyline?.length) {
        setRoutePolyline(result.polyline);
        setRouteInfo({ durationMin: result.durationMin, inTraffic: result.durationInTraffic });
      }
    }).catch(() => setLoadingRoute(false));
  }, [
    fullScreen, ride.status,
    driverLocation?.lat, driverLocation?.lon,
    pickupCoords?.lat, pickupCoords?.lon,
    dropoffCoords?.lat, dropoffCoords?.lon,
    settings?.maps_provider, settings?.google_maps_api_key, settings?.eta_update_interval_seconds,
  ]);

  // Determine map center: prioritize driver location, then pickup, then dropoff
  const centerCoords: LatLngTuple = driverLocation
    ? [driverLocation.lat, driverLocation.lon]
    : pickupCoords
    ? [pickupCoords.lat, pickupCoords.lon]
    : dropoffCoords
    ? [dropoffCoords.lat, dropoffCoords.lon]
    : [19.4326, -99.1332];

  if (fullScreen) {
    return (
      <div style={{ height: "100%", width: "100%", position: "relative" }}>
        {routeInfo && <ETABadge durationMin={routeInfo.durationMin} inTraffic={routeInfo.inTraffic} />}
        {loadingRoute && (
          <div className="absolute top-2 right-2 z-[999] bg-white/90 rounded-xl px-2 py-1 flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-slate-500">Calculando ruta...</span>
          </div>
        )}
        <MapContainer center={centerCoords} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl={false} dragging={true}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {/* Center on pickup when just accepted (assigned), center on driver when en_route */}
          {['assigned'].includes(ride.status) && pickupCoords
            ? <MapRecenter center={[pickupCoords.lat, pickupCoords.lon]} />
            : driverLocation && <MapRecenter center={[driverLocation.lat, driverLocation.lon]} />
          }
          {/* Driver position */}
          {driverLocation && (
            <Marker position={[driverLocation.lat, driverLocation.lon]} icon={driverIcon}>
              <Popup>🚗 Tu posición</Popup>
            </Marker>
          )}
          {pickupCoords && <Marker position={[pickupCoords.lat, pickupCoords.lon]} icon={greenIcon}><Popup>📍 Punto de recogida</Popup></Marker>}
          {dropoffCoords && <Marker position={[dropoffCoords.lat, dropoffCoords.lon]} icon={redIcon}><Popup>🏁 Destino</Popup></Marker>}
        </MapContainer>
        <div className="absolute bottom-2 left-2 right-2 flex gap-2 z-[999]">
          {pickupCoords && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${pickupCoords.lat},${pickupCoords.lon}`} target="_blank" rel="noreferrer" className="flex-1">
              <div className="bg-white/95 backdrop-blur text-emerald-700 text-xs font-semibold text-center py-2.5 rounded-xl shadow border border-emerald-100 flex items-center justify-center gap-1.5 min-h-[44px]">
                <Navigation className="w-3.5 h-3.5" /> Ir a recogida
              </div>
            </a>
          )}
          {dropoffCoords && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${dropoffCoords.lat},${dropoffCoords.lon}`} target="_blank" rel="noreferrer" className="flex-1">
              <div className="bg-white/95 backdrop-blur text-red-700 text-xs font-semibold text-center py-2.5 rounded-xl shadow border border-red-100 flex items-center justify-center gap-1.5 min-h-[44px]">
                <ExternalLink className="w-3.5 h-3.5" /> Ir al destino
              </div>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Compact (non-fullscreen) version — no route, just markers
  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-slate-200 mb-2" style={{ height: 180 }}>
        <MapContainer center={centerCoords} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {pickupCoords && <Marker position={[pickupCoords.lat, pickupCoords.lon]} icon={greenIcon}><Popup>Recoger aquí</Popup></Marker>}
          {dropoffCoords && <Marker position={[dropoffCoords.lat, dropoffCoords.lon]} icon={redIcon}><Popup>Destino</Popup></Marker>}
        </MapContainer>
      </div>
      <div className="flex gap-2">
        {pickupCoords && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${pickupCoords.lat},${pickupCoords.lon}`} target="_blank" rel="noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 select-none min-h-[44px]">
              <Navigation className="w-3.5 h-3.5 mr-1" /> Ir a recogida
            </Button>
          </a>
        )}
        {dropoffCoords && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${dropoffCoords.lat},${dropoffCoords.lon}`} target="_blank" rel="noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs rounded-lg border-red-200 text-red-700 hover:bg-red-50 select-none min-h-[44px]">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ir al destino
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
