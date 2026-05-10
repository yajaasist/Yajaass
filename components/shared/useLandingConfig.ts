"use client"

import { useQuery } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";

export interface LandingConfig {
  brand_name?: string;
  brand_logo_url?: string;
  // Hero section
  hero_badge?: string;
  hero_title?: string;
  hero_title_highlight?: string;
  hero_subtitle?: string;
  hero_badge1?: string;
  hero_badge2?: string;
  hero_badge3?: string;
  hero_cta_primary_label?: string;
  hero_cta_primary_url?: string;
  hero_cta_secondary_label?: string;
  hero_cta_secondary_url?: string;
  // Services section
  services_title?: string;
  services_subtitle?: string;
  services_description?: string;
  services?: Array<{ title: string; desc: string }>;
  // Benefits section
  benefits_label?: string;
  benefits_title?: string;
  benefits_title_highlight?: string;
  benefits_description?: string;
  stat1_val?: string;
  stat1_label?: string;
  stat2_val?: string;
  stat2_label?: string;
  stat3_val?: string;
  stat3_label?: string;
  benefits?: Array<{ title: string; desc: string }>;
  // CTA section
  cta_title?: string;
  cta_title_highlight?: string;
  cta_subtitle?: string;
  cta_button_label?: string;
  cta_button_url?: string;
  cta_note?: string;
  extra_buttons?: Array<{ label: string; url: string; style?: string }>;
  // Footer section
  footer_links?: Array<{ label: string; url: string }>;
  [key: string]: any;
}

const DEFAULT_LANDING: LandingConfig = {
  brand_name: "YAJA",
  brand_logo_url: "",
  hero_badge: "Servicio 24/7 en toda la zona",
  hero_title: "Asistencia vial",
  hero_title_highlight: "rápida y confiable",
  hero_subtitle:
    "Paso de corriente, cambio de llanta, grúa y más. Llegamos a donde estás, cuando más lo necesitas. Cobertura por zonas con tiempos de respuesta garantizados.",
  hero_badge1: "Respuesta en minutos",
  hero_badge2: "Cobertura por zonas",
  hero_badge3: "Operadores certificados",
  hero_cta_primary_label: "Ver servicios",
  hero_cta_primary_url: "#servicios",
  hero_cta_secondary_label: "Iniciar sesión",
  hero_cta_secondary_url: "/admin-login",
  services_title: "Todo lo que necesitas,",
  services_subtitle: "en un solo lugar",
  services_description:
    "Asistencia vial completa para conductores y empresas. Sin esperas interminables.",
  services: [
    { title: "Paso de corriente", desc: "Batería descargada en cualquier lugar. Nuestros técnicos llegan equipados para reactivar tu vehículo de inmediato." },
    { title: "Cambio de llanta", desc: "Ponchadura o llanta baja sin problema. Cambiamos tu llanta con agilidad y seguridad donde te encuentres." },
    { title: "Envío de grúa", desc: "Vehículo varado, accidentado o inmovilizado. Grúas disponibles en tu zona para traslado al taller o destino." },
    { title: "Combustible de emergencia", desc: "Se te acabó la gasolina. Te llevamos los litros necesarios para que llegues a la estación más cercana." },
    { title: "Asistencia remota", desc: "Orientación en tiempo real con nuestros despachadores." },
    { title: "Asistencia en accidente", desc: "Coordinamos la llegada de grúa, apoyo vial y orientación básica en situaciones de emergencia en carretera." },
  ],
  benefits_label: "Por qué elegirnos",
  benefits_title: "Asistencia que",
  benefits_title_highlight: "realmente funciona",
  benefits_description:
    "No somos un call center genérico. Somos un equipo especializado en asistencia vial con tecnología de despacho, operadores de campo y cobertura zonal real.",
  stat1_val: "24/7",
  stat1_label: "Disponibilidad",
  stat2_val: "+500",
  stat2_label: "Servicios/mes",
  stat3_val: "<15min",
  stat3_label: "Tiempo respuesta",
  benefits: [
    { title: "Tiempos de respuesta óptimos", desc: "Operadores distribuidos estratégicamente en zonas para garantizar llegadas rápidas." },
    { title: "Personal certificado", desc: "Todos nuestros técnicos pasan por procesos de selección y capacitación continua." },
    { title: "Cobertura por zonas", desc: "Mapeamos nuestras zonas de operación para asegurar disponibilidad real donde la necesitas." },
    { title: "Despacho 24/7", desc: "Centro de operaciones activo todos los días del año, incluyendo festivos." },
    { title: "Calidad documentada", desc: "Cada servicio queda registrado. Seguimiento, calificación y mejora continua." },
    { title: "Proceso transparente", desc: "Sabes quién viene, cuándo llega y qué se va a hacer. Sin sorpresas." },
  ],
  cta_title: "¿Eres parte del",
  cta_title_highlight: "equipo operativo?",
  cta_subtitle:
    "La plataforma de conductores está disponible para dispositivos móviles. Accede desde tu smartphone para gestionar servicios en campo.",
  cta_button_label: "Acceso para conductores",
  cta_button_url: "/driver-app",
  cta_note: "Requiere dispositivo móvil • Solo personal autorizado",
  extra_buttons: [],
  footer_links: [
    { label: "Servicios", url: "#servicios" },
    { label: "Cómo funciona", url: "#como-funciona" },
    { label: "Beneficios", url: "#beneficios" },
    { label: "Privacidad", url: "#" },
  ],
};

export default function useLandingConfig(): LandingConfig {
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    staleTime: 60000,
  });
  const saved: Partial<LandingConfig> = (settingsList[0] as any)?.landing_config || {};
  return { ...DEFAULT_LANDING, ...saved };
}