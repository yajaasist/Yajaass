"use client";

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import InstallAppBanner from "@/components/shared/InstallAppBanner";
import HeroSection from "@/components/landing/HeroSection";
import ServicesSection from "@/components/landing/ServicesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import PlatformAdvantagesSection from "@/components/landing/PlatformAdvantagesSection";
import CtaSection from "@/components/landing/CtaSection";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Landing() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
        <InstallAppBanner settings={{}} />
        <LandingNav />
        <HeroSection />
        <ServicesSection />
        <HowItWorksSection />
        <BenefitsSection />
        <PlatformAdvantagesSection />
        <CtaSection />
        <LandingFooter />
      </div>
    </QueryClientProvider>
  );
}
