/**
 * useDynamicETA.ts
 * 
 * Hook que actualiza el ETA dinámicamente mientras el viaje está en progreso
 * Considera cambios de tráfico y actualiza cada N segundos
 */
"use client";

import { useEffect, useState } from "react";
import { getRoute, getHaverDist } from "@/components/shared/mapsUtils";

export interface ETAInfo {
  distanceKm: number;
  durationMin: number;
  lastUpdated: Date;
  updateCounter: number; // Track how many updates have occurred
  trafficStatus?: "light" | "moderate" | "heavy"; // Inferred from ETA changes
}

interface UseDynamicETAProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  enabled?: boolean;
  updateIntervalSec?: number; // How often to re-fetch route (default 30s)
  trafficLightThresholdMin?: number;
  trafficModerateThresholdMin?: number;
  mapsProvider?: string;
  googleMapsApiKey?: string;
}

const DEFAULT_UPDATE_INTERVAL = 30; // seconds

export function useDynamicETA({
  originLat,
  originLng,
  destLat,
  destLng,
  enabled = true,
  updateIntervalSec = DEFAULT_UPDATE_INTERVAL,
  trafficLightThresholdMin = 20,
  trafficModerateThresholdMin = 40,
  mapsProvider = "osrm",
  googleMapsApiKey,
}: UseDynamicETAProps): ETAInfo | null {
  const [eta, setETA] = useState<ETAInfo | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    if (!enabled || !originLat || !originLng || !destLat || !destLng) {
      setETA(null);
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const updateETA = async () => {
      try {
        const route = await getRoute(
          originLat,
          originLng,
          destLat,
          destLng,
          mapsProvider,
          googleMapsApiKey
        );

        if (isMounted) {
          if (route) {
            setETA({
              distanceKm: route.distKm,
              durationMin: route.durationMin,
              lastUpdated: new Date(),
              updateCounter: updateCount + 1,
              trafficStatus: inferTrafficStatus(route.durationMin, trafficLightThresholdMin, trafficModerateThresholdMin),
            });
          } else {
            // Fallback to haversine if route service fails
            const distKm = getHaverDist(
              originLat,
              originLng,
              destLat,
              destLng
            );
            if (distKm) {
              const estimatedSpeed = 30; // km/h default
              const durationMin = Math.ceil((distKm / estimatedSpeed) * 60);
              setETA({
                distanceKm: distKm,
                durationMin: durationMin,
                lastUpdated: new Date(),
                updateCounter: updateCount + 1,
                trafficStatus: undefined,
              });
            }
          }
          setUpdateCount((c) => c + 1);
        }
      } catch (err) {
        console.log("[ETA] Update failed (non-critical):", err);
        // Keep previous ETA in case of transient error
      }

      if (isMounted) {
        timeoutId = setTimeout(updateETA, updateIntervalSec * 1000);
      }
    };

    // Initial update
    updateETA();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [originLat, originLng, destLat, destLng, enabled, updateIntervalSec, mapsProvider, googleMapsApiKey, trafficLightThresholdMin, trafficModerateThresholdMin]);

  return eta;
}

/**
 * Infer traffic status from ETA changes
 * Light: < 20 min
 * Moderate: 20-40 min
 * Heavy: > 40 min
 */
function inferTrafficStatus(
  durationMin: number,
  lightThresholdMin: number,
  moderateThresholdMin: number
): "light" | "moderate" | "heavy" {
  if (durationMin < lightThresholdMin) return "light";
  if (durationMin < moderateThresholdMin) return "moderate";
  return "heavy";
}

/**
 * Format ETA for display: "5-10 min" or "15 min"
 */
export function formatETARange(
  eta: ETAInfo | null,
  trafficUncertainty: number = 0.2 // ±20% uncertainty
): string {
  if (!eta) return "Calculando...";

  const base = eta.durationMin;
  const minEst = Math.max(1, Math.floor(base * (1 - trafficUncertainty)));
  const maxEst = Math.ceil(base * (1 + trafficUncertainty));

  if (minEst === maxEst) {
    return `${base} min`;
  }
  return `${minEst}-${maxEst} min`;
}

/**
 * Get emoji for traffic status
 */
export function getTrafficEmoji(status?: "light" | "moderate" | "heavy"): string {
  switch (status) {
    case "light":
      return "🟢"; // Green
    case "moderate":
      return "🟡"; // Yellow
    case "heavy":
      return "🔴"; // Red
    default:
      return "⚪"; // Gray
  }
}
