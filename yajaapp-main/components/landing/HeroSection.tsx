import React from "react";
import { ArrowRight, Shield, Clock, MapPin } from "lucide-react";
import { useLandingConfig } from "@/hooks/useLandingConfig";

export default function HeroSection() {
  const lc = useLandingConfig();

  const isExternal = (url) => url?.startsWith("http");

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(14,165,233,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.15) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-[#0ea5e9]/10 to-[#6366f1]/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#0ea5e9]/30 bg-[#0ea5e9]/5 text-[#0ea5e9] text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-[#0ea5e9] animate-pulse" />
          {lc.hero_badge}
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
          {lc.hero_title}{" "}
          <span className="bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] bg-clip-text text-transparent">
            {lc.hero_title_highlight}
          </span>
        </h1>

        {/* Sub */}
        <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          {lc.hero_subtitle}
        </p>

        {/* Badges row */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
          {[lc.hero_badge1, lc.hero_badge2, lc.hero_badge3].filter(Boolean).map((text, i) => {
            const icons = [Clock, MapPin, Shield];
            const IconComp = icons[i] || Shield;
            return (
              <div key={i} className="flex items-center gap-2 text-white/50 text-sm">
                <IconComp className="w-4 h-4 text-[#0ea5e9]" />
                <span>{text}</span>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {lc.hero_cta_primary_label && (
            isExternal(lc.hero_cta_primary_url)
              ? <a href={lc.hero_cta_primary_url} target="_blank" rel="noreferrer"
                  className="group flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white font-semibold text-base hover:opacity-90 transition-all duration-200 shadow-xl shadow-blue-500/25">
                  {lc.hero_cta_primary_label}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              : <a href={lc.hero_cta_primary_url}
                  className="group flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white font-semibold text-base hover:opacity-90 transition-all duration-200 shadow-xl shadow-blue-500/25">
                  {lc.hero_cta_primary_label}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
          )}
          {lc.hero_cta_secondary_label && (
            isExternal(lc.hero_cta_secondary_url)
              ? <a href={lc.hero_cta_secondary_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-8 py-4 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-medium text-base transition-all duration-200">
                  {lc.hero_cta_secondary_label}
                </a>
              : <a href={lc.hero_cta_secondary_url}
                  className="flex items-center gap-2 px-8 py-4 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-medium text-base transition-all duration-200">
                  {lc.hero_cta_secondary_label}
                </a>
          )}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0d0d14] to-transparent pointer-events-none" />
    </section>
  );
}
