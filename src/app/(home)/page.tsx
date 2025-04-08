"use client";

import { Hero } from "@/components/static/Hero";
import { FeaturedFabrics } from "@/components/static/FeaturedFabrics";
import { ContactSection } from "@/components/static/ContactSection";
import { useCallback } from "react";

export default function Home() {
  const scrollToSection = useCallback((sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <>
      <Hero
        onExplore={() => scrollToSection("featured-fabrics")}
        onContact={() => scrollToSection("contact-section")}
      />
      <FeaturedFabrics />
      <ContactSection />
    </>
  );
}
