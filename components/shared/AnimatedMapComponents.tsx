"use client";

import { useEffect, useRef } from 'react';
import { Marker as LeafletMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

interface AnimatedMarkerProps {
  position: [number, number];
  icon: L.DivIcon | L.Icon;
  children?: React.ReactNode;
  duration?: number; // duración de la animación en ms
  easing?: (t: number) => number; // función de easing
}

/**
 * Marcador con animación fluida para movimientos
 * Evita saltos bruscos al cambiar la posición
 */
export function AnimatedMarker({
  position,
  icon,
  children,
  duration = 1000,
  easing = (t) => t // linear easing
}: AnimatedMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const positionRef = useRef<[number, number]>(position);
  const animationRef = useRef<number | null>(null);

  // Actualizar posición con animación
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const [newLat, newLng] = position;
    const [currentLat, currentLng] = positionRef.current;

    // Si la posición no cambió, no hacer nada
    if (newLat === currentLat && newLng === currentLng) return;

    // Cancelar animación anterior
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = Date.now();
    const deltaLat = newLat - currentLat;
    const deltaLng = newLng - currentLng;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const currentLatAnim = currentLat + deltaLat * easedProgress;
      const currentLngAnim = currentLng + deltaLng * easedProgress;

      marker.setLatLng([currentLatAnim, currentLngAnim]);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animación completada
        positionRef.current = [newLat, newLng];
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [position, duration, easing]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <LeafletMarker
      ref={markerRef}
      position={position}
      icon={icon}
    >
      {children}
    </LeafletMarker>
  );
}

interface SmoothMapPannerProps {
  center: [number, number];
  zoom?: number;
  duration?: number;
}

/**
 * Componente para hacer pan suave del mapa
 */
export function SmoothMapPanner({ center, zoom, duration = 1000 }: SmoothMapPannerProps) {
  const map = useMap();
  const lastCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!center) return;

    const [lat, lng] = center;
    const lastCenter = lastCenterRef.current;

    // Si es el primer centro o cambió significativamente, hacer pan inmediato
    if (!lastCenter || Math.abs(lat - lastCenter[0]) > 0.001 || Math.abs(lng - lastCenter[1]) > 0.001) {
      map.panTo(center, {
        animate: true,
        duration: duration / 1000, // leaflet espera segundos
        easeLinearity: 0.1, // más suave
      });
      lastCenterRef.current = center;
    }
  }, [center, zoom, map, duration]);

  return null;
}

/**
 * Funciones de easing comunes
 */
export const easing = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOut: (t: number) => t * (2 - t),
  easeIn: (t: number) => t * t,
};