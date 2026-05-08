"use client";

import { useQuery } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";

const DEFAULT_LANDING = {
  brand_name: "YAJA",
  brand_logo_url: "",
  hero_badge: "Servicio 24/7 en toda la zona",
  hero_title: "Asistencia vial",
  hero_title_highlight: "rápida y confiable",
  hero_subtitle: "Paso de corriente, cambio de llanta, grúa y más. Llegamos a donde estás, cuando más lo necesitas. Cobertura por zonas con tiempos de respuesta garantizados.",
  hero_badge1: "Respuesta en minutos",
  hero_badge2: "Cobertura por zonas",
  hero_badge3: "Operadores certificados",
  hero_cta_primary_label: "Ver servicios",
  hero_cta_primary_url: "#servicios",
  hero_cta_secondary_label: "Acceso conductores",
  hero_cta_secondary_url: "/lp",
  services_title: "Todo lo que necesitas,",
  services_subtitle: "en un solo lugar",
  services_description: "Asistencia vial completa para conductores y empresas. Sin esperas interminables.",
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
  benefits_description: "No somos un call center genérico. Somos un equipo especializado en asistencia vial con tecnología de despacho, operadores de campo y cobertura zonal real.",
  stat1_val: "24/7", stat1_label: "Disponibilidad",
  stat2_val: "+500", stat2_label: "Servicios/mes",
  stat3_val: "<15min", stat3_label: "Tiempo respuesta",
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
  cta_subtitle: "La plataforma de conductores está disponible para dispositivos móviles. Accede desde tu smartphone para gestionar servicios en campo.",
  cta_button_label: "Acceso para conductores",
  cta_button_url: "/lp",
  cta_note: "Requiere dispositivo móvil • Solo personal autorizado",
  extra_buttons: [],
  footer_links: [
    { label: "Servicios", url: "#servicios" },
    { label: "Cómo funciona", url: "#como-funciona" },
    { label: "Beneficios", url: "#beneficios" },
    { label: "Privacidad", url: "#" },
  ],
};

export function useLandingConfig() {
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      try {
        return await supabaseApi.settings.list();
      } catch (error) {
        console.error("Error loading landing config from Supabase:", error);
        return [];
      }
    },
    staleTime: 60000,
  });
  const saved = settingsList[0]?.landing_config || {};
  return { ...DEFAULT_LANDING, ...saved };
}
