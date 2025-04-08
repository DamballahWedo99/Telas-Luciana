"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import FabricCard from "@/components/static/FabricCard";

const fabricCategories = [
  { id: "Chamarra", name: "Chamarras" },
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
];

export const fabricData = {
  Chamarra: [
    {
      id: 1,
      name: "BD042",
      image: "/images/chamarras/BD042.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "310 gsm",
      },
    },
    {
      id: 2,
      name: "BD050",
      image: "/images/chamarras/BD050.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "360 gsm",
      },
    },
    {
      id: 3,
      name: "BD070",
      image: "/images/chamarras/BD070.jpg",
      specs: {
        composition: "94% POLIESTER / 6% ELASTANO",
        width: "150 cm",
        weight: "280 gsm",
      },
    },
    {
      id: 4,
      name: "HY24030038",
      image: "/images/chamarras/HY24030038.jpg",
      specs: {
        composition: "96% POLIESTER / 4% ELASTANO+TPU+100% POLIESTER",
        width: "145 cm",
        weight: "360 gsm",
      },
    },
    {
      id: 5,
      name: "HY24030037",
      image: "/images/chamarras/HY24030037.jpg",
      specs: {
        composition: "96% POLIESTER / 4% ELASTANO + 100% POLIESTER",
        width: "145 cm",
        weight: "385 gsm",
      },
    },
    {
      id: 6,
      name: "HY24030041",
      image: "/images/chamarras/HY24030041.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "230 gsm",
      },
    },
  ],
  Deportiva: [
    {
      id: 1,
      name: "YW2021-1",
      image: "/images/deportiva/YW2021-1.jpg",
      specs: {
        composition: "85%POLIESTER / 15% ELASTANO",
        width: "150 cm",
        weight: "160 gsm",
      },
    },
    {
      id: 2,
      name: "LH-65-M",
      image: "/images/deportiva/LH-65-M.jpg",
      specs: {
        composition: "90% POLIESTER / 10% ELASTANO",
        width: "150 cm",
        weight: "160 gsm",
      },
    },
    {
      id: 3,
      name: "M0033",
      image: "/images/deportiva/M0033.jpg",
      specs: {
        composition: "77% POLIESTER/ 23% ELASTANO",
        width: "138 cm",
        weight: "270 gsm",
      },
    },
    {
      id: 4,
      name: "HLT9009",
      image: "/images/playera/HLT9009.jpg",
      specs: {
        composition: "88% POLIESTER/ 12% ELASTANO",
        width: "150 cm",
        weight: "170 gsm",
      },
    },
    {
      id: 5,
      name: "HY24060404",
      image: "/images/deportiva/HY24060404.jpg",
      specs: {
        composition: "87% POLIESTER / 13% ELASTANO",
        width: "180 cm",
        weight: "180 gsm",
      },
    },
    {
      id: 6,
      name: "Micromonaco",
      image: "/images/deportiva/micromonaco.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "310 gsm",
      },
    },
  ],
  Licra: [
    {
      id: 1,
      name: "HY24060415",
      image: "/images/deportiva/HY24060415.jpg",
      specs: {
        composition: "90% POLIESTER / 10% ELASTANO",
        width: "180 cm",
        weight: "160 gsm",
      },
    },
    {
      id: 2,
      name: "HY24030048",
      image: "/images/playera/HY24030048.jpg",
      specs: {
        composition: "92% POLIESTERESTER / 8% ELASTANO",
        width: "160 cm",
        weight: "240 gsm",
      },
    },
    {
      id: 3,
      name: "HY24060411",
      image: "/images/leggins/HY24060411.jpg",
      specs: {
        composition: "80% NYLON / 20% ELASTANO",
        width: "160 cm",
        weight: "190 gsm",
      },
    },
    {
      id: 4,
      name: "HY24030054",
      image: "/images/deportiva/HY24030054.jpg",
      specs: {
        composition: "92% POLIESTER / 8% ELASTANO",
        width: "150 cm",
        weight: "250 gsm",
      },
    },
    {
      id: 5,
      name: "NS031",
      image: "/images/leggins/NS031.jpg",
      specs: {
        composition: "RECYCLED NYLON 75% /ELASTANO 25%",
        width: "152 cm",
        weight: "230 gsm",
      },
    },
    {
      id: 6,
      name: "NS030",
      image: "/images/leggins/NS030.jpg",
      specs: {
        composition: "RECYCLED NYLON 80% / ELASTANO 20%",
        width: "152 cm",
        weight: "190 gsm",
      },
    },
  ],
  Guayabera: [
    {
      id: 1,
      name: "Flame",
      image: "/images/guayabera/flame.jpg",
      specs: {
        composition: "70% ALGODÓN/ 30% POLIESTER",
        width: "160 cm",
        weight: "130 gsm",
      },
    },
  ],
  Leggins: [
    {
      id: 1,
      name: "HY24030051",
      image: "/images/leggins/HY24030051.jpg",
      specs: {
        composition: "92% POLIESTER / 8% ELASTANO",
        width: "180 cm",
        weight: "250 gsm",
      },
    },
    {
      id: 2,
      name: "HY24060404",
      image: "/images/deportiva/HY24060404.jpg",
      specs: {
        composition: "87% POLIESTER / 13% ELASTANO",
        width: "180 cm",
        weight: "180 gsm",
      },
    },
    {
      id: 3,
      name: "HY24030052",
      image: "/images/leggins/HY24030052.jpg",
      specs: {
        composition: "94% NYLON / 6% ELASTANO",
        width: "160 cm",
        weight: "250 gsm",
      },
    },
    {
      id: 4,
      name: "W0418",
      image: "/images/leggins/W0418.jpg",
      specs: {
        composition: "92% NYLON / 8% ELASTANO",
        width: "130 cm",
        weight: "250 gsm",
      },
    },
    {
      id: 5,
      name: "HY24030058",
      image: "/images/leggins/HY24030058.jpg",
      specs: {
        composition: "85% POLIESTER / 15% ELASTANO",
        width: "150 cm",
        weight: "200 gsm",
      },
    },
    {
      id: 6,
      name: "HY24030050",
      image: "/images/leggins/HY24030050.jpg",
      specs: {
        composition: "92% POLIESTER / 8% ELASTANO",
        width: "150 cm",
        weight: "230 gsm",
      },
    },
  ],
  Médico: [
    {
      id: 1,
      name: "Novack repell",
      image: "/images/medico/open-med.jpg",
      specs: {
        composition: "88% POLIESTER/ 12 % ELASTANO",
        width: "150 cm",
        weight: "140 gsm",
      },
    },
    {
      id: 2,
      name: "Medray",
      image: "/images/medico/medray.jpg",
      specs: {
        composition: "63% POLIESTER /34% RAYÓN /3% ELASTANO",
        width: "150 cm",
        weight: "180 gsm",
      },
    },
    {
      id: 3,
      name: "Micromed",
      image: "/images/medico/micromed.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "120 gsm",
      },
    },
    {
      id: 4,
      name: "Australia",
      image: "/images/medico/australia.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "110 gsm",
      },
    },
    {
      id: 5,
      name: "Scrub",
      image: "/images/medico/scrub.jpg",
      specs: {
        composition: "94% NYLON / 6% ELASTANO",
        width: "150 cm",
        weight: "135 gsm",
      },
    },
  ],
  Otros: [
    {
      id: 1,
      name: "MWL240615",
      image: "/images/otros/MWL240615.jpg",
      specs: {
        composition: "40%POLIESTER / 30% Rayon/  25%Nylon / 5%ELASTANO",
        width: "147 cm",
        weight: "300 gsm",
      },
    },
    {
      id: 2,
      name: "XCW0291",
      image: "/images/otros/XCW0291.jpg",
      specs: {
        composition: "83% RAYON  / 17% NYLON",
        width: "140 cm",
        weight: "95 gsm",
      },
    },
    {
      id: 3,
      name: "HY24030055",
      image: "/images/otros/HY24030055.jpg",
      specs: {
        composition: "85% POLIESTER / 15% ELASTANO",
        width: "150 cm",
        weight: "200 gsm",
      },
    },
    {
      id: 4,
      name: "XCW0226",
      image: "/images/otros/XCW0226.jpg",
      specs: {
        composition: "70% RAYON / 30% POLIESTER",
        width: "145 cm",
        weight: "110 gsm",
      },
    },
    {
      id: 5,
      name: "IL020-E",
      image: "/images/otros/IL020-E.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "160 cm",
        weight: "135 gsm",
      },
    },
    {
      id: 6,
      name: "Bandera",
      image: "/images/otros/bandera.jpg",
      specs: {
        composition: "100% NYLON",
        width: "150 cm",
        weight: "125 gsm",
      },
    },
  ],
  Playeras: [
    {
      id: 1,
      name: "M0644",
      image: "/images/playera/M0644.jpg",
      specs: {
        composition: "95% POLIESTER/ 5% ELASTANO",
        width: "173 cm",
        weight: "165 gsm",
      },
    },
    {
      id: 2,
      name: "M0033",
      image: "/images/deportiva/M0033.jpg",
      specs: {
        composition: "77% POLIESTER/ 23% ELASTANO",
        width: "138 cm",
        weight: "270 gsm",
      },
    },
    {
      id: 3,
      name: "FVG22020614",
      image: "/images/playera/FVG22020614.jpg",
      specs: {
        composition: "87% NYLON / 13 % ELASTANO",
        width: "172 cm",
        weight: "170 gsm",
      },
    },
    {
      id: 4,
      name: "HLT9009",
      image: "/images/playera/HLT9009.jpg",
      specs: {
        composition: "88% POLIESTER/ 12% ELASTANO",
        width: "150 cm",
        weight: "170 gsm",
      },
    },
    {
      id: 5,
      name: "MS054",
      image: "/images/playera/MS054.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "160 cm",
        weight: "200 gsm",
      },
    },
    {
      id: 6,
      name: "W0513",
      image: "/images/playera/W0513.jpg",
      specs: {
        composition: "80% NYLON /  20% ELASTANO",
        width: "150 cm",
        weight: "180 gsm",
      },
    },
  ],
  Pants: [
    {
      id: 1,
      name: "HY24030040",
      image: "/images/sudadera/HY24030040.jpg",
      specs: {
        composition: "100% POLIESTER + 100% POLIESTER",
        width: "150 cm",
        weight: "320 gsm",
      },
    },
    {
      id: 2,
      name: "DHL Uniform",
      image: "/images/sudadera/dhl-uniform.jpg",
      specs: {
        composition: "100% POLIESTER +TPU + 100% POLIESTER",
        width: "145 cm",
        weight: "330 gsm",
      },
    },
    {
      id: 3,
      name: "SQ24060501",
      image: "/images/chamarras/SQ24060501.jpg",
      specs: {
        composition: "79% POLIESTER / 15% RAYON / 6% ELASTANO",
        width: "150 cm",
        weight: "320 gsm",
      },
    },
    {
      id: 4,
      name: "HY24060412",
      image: "/images/sudadera/HY24060412.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "235 gsm",
      },
    },
    {
      id: 5,
      name: "Sport Tock",
      image: "/images/sudadera/sport-tock.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "160 cm",
        weight: "245 gsm",
      },
    },
    {
      id: 6,
      name: "Short",
      image: "/images/sudadera/short.jpg",
      specs: {
        composition: "55% POLIESTER / 38% MODAL/ 7% ELASTANO",
        width: "150 cm",
        weight: "335 gsm",
      },
    },
  ],
  Rompevientos: [
    {
      id: 1,
      name: "HY24030059",
      image: "/images/rompevientos/HY24030059.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "145 cm",
        weight: "215 gsm",
      },
    },
    {
      id: 2,
      name: "FV240424-2",
      image: "/images/rompevientos/FV240424-2.jpg",
      specs: {
        composition:
          "92% POLIESTER / 8% ELASTANO + TPU + 95% POLIESTER / 5% ELASTANO",
        width: "145 cm",
        weight: "195 gsm",
      },
    },
    {
      id: 3,
      name: "Queshua",
      image: "/images/rompevientos/queshua.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "142 cm",
        weight: "92 gsm",
      },
    },
    {
      id: 4,
      name: "B0013",
      image: "/images/rompevientos/B0013.jpg",
      specs: {
        composition: "80% NYLON /20% ELASTANO",
        width: "150 cm",
        weight: "200 gsm",
      },
    },
    {
      id: 5,
      name: "BD042",
      image: "/images/chamarras/BD042.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "310 gsm",
      },
    },
    {
      id: 6,
      name: "WT013",
      image: "/images/rompevientos/WT013.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "155 cm",
        weight: "99 gsm",
      },
    },
  ],
  TelasDeLinea: [
    {
      id: 1,
      name: "Maiky Plus",
      image: "/images/stock/maiky-plus.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "180 cm",
        weight: "140 gsm",
      },
    },
    {
      id: 2,
      name: "Maiky",
      image: "/images/stock/maiky.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "135 gsm",
      },
    },
    {
      id: 3,
      name: "Celtic",
      image: "/images/stock/celtic.jpg",
      specs: {
        composition: "95% POLIESTER/ 5% ELASTANO",
        width: "150 cm",
        weight: "140 gsm",
      },
    },
    {
      id: 4,
      name: "Brush Plus",
      image: "/images/stock/brush-plus.jpg",
      specs: {
        composition: "96% POLIESTER/ 4% ELASTANO",
        width: "155 cm",
        weight: "160 gsm",
      },
    },
    {
      id: 5,
      name: "Milenio Plus",
      image: "/images/stock/milenio-plus.jpg",
      specs: {
        composition: "92% POLIESTERESTER / 8% ELASTANO",
        width: "165 cm",
        weight: "150 gsm",
      },
    },
    {
      id: 6,
      name: "Tikal",
      image: "/images/stock/tikal.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "180 cm",
        weight: "190 gsm",
      },
    },
  ],
  Sudadera: [
    {
      id: 1,
      name: "DHL Uniform",
      image: "/images/sudadera/dhl-uniform.jpg",
      specs: {
        composition: "100% POLIESTER +TPU + 100% POLIESTER",
        width: "145 cm",
        weight: "330 gsm",
      },
    },
    {
      id: 2,
      name: "LH9093",
      image: "/images/chamarras/LH9093.jpg",
      specs: {
        composition: "61% NYLON/ 39% POLIESTER",
        width: "153 cm",
        weight: "300 gsm",
      },
    },
    {
      id: 3,
      name: "HY23030067",
      image: "/images/sudadera/HY23030067.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "260 gsm",
      },
    },
    {
      id: 4,
      name: "HY24060412",
      image: "/images/sudadera/HY24060412.jpg",
      specs: {
        composition: "100% POLIESTER",
        width: "150 cm",
        weight: "235 gsm",
      },
    },
    {
      id: 5,
      name: "HY24030039",
      image: "/images/sudadera/HY24030039.jpg",
      specs: {
        composition: "100% POLIESTER + 100% POLIESTER",
        width: "145 cm",
        weight: "380 gsm",
      },
    },
    {
      id: 6,
      name: "Short",
      image: "/images/sudadera/short.jpg",
      specs: {
        composition: "55% POLIESTER / 38% MODAL/ 7% ELASTANO",
        width: "150 cm",
        weight: "335 gsm",
      },
    },
  ],
  Peluche: [
    {
      id: 1,
      name: "Jazmin",
      image: "/images/peluche/jazmin.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "460 gsm",
      },
    },
    {
      id: 2,
      name: "Lamb",
      image: "/images/peluche/lamb.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "250 gsm",
      },
    },
    {
      id: 3,
      name: "ML1211-2",
      image: "/images/peluche/ML1211-2.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "310 gsm",
      },
    },
    {
      id: 4,
      name: "MLPV5005",
      image: "/images/peluche/MLPV5005.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "250 gsm",
      },
    },
    {
      id: 5,
      name: "JB-PV-12005",
      image: "/images/peluche/JB-PV-12005.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "250 gsm",
      },
    },
    {
      id: 6,
      name: "Cocodrilo Skin",
      image: "/images/peluche/cocodrilo-skin.jpg",
      specs: {
        composition: "100 % POLIESTER",
        width: "150 cm",
        weight: "240 gsm",
      },
    },
  ],
};

