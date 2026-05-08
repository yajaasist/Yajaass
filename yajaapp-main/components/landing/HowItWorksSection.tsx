import React from "react";
import { PhoneCall, MapPin, UserCheck, CheckCircle2 } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: PhoneCall,
    title: "Solicita asistencia",
    desc: "Contacta a nuestro centro de despacho o usa la plataforma. Indicamos zona y tipo de servicio.",
  },
  {
    num: "02",
    icon: MapPin,
    title: "Localizamos tu zona",
    desc: "Identificamos el operador más cercano en tu zona de cobertura para minimizar el tiempo de llegada.",
  },
  {
    num: "03",
    icon: UserCheck,
    title: "Técnico en camino",
    desc: "El conductor asignado sale hacia tu ubicación. Recibes seguimiento en tiempo real.",
  },
  {
    num: "04",
    icon: CheckCircle2,
    title: "Problema resuelto",
    desc: "El operador atiende la emergencia. Servicio documentado y cierre de caso confirmado.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-[#0a0a0f] py-24 px-6 relative overflow-hidden">
      {/* Subtle accent */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#6366f1]/5 blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <p className="text-[#6366f1] text-sm font-semibold tracking-widest uppercase mb-3">
            Proceso simple
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            ¿Cómo funciona?
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
            Desde que nos contactas hasta que resolvemos tu emergencia, en 4 pasos claros.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(100%-0px)] w-full h-px bg-gradient-to-r from-white/10 to-transparent z-0" />
              )}
              <div className="relative z-10 flex flex-col items-start gap-4 p-6 rounded-2xl bg-white/3 border border-white/6 hover:border-[#6366f1]/30 transition-all duration-300 group">
                <div className="flex items-center gap-3">
                  <span className="text-[#6366f1]/60 font-mono text-xs font-bold">{step.num}</span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1]/20 to-[#0ea5e9]/20 border border-[#6366f1]/20 flex items-center justify-center group-hover:from-[#6366f1]/30 group-hover:to-[#0ea5e9]/30 transition-all">
                    <step.icon className="w-5 h-5 text-[#6366f1]" />
                  </div>
                </div>
                <h3 className="text-white font-semibold text-base">{step.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
