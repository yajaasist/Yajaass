"use client"

import React, { useState, useEffect } from "react";
import { Menu, X, Zap } from "lucide-react";
import { useLandingConfig } from "@/hooks/useLandingConfig";
import useAppSettings from "@/components/shared/useAppSettings";

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lc = useLandingConfig();
  const { settings } = useAppSettings();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = (lc.footer_links || []).slice(0, 4);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 shadow-xl"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          {settings?.logo_url || lc.brand_logo_url
            ? <img src={settings?.logo_url || lc.brand_logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
            : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
            )
          }
          <span className="text-white font-bold text-xl tracking-tight">{settings?.company_name || lc.brand_name || "YAJA"}</span>
          <span className="text-[#0ea5e9] font-light text-sm ml-1">asistencia</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              className="text-white/60 hover:text-white text-sm font-medium transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href={lc.hero_cta_secondary_url || "/lp"}
            className="px-5 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white hover:opacity-90 transition-all duration-200 shadow-lg shadow-blue-500/20"
          >
            {lc.hero_cta_secondary_label || "Acceso conductores"}
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-white/70 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0a0a0f]/98 border-t border-white/5 px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              className="text-white/70 hover:text-white text-base font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href={lc.hero_cta_secondary_url || "/lp"}
            className="mt-2 px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] text-white text-center"
            onClick={() => setMenuOpen(false)}
          >
            {lc.hero_cta_secondary_label || "Acceso conductores"}
          </a>
        </div>
      )}
    </header>
  );
}
