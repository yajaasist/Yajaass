"use client"

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createPageUrl } from "@/utils";
import { setSystemTimezone } from "@/components/shared/dateUtils";
import { Menu, X, Share2, LogOut, ChevronDown, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import useAppSettings from "@/components/shared/useAppSettings";
import { useAdminSession, PUBLIC_PAGES } from "@/components/shared/useAdminSession";
import { ALL_PAGES, DEFAULT_NAV_CONFIG } from "@/components/shared/navPages";
import useAdminBadges from "@/components/shared/useAdminBadges";
import useRideAutoAssign from "@/components/shared/useRideAutoAssign";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";

function hexToRgb(hex: string) {
  const raw = String(hex || "").replace("#", "").trim();
  const normalized = raw.length === 3
    ? raw.split("").map((ch) => `${ch}${ch}`).join("")
    : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { r: 59, g: 130, b: 246 };
  }

  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hexToHslTuple(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return `${h} ${s}% ${l}%`;
}

function getReadableForeground(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "0 0% 9%" : "0 0% 98%";
}

// ─── Update PWA title per app context ────────────────────────────────────────
// The static /public/manifest.json handles the full PWA definition.
// This hook only updates the iOS title meta tag dynamically.
const PAGE_TITLES: Record<string, string> = {
  Dashboard: "Panel de control",
  Analytics: "Analíticas",
  LiveDrivers: "En vivo",
  Drivers: "Conductores",
  Passengers: "Clientes / Pasajeros",
  Chats: "Chats",
  SOSAlerts: "Alertas SOS",
  SupportTickets: "Tickets de soporte",
  OfflineReconciliation: "Conciliación offline",
  Notificaciones: "Notificaciones",
  Anuncios: "Anuncios",
  DriverEarnings: "Ganancias conductores",
  Earnings: "Ganancias plataforma",
  CashCutoff: "Corte de caja",
  Liquidaciones: "Liquidaciones",
  Invoices: "Facturación",
  Bonos: "Bonos por desempeño",
  Cities: "Ciudades",
  ServiceTypes: "Tipos de servicio",
  CancellationPolicies: "Políticas de cancelación",
  PaymentMethods: "Métodos de pago",
  GeoZones: "Zonas tarifarias",
  RedZones: "Zonas rojas",
  Companies: "Empresas (B2B)",
  Surveys: "Encuestas",
  AdminUsers: "Usuarios admin",
  Settings: "Configuración",
  Landing: "Inicio",
  RejectionAnalysis: "Análisis de rechazos",
  Health: "Estado del sistema",
};

function usePWAManifest(currentPageName: string, companyName?: string) {
  useEffect(() => {
    const isPassenger = currentPageName === "RoadAssistApp";
    const isDriver = currentPageName === "DriverApp";
    const company = companyName || "YAJA Asistencia";

    let appTitle: string;
    if (isPassenger) appTitle = `${company} Pasajero`;
    else if (isDriver) appTitle = `${company} Conductor`;
    else {
      const pageName = PAGE_TITLES[currentPageName];
      appTitle = pageName ? `${pageName} — ${company}` : company;
    }

    // Update iOS PWA title (does not affect the manifest — that is static)
    let el = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(el);
    }
    el.setAttribute("content", appTitle);

    // Update document title too
    document.title = appTitle;
  }, [currentPageName, companyName]);
}

interface LayoutProps {
  children: React.ReactNode;
  currentPageName: string;
}

