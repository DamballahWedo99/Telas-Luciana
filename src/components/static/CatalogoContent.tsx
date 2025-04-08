"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fabricData } from "@/lib/fabric";
import FabricCard from "@/components/static/FabricCard";

type Fabric = {
  id: number;
  name: string;
  image: string;
  specs?: {
    composition: string;
    width?: string;
    weight?: string;
  };
};

export default function CatalogoContent() {
  const searchParams = useSearchParams();
  const initialCategoryRef = useRef<string | null>(null);
  const initialFabricRef = useRef<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Chamarra");
  const [highlightedFabric, setHighlightedFabric] = useState<string | null>(
    null
  );
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const category = searchParams.get("category");
    const fabric = searchParams.get("fabric");

    initialCategoryRef.current = category;
    initialFabricRef.current = fabric;

    if (category && Object.keys(fabricData).includes(category)) {
      setActiveCategory(category);
    }

    if (fabric) {
      setHighlightedFabric(fabric);

      // Scroll to the highlighted fabric with a small delay to allow rendering
      setTimeout(() => {
        const element = document.getElementById(
          `fabric-${fabric.replace(/\s+/g, "-")}`
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
    }
  }, [searchParams]);

  return (
    <main>
      <section className="py-[6vh] px-[2vw]">
        <div className="max-w-[90vw] mx-auto">
          <div className="mb-[4vh]">
            <Select
              onValueChange={(value) => setActiveCategory(value)}
              defaultValue={initialCategoryRef.current || "Chamarra"}
              value={activeCategory}
            >
              <SelectTrigger className="w-full md:w-[50%] lg:w-[32%] text-[4vw] md:text-[2vw] lg:text-[1vw] bg-white">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {[
                  { id: "Chamarra", name: "Chamarras" },
                  { id: "Colorido", name: "Coloridos" },
                  { id: "Deportiva", name: "Deportiva" },
                  { id: "Licra", name: "Licra" },
                  { id: "Guayabera", name: "Guayabera" },
                  { id: "Leggins", name: "Leggins" },
                  { id: "Médico", name: "Médico" },
                  { id: "Rompevientos", name: "Rompevientos" },
                  { id: "Otros", name: "Otros" },
                  { id: "Peluche", name: "Peluche" },
                  { id: "Playeras", name: "Playera" },
                  { id: "Pants", name: "Pants" },
                  { id: "TelasDeLinea", name: "Telas de Línea" },
                  { id: "Sudadera", name: "Sudadera" },
                  { id: "ProductoTerminado", name: "Producto terminado" },
                ].map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="text-[4vw] md:text-[2vw] lg:text-[1vw]">
                      {category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2vw]">
            {fabricData[activeCategory as keyof typeof fabricData]?.length >
            0 ? (
              fabricData[activeCategory as keyof typeof fabricData].map(
                (fabric: Fabric) => (
                  <div
                    key={fabric.id}
                    id={`fabric-${fabric.name.replace(/\s+/g, "-")}`}
                    ref={
                      highlightedFabric === fabric.name ? highlightRef : null
                    }
                  >
                    <FabricCard fabric={fabric} />
                  </div>
                )
              )
            ) : (
              <p className="col-span-full text-center text-gray-500 text-[4vw] md:text-[2vw] lg:text-[1vw]">
                No hay telas disponibles en esta categoría.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
