  -- Backend auto-assign checklist (manual execution in Supabase SQL Editor)
-- 1) Ensure required settings columns exist (already executed if you ran previous script)
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS auto_primary_radius_km numeric DEFAULT 5;

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS auto_secondary_radius_km numeric DEFAULT 8;

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS total_search_window_seconds integer DEFAULT 180;

-- Needed by auto-assign deduplication and trigger comparisons
ALTER TABLE public.ride_requests
ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

UPDATE public.app_settings
SET
  auto_primary_radius_km = COALESCE(auto_primary_radius_km, auction_primary_radius_km, 5),
  auto_secondary_radius_km = COALESCE(auto_secondary_radius_km, auction_secondary_radius_km, 8),
  total_search_window_seconds = COALESCE(total_search_window_seconds, 180);

-- 2) Optional safety constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_total_search_window_seconds_check'
  ) THEN
    ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_total_search_window_seconds_check
    CHECK (total_search_window_seconds IS NULL OR total_search_window_seconds >= 30);
  END IF;
END $$;

-- 3) IMPORTANT:
-- Deploy your backend assignment worker (Edge Function or server worker).
-- When backend worker is active and stable, set this env var in frontend deployment:
-- NEXT_PUBLIC_BACKEND_AUTO_ASSIGN_ENABLED=true
-- This disables the panel-driven assignment hook and avoids duplicate assignment engines.

-- 4) Optional but recommended: emit driver broadcast notifications from backend updates
-- This powers channel: driver:{driver_id}:incoming-rides
-- and event: new_ride_notification / UPDATE

CREATE OR REPLACE FUNCTION public.emit_driver_new_ride_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_driver_id text;
  topic text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Direct assignment notification
  IF NEW.status = 'assigned'
     AND NEW.driver_id IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.driver_id IS DISTINCT FROM NEW.driver_id
       OR COALESCE(to_jsonb(OLD)->>'assigned_at', '') IS DISTINCT FROM COALESCE(to_jsonb(NEW)->>'assigned_at', '')
     ) THEN
    topic := format('driver:%s:incoming-rides', NEW.driver_id::text);

    BEGIN
      PERFORM realtime.broadcast_changes(
        topic::text,
        'new_ride_notification'::text,
        'UPDATE'::text,
        TG_TABLE_NAME::text,
        TG_TABLE_SCHEMA::text,
        jsonb_build_object(
          'ride_id', NEW.id,
          'notification_type', 'ride_assigned',
          'ride_data', row_to_json(NEW)
        ),
        jsonb_build_object(
          'ride_id', OLD.id,
          'notification_type', 'ride_assigned',
          'ride_data', row_to_json(OLD)
        )
      );
    EXCEPTION WHEN undefined_function THEN
      -- Keep ride updates working even if realtime.broadcast_changes is unavailable
      NULL;
    END;
  END IF;

  -- Auction offer notification for newly included drivers
  IF NEW.status = 'auction' AND NEW.auction_driver_ids IS NOT NULL THEN
    FOREACH target_driver_id IN ARRAY NEW.auction_driver_ids LOOP
      IF OLD.auction_driver_ids IS NULL
         OR NOT (target_driver_id = ANY(OLD.auction_driver_ids))
         OR OLD.status IS DISTINCT FROM NEW.status
         OR OLD.auction_expires_at IS DISTINCT FROM NEW.auction_expires_at THEN
        topic := format('driver:%s:incoming-rides', target_driver_id);

        BEGIN
          PERFORM realtime.broadcast_changes(
            topic::text,
            'new_ride_notification'::text,
            'UPDATE'::text,
            TG_TABLE_NAME::text,
            TG_TABLE_SCHEMA::text,
            jsonb_build_object(
              'ride_id', NEW.id,
              'notification_type', 'ride_offer',
              'ride_data', row_to_json(NEW)
            ),
            jsonb_build_object(
              'ride_id', OLD.id,
              'notification_type', 'ride_offer',
              'ride_data', row_to_json(OLD)
            )
          );
        EXCEPTION WHEN undefined_function THEN
          -- Keep ride updates working even if realtime.broadcast_changes is unavailable
          NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_driver_new_ride_broadcast ON public.ride_requests;

CREATE TRIGGER trg_emit_driver_new_ride_broadcast
AFTER UPDATE ON public.ride_requests
FOR EACH ROW
EXECUTE FUNCTION public.emit_driver_new_ride_broadcast();
