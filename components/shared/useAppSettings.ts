"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { setSystemTimezone } from "@/components/shared/dateUtils";

const DEFAULT_COMPANY_NAME = "YAJA Asistencia";

function normalizeCompanyName(rawName?: string) {
  const name = String(rawName || "").trim();
  if (!name) return DEFAULT_COMPANY_NAME;
  if (/^ride\s*flow$/i.test(name)) return DEFAULT_COMPANY_NAME;
  return name;
}

export default function useAppSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    initialData: [],
  });

  const settings = useMemo(() => {
    const baseSettings = data?.[0] || {
      company_name: DEFAULT_COMPANY_NAME,
      primary_color: "#0F172A",
      accent_color: "#3B82F6",
      secondary_color: "#10B981",
      currency: "MXN",
      timezone: "America/Mexico_City",
    };

    return {
      ...baseSettings,
      company_name: normalizeCompanyName(baseSettings?.company_name),
    };
  }, [data]);

  useEffect(() => {
    if (settings?.timezone) {
      setSystemTimezone(settings.timezone);
    }
  }, [settings?.timezone]);

  return { settings, isLoading };
}