export function FeaturedFabrics() {
  const [activeCategory, setActiveCategory] = useState("Chamarra");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth < 768);
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  const visibleFabrics = isMobile ? 3 : 6;

  return (
    <section id="featured-fabrics" className="py-[6vh] px-[2vw]">
      <div className="max-w-[90vw] mx-auto">
        <div className="mb-[4vh]">
          <Select onValueChange={setActiveCategory} defaultValue="Chamarra">
            <SelectTrigger className="w-full md:w-[50%] lg:w-[32%] text-[4vw] md:text-[2vw] lg:text-[1vw] bg-white">
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent>
              {fabricCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  <span className="text-[3.5vw] md:text-[1.8vw] lg:text-[1vw]">
                    {category.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2vw] mt-[4vh]">
          {(fabricData[activeCategory as keyof typeof fabricData] || [])
            .slice(0, visibleFabrics)
            .map((fabric) => (
              <FabricCard key={fabric.id} fabric={fabric} />
            ))}
        </div>
        <div className="text-center mt-[4vh]">
          <Link href="/catalogo">
            <Button className="w-full bg-[#174CA7] hover:bg-[#174CA7]/90 text-white px-[4vw] py-[2vh] text-[4vw] sm:w-auto sm:text-[1.2vw] sm:px-[2vw] md:py-[2vh] md:text-[2vw] lg:py-[3vh] lg:text-[1vw]">
              Ver más
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
