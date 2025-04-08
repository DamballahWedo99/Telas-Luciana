"use client";

import { Hero } from "@/components/Hero";
import { FeaturedFabrics } from "@/components/FeaturedFabrics";
import { ContactSection } from "@/components/ContactSection";
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
