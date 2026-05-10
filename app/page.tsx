"use client";
export const dynamic = 'force-dynamic';

import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import ServicesSection from "@/components/landing/ServicesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import PlatformAdvantagesSection from "@/components/landing/PlatformAdvantagesSection";
import CtaSection from "@/components/landing/CtaSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <LandingNav />
      <HeroSection />
      <BenefitsSection />
      <ServicesSection />
      <HowItWorksSection />
      <PlatformAdvantagesSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}

