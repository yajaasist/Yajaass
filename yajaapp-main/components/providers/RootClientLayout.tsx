"use client"

import React, { ReactNode, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClientInstance } from "@/lib/query-client"
import { Toaster } from "@/components/ui/toaster"
import { supabaseApi } from "@/lib/supabaseApi"
import { syncBrandHead } from "@/components/shared/brandHead"

interface RootClientLayoutProps {
  children: ReactNode
}

function RootBrandingSync() {
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const data = await supabaseApi.settings.list();
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const settings = settingsList[0] as any;

  useEffect(() => {
    const company = settings?.company_name?.trim() || "YAJA Asistencia";
    const shouldApplyFallbackTitle = !document.title || document.title.includes("Panel Administrativo");
    return syncBrandHead({
      title: shouldApplyFallbackTitle ? company : undefined,
      logoUrl: settings?.logo_url,
      appName: company,
      cacheSeed: settings?.updated_at || settings?.updated_date || company,
    });
  }, [settings?.company_name, settings?.logo_url, settings?.updated_at, settings?.updated_date]);

  return null;
}

export function RootClientLayout({ children }: RootClientLayoutProps) {
  useEffect(() => {
    // Keep this effect for future migration hooks.
  }, []);

  return (
    <QueryClientProvider client={queryClientInstance}>
      <RootBrandingSync />
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}
