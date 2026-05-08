import React from "react";
import { Zap } from "lucide-react";
import { useLandingConfig } from "@/hooks/useLandingConfig";
import useAppSettings from "@/components/shared/useAppSettings";

export default function LandingFooter() {
  const lc = useLandingConfig();
  const { settings } = useAppSettings();
  const links = lc.footer_links || [];

  return (
    <footer className="bg-[#0a0a0f] border-t border-white/5 px-6 py-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          {settings?.logo_url || lc.brand_logo_url
            ? <img src={settings?.logo_url || lc.brand_logo_url} alt="Logo" className="w-6 h-6 rounded object-contain" />
            : (
              <div className="w-6 h-6 rounded bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
            )
          }
          <span className="text-white/60 text-sm font-medium">{settings?.company_name || lc.brand_name || "YAJA"} asistencia</span>
        </div>

        {/* Copyright */}
        <p className="text-white/25 text-xs">
          © {new Date().getFullYear()} {settings?.company_name || lc.brand_name || "YAJA"} Asistencia. Todos los derechos reservados.
        </p>

        {/* Links */}
        {links.length > 0 && (
          <nav className="flex items-center gap-6">
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                className="text-white/30 hover:text-white/60 text-xs transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}