export default function Layout({ children, currentPageName }: LayoutProps) {
  const { settings } = useAppSettings();
  usePWAManifest(currentPageName, settings?.company_name);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ Operaciones: false, Finanzas: false, "Configuración": false });
  const { session, validated, isAllowed, logout } = useAdminSession();
  const queryClient = useQueryClient();
  const badges = useAdminBadges();

  // ── Load cities for geofence checks used by auto-assign ──────────────────
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
    staleTime: 5 * 60 * 1000,
    enabled: !!session, // only when logged in
  });

  // ── Global auto-assign: runs on every panel page, not just Dashboard ─────
  useRideAutoAssign(settings, cities, true);

  // Apply timezone globally whenever settings change
  useEffect(() => {
    if (settings?.timezone) {
      setSystemTimezone(settings.timezone);
    }
  }, [settings?.timezone]);

  // ── Route guard ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!validated) return;
    if (PUBLIC_PAGES.includes(currentPageName)) return;
    if (!session) { window.location.href = createPageUrl("AdminLogin"); return; }
    if (!isAllowed(currentPageName)) { window.location.href = createPageUrl("Dashboard"); }
  }, [validated, session, currentPageName, isAllowed]);

  // Invalidate react-query cache when session becomes available to ensure
  // freshly fetched data is shown immediately after login.
  React.useEffect(() => {
    if (session) {
      try {
        queryClient.invalidateQueries();
      } catch (e) {
        // ignore
      }
    }
  }, [session, queryClient]);

  const accentColor = settings?.accent_color || "#3B82F6";
  const primaryColor = settings?.primary_color || "#0F172A";
  const secondaryColor = settings?.secondary_color || "#10B981";
  const companyName = settings?.company_name || "YAJA Asistencia";

  const primaryHsl = hexToHslTuple(primaryColor);
  const accentHsl = hexToHslTuple(accentColor);
  const secondaryHsl = hexToHslTuple(secondaryColor);
  const primaryForeground = getReadableForeground(primaryColor);
  const accentForeground = getReadableForeground(accentColor);
  const secondaryForeground = getReadableForeground(secondaryColor);

  // ── Favicon dinámico: usa el logo_url de la DB ──
  useEffect(() => {
    const logoUrl = settings?.logo_url;
    if (!logoUrl) return;

    // Actualizar todos los links de favicon con el logo de la empresa
    const updateLink = (selector: string, href: string) => {
      let link = document.querySelector(selector) as HTMLLinkElement;
      if (link) {
        link.href = href;
      } else {
        link = document.createElement("link");
        const attrs = selector.match(/\[([^\]]+)\]/g);
        attrs?.forEach(attr => {
          const [key, val] = attr.replace(/[\[\]"']/g, '').split('=');
          link.setAttribute(key, val);
        });
        link.href = href;
        document.head.appendChild(link);
      }
    };
    updateLink('link[rel="icon"]', logoUrl);
    updateLink('link[rel="apple-touch-icon"]', logoUrl);
  }, [settings?.logo_url]);

  const shareAdminLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    toast.success("Enlace de gestión copiado");
  };

  // Build navGroups from settings.nav_config or fallback to defaults
  const rawConfig = settings?.nav_config?.length > 0 ? settings.nav_config : DEFAULT_NAV_CONFIG;
  const pageMap = Object.fromEntries(ALL_PAGES.map(p => [p.page, p]));
  const navGroups = rawConfig.map((group: any) => ({
    label: group.label,
    items: (group.pages || []).map((pageId: string) => pageMap[pageId]).filter(Boolean),
  }));

  // Filter sidebar nav to only allowed pages
  const visibleGroups = navGroups.map((g: any) => ({
    ...g,
    items: g.items.filter((i: any) => isAllowed(i.page)),
  })).filter((g: any) => g.items.length > 0);

  const toggleGroup = (label: string) =>
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

  if (currentPageName === "DriverApp") return <>{children}</>;
  if (currentPageName === "AdminLogin") return <>{children}</>;
  if (currentPageName === "RoadAssistApp") return <>{children}</>;

  // Show blank while validating to avoid flash
  if (!validated) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated → redirect handled above, show nothing
  if (!session) return null;

  // Access denied for this page
  if (!isAllowed(currentPageName)) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center flex-col gap-4 text-center">
        <Lock className="w-12 h-12 text-slate-300" />
        <h2 className="text-lg font-bold text-slate-700">Acceso no autorizado</h2>
        <p className="text-sm text-slate-400">No tienes permiso para ver esta página.</p>
        <Button onClick={() => window.location.href = createPageUrl("Dashboard")} className="mt-2">
          Ir al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <style>{`
        :root {
          --primary: ${primaryHsl};
          --primary-foreground: ${primaryForeground};
          --accent: ${accentHsl};
          --accent-foreground: ${accentForeground};
          --secondary: ${secondaryHsl};
          --secondary-foreground: ${secondaryForeground};
          --ring: ${accentHsl};
          --sidebar-primary: ${primaryHsl};
          --sidebar-primary-foreground: ${primaryForeground};
          --app-primary: ${primaryColor};
          --app-accent: ${accentColor};
          --app-secondary: ${secondaryColor};
        }
        html, body { overscroll-behavior: none; }
        .overflow-y-auto, .overflow-y-scroll, .overflow-auto { -webkit-overflow-scrolling: touch; }
      `}</style>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-40 flex items-center justify-between px-4 shadow-sm select-none" style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(56px + env(safe-area-inset-top))" }}>
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="w-6 h-6 rounded object-contain" />
          )}
          <h1 className="font-bold text-slate-900 text-sm">{companyName}</h1>
        </div>
        <Button variant="outline" size="sm" className="h-8 w-8" onClick={shareAdminLink}>
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-50 transform transition-transform duration-200 ease-out flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-9 h-9 rounded-xl object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow" style={{ backgroundColor: accentColor }}>
                  {companyName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-bold text-slate-900 text-sm leading-tight">{companyName}</p>
                <p className="text-[10px] text-slate-400">Panel administrativo</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {visibleGroups.map((group: any) => (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-2 py-1.5 mb-0.5"
              >
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{group.label}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${collapsed[group.label] ? "-rotate-90" : ""}`} />
              </button>

              {!collapsed[group.label] && group.items.map((item: any) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    href={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-0.5 ${
                      isActive ? "text-white font-medium shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    }`}
                    style={isActive ? { backgroundColor: accentColor } : {}}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.name}</span>
                    {item.live && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
                    {item.alert && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />}
                    {item.page === "SupportTickets" && badges.openTickets > 0 && (
                      <span className="bg-blue-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 flex-shrink-0">{badges.openTickets}</span>
                    )}
                    {item.page === "Dashboard" && badges.pendingRides > 0 && (
                      <span className="bg-amber-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 flex-shrink-0">{badges.pendingRides}</span>
                    )}
                    {item.page === "LiveDrivers" && badges.pendingRides > 0 && (
                      <span className="bg-amber-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 flex-shrink-0">{badges.pendingRides}</span>
                    )}
                    {item.page === "Chats" && badges.unreadChats > 0 && (
                      <span className="bg-blue-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 flex-shrink-0">{badges.unreadChats}</span>
                    )}
                    {item.page === "SOSAlerts" && badges.activeAlerts > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 flex-shrink-0">{badges.activeAlerts}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User section */}
        {session && (
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: accentColor }}>
              {((session?.full_name) || (session?.email) || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{session?.full_name || session?.email}</p>
              <p className="text-[10px] text-slate-400 capitalize">{session?.role || "admin"}</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 w-7 text-slate-400 hover:text-red-500 flex-shrink-0" onClick={logout} title="Cerrar sesión">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        )}
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0">
        <div className="p-5 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}