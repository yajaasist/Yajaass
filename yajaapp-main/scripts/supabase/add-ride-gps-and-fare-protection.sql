-- Migration: GPS real del conductor + tarifa protegida
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ── ride_requests: GPS real inicio y fin del viaje ──────────────────────────
-- Guardados cuando el conductor presiona "Iniciar" y "Completar"
-- Usados para calcular distancia real y mostrar en el mapa del detalle

ALTER TABLE public.ride_requests
ADD COLUMN IF NOT EXISTS actual_start_lat double precision;

ALTER TABLE public.ride_requests
ADD COLUMN IF NOT EXISTS actual_start_lon double precision;

ALTER TABLE public.ride_requests
ADD COLUMN IF NOT EXISTS actual_end_lat double precision;

ALTER TABLE public.ride_requests
ADD COLUMN IF NOT EXISTS actual_end_lon double precision;

-- ── app_settings: tarifa protegida ──────────────────────────────────────────
-- fare_protection_enabled: si true, el precio final = precio estimado (congelado)
-- fare_protection_label:   texto que se muestra al pasajero ("Tarifa protegida")

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS fare_protection_enabled boolean DEFAULT false;

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS fare_protection_label text DEFAULT 'Tarifa protegida';
