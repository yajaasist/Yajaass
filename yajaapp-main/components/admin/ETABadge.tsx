import React, { useState, useEffect, useRef } from "react";
import { Navigation } from "lucide-react";
import { supabaseApi } from "@/lib/supabaseApi";

function formatETA(minutes) {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}

async function fetchOSRMETA(fromLat, fromLon, toLat, toLon) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.routes?.[0]) {
    const durationSec = data.routes[0].duration;
    const distanceKm = data.routes[0].distance / 1000;
    return { minutes: Math.ceil(durationSec / 60), distKm: distanceKm };
  }
  return null;
}

/**
 * ETABadge — muestra ETA calculado via OSRM (ruta real), actualizado periódicamente.
 */
export default function ETABadge({ ride, driver: driverProp, settings, className = "" }) {
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [distKm, setDistKm] = useState(null);
  const [geocodedPickup, setGeocodedPickup] = useState(null);
  const timerRef = useRef(null);

  const pollSec = settings?.driver_location_update_interval_seconds ?? 15;

  // Geocode pickup address if no coordinates available
  useEffect(() => {
    if (ride?.pickup_lat || !ride?.pickup_address) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ride.pickup_address)}&limit=1`, { headers: { "Accept-Language": "es" } })
      .then(r => r.json())
      .then(data => {
        if (data[0]) setGeocodedPickup({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
      })
      .catch(() => {});
  }, [ride?.id, ride?.pickup_address, ride?.pickup_lat]);

  const pickupLat = ride?.pickup_lat || geocodedPickup?.lat;
  const pickupLon = ride?.pickup_lon || geocodedPickup?.lon;

  const shouldShow = ["assigned", "en_route", "arrived"].includes(ride?.status) && pickupLat && pickupLon;

  const refresh = async () => {
    if (!driverProp?.id) return;
    // Fetch fresh driver location from DB
    const d = await supabaseApi.drivers.get(driverProp.id);
    if (d?.latitude && d?.longitude && pickupLat && pickupLon) {
      const result = await fetchOSRMETA(d.latitude, d.longitude, pickupLat, pickupLon);
      if (result) {
        setEtaMinutes(result.minutes);
        setDistKm(result.distKm);
      }
    }
  };

  useEffect(() => {
    if (!shouldShow || !driverProp?.id) return;

    // Immediate calc using current driver props or DB fetch
    const calcImmediate = async () => {
      let lat = driverProp?.latitude;
      let lon = driverProp?.longitude;
      if (!lat || !lon) {
        const d = await supabaseApi.drivers.get(driverProp.id);
        lat = d?.latitude;
        lon = d?.longitude;
      }
      if (lat && lon && pickupLat && pickupLon) {
        const result = await fetchOSRMETA(lat, lon, pickupLat, pickupLon);
        if (result) { setEtaMinutes(result.minutes); setDistKm(result.distKm); }
      }
    };
    calcImmediate();

    timerRef.current = setInterval(refresh, pollSec * 1000);
    return () => clearInterval(timerRef.current);
  }, [ride?.id, ride?.status, driverProp?.id, pollSec, pickupLat, pickupLon]);

  if (!shouldShow) return null;
  const etaLabel = formatETA(etaMinutes);
  if (!etaLabel) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full ${className}`}>
      <Navigation className="w-3 h-3" />
      {etaLabel}
      {distKm !== null && distKm < 100 && (
        <span className="text-blue-500">· {distKm.toFixed(1)} km</span>
      )}
    </span>
  );
}
