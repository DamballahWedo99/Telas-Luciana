"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import Image from "next/image";
import { fabricData } from "@/lib/fabric";
import { useRouter } from "next/navigation";

type FabricResult = {
  id: number;
  name: string;
  image: string;
  category: string;
  categoryName: string;
};

const categoryNames: Record<string, string> = {
  Chamarra: "Chamarras",
  Colorido: "Coloridos",
  Deportiva: "Deportiva",
  Licra: "Licra",
  Guayabera: "Guayabera",
  Leggins: "Leggins",
  Médico: "Médico",
  Rompevientos: "Rompevientos",
  Otros: "Otros",
  Peluche: "Peluche",
  Playeras: "Playera",
  Pants: "Pants",
  TelasDeLinea: "Telas de Línea",
  Sudadera: "Sudadera",
  ProductoTerminado: "Producto terminado",
};

export function SearchComponent({ isMobile = false }: { isMobile?: boolean }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<FabricResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Flatten fabric data into a searchable array
  const getAllFabrics = (): FabricResult[] => {
    const results: FabricResult[] = [];

    Object.entries(fabricData).forEach(([category, fabrics]) => {
      fabrics.forEach((fabric) => {
        results.push({
          id: fabric.id,
          name: fabric.name,
          image: fabric.image,
          category,
          categoryName: categoryNames[category] || category,
        });
      });
    });

    return results;
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);

    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    const allFabrics = getAllFabrics();
    const filteredResults = allFabrics.filter(
      (fabric) =>
        fabric.name.toLowerCase().includes(term.toLowerCase()) ||
        fabric.categoryName.toLowerCase().includes(term.toLowerCase())
    );

    setSearchResults(filteredResults); // Show all results
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      searchRef.current &&
      !searchRef.current.contains(event.target as Node)
    ) {
      setIsFocused(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navigateToCategory = (category: string, fabricName: string) => {
    router.push(`/catalogo?category=${category}&fabric=${fabricName}`);
    setSearchTerm("");
    setSearchResults([]);
    setIsFocused(false);

    // Add a callback for mobile menu closing
    if (isMobile && typeof window !== "undefined") {
      // Create a custom event that the MobileMenu component will listen for
      window.dispatchEvent(new CustomEvent("closeMobileMenu"));
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
  };

  return (
    <div className={`relative ${isMobile ? "w-full" : ""}`} ref={searchRef}>
      <div className="flex items-center">
        <div
          className={`flex items-center bg-white rounded-md border overflow-hidden ${
            isMobile ? "w-full" : "w-[80vw] sm:w-[25vw] md:w-[20vw] lg:w-[18vw]"
          }`}
        >
          <Input
            id="search-input"
            type="text"
            placeholder="Buscar telas..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="border-0 focus-visible:ring-0 text-[4vw] md:text-[1.8vw] lg:text-[1vw] h-10"
          />
          {searchTerm && (
            <button onClick={clearSearch} className="mr-1">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
          <button className="bg-[#174CA7] text-white h-10 px-3 flex items-center justify-center">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search results dropdown */}
      {isFocused && searchResults.length > 0 && (
        <div
          className={`${
            isMobile ? "relative mt-2" : "absolute top-full right-0 mt-1"
          } w-full bg-white rounded-md shadow-lg z-50 max-h-[60vh] overflow-y-auto`}
        >
          {searchResults.length > 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 border-b">
              {searchResults.length}{" "}
              {searchResults.length === 1
                ? "resultado encontrado"
                : "resultados encontrados"}
            </div>
          )}
          <div className="p-2">
            {searchResults.map((fabric) => (
              <div
                key={`${fabric.category}-${fabric.id}`}
                className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                onClick={() => navigateToCategory(fabric.category, fabric.name)}
              >
                <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={fabric.image}
                    alt={fabric.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[3.5vw] md:text-[1.5vw] lg:text-[1vw] truncate">
                    {fabric.name}
                  </p>
                  <p className="text-gray-500 text-[3vw] md:text-[1.2vw] lg:text-[0.8vw] truncate">
                    {fabric.categoryName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {isFocused && searchTerm.length >= 2 && searchResults.length === 0 && (
        <div
          className={`${
            isMobile ? "relative mt-2" : "absolute top-full right-0 mt-1"
          } w-full bg-white rounded-md shadow-lg z-50`}
        >
          <div className="p-4 text-center text-gray-500 text-[3.5vw] md:text-[1.5vw] lg:text-[1vw]">
            No se encontraron resultados para &quot;{searchTerm}&quot;
          </div>
        </div>
      )}
    </div>
  );
}
