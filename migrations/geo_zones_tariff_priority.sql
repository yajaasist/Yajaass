-- Migration: Add tariff priority fields to geo_zones
-- Description: Add service_tariff_priority and company_tariff_priority fields to control which tariff takes precedence

-- Check if columns exist before adding them
DO $$ 
BEGIN
  -- Add service_tariff_priority column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'geo_zones' AND column_name = 'service_tariff_priority'
  ) THEN
    ALTER TABLE public.geo_zones 
    ADD COLUMN service_tariff_priority TEXT DEFAULT 'zone' 
    CHECK (service_tariff_priority IN ('zone', 'service'));
    
    COMMENT ON COLUMN public.geo_zones.service_tariff_priority IS 
    'Tariff priority for normal services: "zone" uses zone tariff, "service" uses service general tariff';
  END IF;

  -- Add company_tariff_priority column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'geo_zones' AND column_name = 'company_tariff_priority'
  ) THEN
    ALTER TABLE public.geo_zones 
    ADD COLUMN company_tariff_priority TEXT DEFAULT 'zone' 
    CHECK (company_tariff_priority IN ('zone', 'company'));
    
    COMMENT ON COLUMN public.geo_zones.company_tariff_priority IS 
    'Tariff priority for company services: "zone" respects zone tariff, "company" respects company tariff';
  END IF;

END $$;
