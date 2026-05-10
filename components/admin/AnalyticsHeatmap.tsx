"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type HeatPoint = [number, number, number];

type AnalyticsHeatmapProps = {
  points: HeatPoint[];
  center: [number, number];
};

declare global {
  interface Window {
    L?: typeof L & {
      heatLayer?: (points: HeatPoint[], options?: Record<string, any>) => any;
    };
  }
}

async function ensureHeat() {
  if (typeof window === "undefined") return;
  if (window.L?.heatLayer) return;

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar leaflet.heat"));
    document.head.appendChild(s);
  });
}

function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    if (!points || points.length === 0) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    ensureHeat()
      .then(() => {
        if (cancelled) return;

        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }

        if (window.L?.heatLayer) {
          layerRef.current = window.L.heatLayer(points, {
            radius: 30,
            blur: 20,
            maxZoom: 17,
            gradient: {
              0.2: "#3B82F6",
              0.5: "#F59E0B",
              0.8: "#EF4444",
              1.0: "#7C3AED",
            },
          }).addTo(map);
        }
      })
      .catch(() => {
        // Si falla el script externo, solo omitimos la capa de calor.
      });

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [points, map]);

  return null;
}

function FitBounds({ points }: { points: HeatPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(points.map(([lat, lng]) => [lat, lng])), { padding: [40, 40] });
      } catch {
        // Evita romper render si hay coordenadas inválidas.
      }
    }
  }, [points, map]);

  return null;
}

export default function AnalyticsHeatmap({ points, center }: AnalyticsHeatmapProps) {
  return (
    <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <HeatLayer points={points} />
      <FitBounds points={points} />
    </MapContainer>
  );
}
