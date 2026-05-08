-- Migration: columnas adicionales de app_settings
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Todas las sentencias usan ADD COLUMN IF NOT EXISTS — seguras de re-ejecutar

-- ── Información general ───────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS driver_app_instructions text;

-- ── Mapas y rutas ────────────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maps_provider text DEFAULT 'osrm';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS google_maps_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS city_traffic_factor numeric DEFAULT 1.0;

-- ── ETA / tiempos de actualización ───────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS eta_speed_kmh numeric DEFAULT 30;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS eta_update_interval_seconds integer DEFAULT 15;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS eta_modal_duration_seconds integer DEFAULT 15;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS eta_traffic_light_threshold_minutes numeric DEFAULT 20;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS eta_traffic_moderate_threshold_minutes numeric DEFAULT 40;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS eta_uncertainty_factor numeric DEFAULT 0.2;

-- ── App conductor ─────────────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS driver_arrival_radius_meters integer DEFAULT 50;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS driver_cancel_suspension_minutes integer DEFAULT 30;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS driver_offer_timeout_seconds integer DEFAULT 30;

-- ── App pasajero ─────────────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_active_rides_refetch_seconds integer DEFAULT 30;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_all_rides_refetch_seconds integer DEFAULT 60;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_live_ride_refetch_seconds integer DEFAULT 30;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_driver_refetch_seconds integer DEFAULT 15;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_offline_sync_interval_seconds integer DEFAULT 45;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_searching_title text DEFAULT 'Buscando conductor';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_searching_subtitle text DEFAULT 'Estamos encontrando el conductor más cercano para ti';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_no_drivers_title text DEFAULT 'Sin conductores disponibles';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_no_drivers_subtitle text DEFAULT 'No encontramos conductores disponibles en tu zona en este momento.';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_manual_assignment_prompt_title text DEFAULT '¿Solicitar asignación manual?';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_manual_assignment_prompt_subtitle text DEFAULT 'Un operador asignará el conductor manualmente.';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_manual_assignment_wait_title text DEFAULT 'Esperando asignación';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS passenger_manual_assignment_wait_subtitle text DEFAULT 'Tu solicitud fue enviada. Un agente asignará tu conductor en breve.';

-- ── Control de rechazos ───────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS rejection_rate_warning_threshold integer DEFAULT 60;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS rejection_count_threshold integer DEFAULT 5;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS soft_block_low_acceptance_rate_enabled boolean DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS low_acceptance_rate_threshold integer DEFAULT 60;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS low_acceptance_rate_offer_reduction_pct integer DEFAULT 90;

-- ── Subasta / asignación ──────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS auction_max_retries integer DEFAULT 3;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS max_concurrent_rides integer DEFAULT 1;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS search_phase_seconds integer DEFAULT 5;

-- ── Jornada laboral ───────────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS work_break_interval_minutes integer DEFAULT 60;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS work_break_duration_minutes integer DEFAULT 30;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS work_long_break_duration_minutes integer DEFAULT 360;

-- ── Notificaciones ────────────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS notification_sound_type text DEFAULT 'classic';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS notification_volume numeric DEFAULT 0.7;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS notification_interval_seconds integer DEFAULT 3;

-- ── Seguridad y privacidad ────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS require_email_verification boolean DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS show_passenger_phone_to_driver boolean DEFAULT true;

-- ── Finanzas ──────────────────────────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS cutoff_interval_days integer DEFAULT 7;

-- ── Datos estructurados (JSONB) ───────────────────────────────────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS extra_api_keys jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS landing_config jsonb DEFAULT '{}'::jsonb;
