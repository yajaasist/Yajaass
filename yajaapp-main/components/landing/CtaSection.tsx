import React from "react";
import { ArrowRight, Smartphone } from "lucide-react";
import { useLandingConfig } from "@/hooks/useLandingConfig";
import { useQuery } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";

export default function CtaSection() {
  const lc = useLandingConfig();
  const extraButtons = lc.extra_buttons || [];

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    staleTime: 60000,
  });
  const features = settingsList[0]?.features_enabled || {};
  const showSection = features.show_app_install_section !== false;

  if (!showSection) return null;

  const isExternal = (url) => url?.startsWith("http");

  const renderButton = (btn, i) => {
    const baseClass = "inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-base transition-all duration-200";
    const styles = {
      primary: `${baseClass} bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white hover:opacity-90 shadow-xl shadow-blue-500/20`,
      secondary: `${baseClass} border border-white/20 text-white/70 hover:text-white hover:border-white/40`,
      outline: `${baseClass} border border-[#0ea5e9]/40 text-[#0ea5e9] hover:bg-[#0ea5e9]/10`,
    };
    const cls = styles[btn.style] || styles.secondary;
    return isExternal(btn.url)
      ? <a key={i} href={btn.url} target="_blank" rel="noreferrer" className={cls}>{btn.label}</a>
      : <a key={i} href={btn.url} className={cls}>{btn.label}</a>;
  };

  return (
    <section className="bg-[#0a0a0f] py-24 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-[#0ea5e9]/10 to-[#6366f1]/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/5 text-[#6366f1] text-sm font-medium mb-8">
          <Smartphone className="w-4 h-4" />
          Solo para conductores
        </div>

        <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
          {lc.cta_title}{" "}
          <span className="bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] bg-clip-text text-transparent">
            {lc.cta_title_highlight}
          </span>
        </h2>

        <p className="text-white/45 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          {lc.cta_subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
          {lc.cta_button_label && (
            isExternal(lc.cta_button_url)
              ? <a href={lc.cta_button_url} target="_blank" rel="noreferrer"
                  className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white font-semibold text-lg hover:opacity-90 transition-all duration-200 shadow-2xl shadow-blue-500/25">
                  {lc.cta_button_label}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
              : <a href={lc.cta_button_url}
                  className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white font-semibold text-lg hover:opacity-90 transition-all duration-200 shadow-2xl shadow-blue-500/25">
                  {lc.cta_button_label}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
          )}
          {extraButtons.map((btn, i) => renderButton(btn, i))}
        </div>

        {lc.cta_note && (
          <p className="mt-6 text-white/25 text-sm">{lc.cta_note}</p>
        )}
      </div>
    </section>
  );
}
