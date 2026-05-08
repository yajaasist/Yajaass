import React from "react";
import { useLandingConfig } from "@/hooks/useLandingConfig";

export default function BenefitsSection() {
  const lc = useLandingConfig();
  const benefits = lc.benefits || [];

  return (
    <section id="beneficios" className="bg-[#0d0d14] py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left copy */}
          <div>
            <p className="text-[#0ea5e9] text-sm font-semibold tracking-widest uppercase mb-3">
              {lc.benefits_label}
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
              {lc.benefits_title}{" "}
              <span className="bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] bg-clip-text text-transparent">
                {lc.benefits_title_highlight}
              </span>
            </h2>
            <p className="text-white/45 text-lg leading-relaxed mb-8">
              {lc.benefits_description}
            </p>
            <div className="flex items-center gap-6 flex-wrap">
              {[
                { val: lc.stat1_val, label: lc.stat1_label },
                { val: lc.stat2_val, label: lc.stat2_label },
                { val: lc.stat3_val, label: lc.stat3_label },
              ].filter(s => s.val).map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl font-bold text-white">{stat.val}</div>
                  <div className="text-xs text-white/35 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl bg-white/3 border border-white/6 hover:border-[#0ea5e9]/20 transition-all duration-200 group">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#0ea5e9]/10 flex items-center justify-center group-hover:bg-[#0ea5e9]/15 transition-colors">
                  <span className="text-[#0ea5e9] font-bold text-sm">{i + 1}</span>
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm mb-1">{b.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
