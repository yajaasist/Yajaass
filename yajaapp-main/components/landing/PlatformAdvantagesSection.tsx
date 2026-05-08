import React from "react";
import {
  MapPin, Bell, BarChart2, Clock, Users, FileText,
  MessageSquare, Star, Smartphone, Shield
} from "lucide-react";

const advantages = [
  {
    icon: MapPin,
    title: "Seguimiento en tiempo real",
    desc: "Monitoreo GPS de cada unidad en campo. Sabes exactamente dónde está el operador y cuánto tarda en llegar.",
  },
  {
    icon: Bell,
    title: "Despacho inteligente",
    desc: "El sistema asigna automáticamente al operador más cercano disponible, reduciendo tiempos de respuesta.",
  },
  {
    icon: BarChart2,
    title: "Reportes y estadísticas",
    desc: "Acceso a métricas de servicios, tiempos de atención y desempeño operativo en cualquier momento.",
  },
  {
    icon: Clock,
    title: "Historial completo de servicios",
    desc: "Cada solicitud queda registrada con fecha, tipo, operador asignado y estado final para auditoría.",
  },
  {
    icon: MessageSquare,
    title: "Comunicación directa",
    desc: "Chat integrado entre despachador y operador durante el servicio, sin depender de llamadas externas.",
  },
  {
    icon: FileText,
    title: "Comprobantes automáticos",
    desc: "Generación automática de comprobantes de servicio con detalle completo al momento de cerrar cada caso.",
  },
  {
    icon: Users,
    title: "Gestión de operadores",
    desc: "Perfiles, documentos, vehículos y estado de cada operador centralizados en una sola plataforma.",
  },
  {
    icon: Star,
    title: "Sistema de calificaciones",
    desc: "Evaluación de cada servicio para mantener estándares de calidad y mejorar continuamente.",
  },
  {
    icon: Smartphone,
    title: "App móvil para operadores",
    desc: "Los técnicos gestionan sus servicios directamente desde su smartphone, sin papeles ni llamadas.",
  },
  {
    icon: Shield,
    title: "Alertas de emergencia (SOS)",
    desc: "Protocolo de seguridad para operadores en campo con notificación inmediata al centro de control.",
  },
];

export default function PlatformAdvantagesSection() {
  return (
    <section id="ventajas" className="bg-[#0a0a0f] py-24 px-6 relative overflow-hidden">
      {/* Accent glow */}
      <div className="absolute right-0 top-1/3 w-96 h-96 rounded-full bg-[#0ea5e9]/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#0ea5e9] text-sm font-semibold tracking-widest uppercase mb-3">
            Plataforma tecnológica
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Todo bajo control,{" "}
            <span className="bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] bg-clip-text text-transparent">
              desde un solo lugar
            </span>
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-2xl mx-auto">
            No solo atendemos emergencias — operamos con tecnología de despacho que garantiza
            eficiencia, trazabilidad y calidad en cada servicio.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {advantages.map((item) => (
            <div
              key={item.title}
              className="group flex flex-col gap-3 p-5 rounded-2xl bg-white/3 border border-white/6 hover:border-[#0ea5e9]/25 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0ea5e9]/15 to-[#6366f1]/15 border border-[#0ea5e9]/15 flex items-center justify-center group-hover:from-[#0ea5e9]/25 group-hover:to-[#6366f1]/25 transition-all flex-shrink-0">
                <item.icon className="w-4 h-4 text-[#0ea5e9]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
