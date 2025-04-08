"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { SearchComponent } from "./SearchComponent";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Prevent scrolling when menu is open
  // Listen for custom event to close the menu from search results
  useEffect(() => {
    const handleCloseMobileMenu = () => {
      setIsOpen(false);
    };

    window.addEventListener("closeMobileMenu", handleCloseMobileMenu);

    return () => {
      window.removeEventListener("closeMobileMenu", handleCloseMobileMenu);
    };
  }, []);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  return (
    <div className="md:hidden" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
      >
        <Menu className="h-6 w-6 text-[#174CA7]" />
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
          <div className="w-full h-full bg-white shadow-lg p-4 overflow-y-auto animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">Menú</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Cerrar menú"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-sm font-medium mb-3 text-gray-500">
                  BUSCAR
                </h3>
                <SearchComponent isMobile={true} />
              </div>

              <div className="border-b pb-4">
                <h3 className="text-sm font-medium mb-3 text-gray-500">
                  NAVEGACIÓN
                </h3>
                <div className="space-y-3">
                  <Link href="/">
                    <div
                      className="block px-3 py-2 rounded-md hover:bg-gray-100 text-[#174CA7]"
                      onClick={() => setIsOpen(false)}
                    >
                      Inicio
                    </div>
                  </Link>
                  <Link href="/catalogo">
                    <div
                      className="block px-3 py-2 rounded-md hover:bg-gray-100 text-[#174CA7]"
                      onClick={() => setIsOpen(false)}
                    >
                      Catálogo
                    </div>
                  </Link>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3 text-gray-500">
                  CONTACTO
                </h3>
                <Link href="/#contact-section">
                  <Button
                    className="w-full bg-[#174CA7] hover:bg-[#174CA7]/90 text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    Contactar
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
