import React from "react";
import { useLandingConfig } from "@/hooks/useLandingConfig";

const COLORS = [
  { color: "from-yellow-400 to-orange-500", glow: "shadow-yellow-500/20" },
  { color: "from-[#0ea5e9] to-cyan-400",    glow: "shadow-cyan-500/20" },
  { color: "from-[#6366f1] to-violet-500",  glow: "shadow-violet-500/20" },
  { color: "from-emerald-400 to-green-500", glow: "shadow-emerald-500/20" },
  { color: "from-pink-400 to-rose-500",     glow: "shadow-pink-500/20" },
  { color: "from-orange-400 to-red-500",    glow: "shadow-orange-500/20" },
];

export default function ServicesSection() {
  const lc = useLandingConfig();
  const services = lc.services || [];

  return (
    <section id="servicios" className="bg-[#0d0d14] py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#0ea5e9] text-sm font-semibold tracking-widest uppercase mb-3">
            Nuestros servicios
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            {lc.services_title}{" "}
            <span className="bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] bg-clip-text text-transparent">
              {lc.services_subtitle}
            </span>
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
            {lc.services_description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => {
            const style = COLORS[i % COLORS.length];
            return (
              <div key={i} className={`group relative rounded-2xl p-6 bg-white/3 border border-white/6 hover:border-white/12 transition-all duration-300 hover:-translate-y-1 shadow-xl ${style.glow}`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center mb-5 shadow-lg`}>
                  <span className="text-white font-bold text-lg">{(s.title || "S").charAt(0)}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
